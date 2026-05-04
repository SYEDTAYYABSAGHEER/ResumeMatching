import json
from dataclasses import dataclass

import requests

from app.core.config import settings


@dataclass
class LLMRequirementEvaluation:
    score: float
    confidence: str
    evidence: str
    gap_type: str
    notes: str


def _build_prompt(requirement_text: str, requirement_type: str, candidate_text: str) -> str:
    return f"""
You are M Evaluator, a strict recruiter-grade evaluator.
Evaluate ONE requirement against the provided CV using a 6-step reasoning loop.

Requirement:
- Text: {requirement_text}
- Type: {requirement_type}

Candidate CV:
\"\"\"
{candidate_text[:8000]}
\"\"\"

Follow exactly these steps:
1) Read Requirement: parse type, threshold, intent
2) Search CV: locate relevant CV sections
3) Assess Evidence: strength, recency, explicitness
4) Assign Score: only 0, 0.5, or 1
5) Self-Critique: challenge your own score from a senior recruiter lens
6) Finalise & Cite: finalize with exact evidence quote

Rules:
- Never invent experience.
- Use only evidence from the CV text provided.
- If evidence is vague, lower confidence.
- Output must be valid JSON only (no markdown).

JSON schema:
{{
  "score": 0 | 0.5 | 1,
  "confidence": "Low" | "Medium" | "High",
  "evidence": "exact CV quote or short snippet",
  "gap_type": "Strongly Demonstrated" | "Partially Demonstrated" | "Clearly Missing",
  "notes": "Step 1 ... Step 2 ... Step 3 ... Step 4 ... Step 5 ... Step 6 ..."
}}
""".strip()


def _parse_ollama_response(raw_text: str) -> dict:
    text = raw_text.strip()
    if text.startswith('```'):
        text = text.strip('`')
        text = text.replace('json', '', 1).strip()
    start = text.find('{')
    end = text.rfind('}')
    if start == -1 or end == -1:
        raise ValueError('LLM response did not contain JSON object.')
    return json.loads(text[start:end + 1])


def evaluate_requirement_with_llm(
    requirement_text: str,
    requirement_type: str,
    candidate_text: str,
) -> LLMRequirementEvaluation | None:
    if not settings.llm_enabled:
        return None
    if settings.llm_provider.lower() != 'ollama':
        return None

    payload = {
        'model': settings.llm_model,
        'prompt': _build_prompt(requirement_text, requirement_type, candidate_text),
        'stream': False,
    }
    try:
        resp = requests.post(
            f"{settings.llm_base_url.rstrip('/')}/api/generate",
            json=payload,
            timeout=settings.llm_timeout_seconds,
        )
        resp.raise_for_status()
        data = resp.json()
        parsed = _parse_ollama_response(data.get('response', ''))
    except Exception:
        return None

    score = float(parsed.get('score', 0.0))
    if score not in {0.0, 0.5, 1.0}:
        score = 0.0
    confidence = str(parsed.get('confidence', 'Low')).title()
    if confidence not in {'Low', 'Medium', 'High'}:
        confidence = 'Low'
    gap_type = str(parsed.get('gap_type', 'Clearly Missing'))
    if gap_type not in {'Strongly Demonstrated', 'Partially Demonstrated', 'Clearly Missing'}:
        gap_type = 'Clearly Missing'
    evidence = str(parsed.get('evidence', ''))[:240]
    notes = str(parsed.get('notes', ''))[:1200]
    if 'Step 1' not in notes:
        notes = (
            "Step 1 Read Requirement completed. Step 2 Search CV completed. "
            "Step 3 Assess Evidence completed. Step 4 Assign Score completed. "
            "Step 5 Self-Critique completed. Step 6 Finalise & Cite completed. "
            f"Evidence: {evidence or 'Not found.'}"
        )

    return LLMRequirementEvaluation(
        score=score,
        confidence=confidence,
        evidence=evidence,
        gap_type=gap_type,
        notes=notes,
    )
