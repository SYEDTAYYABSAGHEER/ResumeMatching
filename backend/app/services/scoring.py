import re
from collections import Counter

from sqlalchemy.orm import Session

from app.models.entities import Job, Candidate, RequirementScore, MatchLevel, MatchResult
from app.services.llm_evaluator import evaluate_requirement_with_llm


def _tokenize(text: str) -> list[str]:
    return re.findall(r"[a-zA-Z0-9+#.]+", text.lower())


def _evidence_sections(candidate_text: str, req_tokens: list[str]) -> list[str]:
    sections = re.split(r'[\n\.]+', candidate_text)
    hits = []
    for section in sections:
        cleaned = section.strip()
        if not cleaned:
            continue
        section_tokens = set(_tokenize(cleaned))
        if any(token in section_tokens for token in req_tokens):
            hits.append(cleaned)
    return hits[:3]


def _evaluate_requirement(requirement: str, candidate_text: str) -> tuple[float, str, str, str, str]:
    # Step 1: Parse requirement intent and tokens.
    req_tokens = [t for t in _tokenize(requirement) if len(t) > 2]
    cand_tokens = Counter(_tokenize(candidate_text))
    hits = [t for t in req_tokens if cand_tokens[t] > 0]
    evidence_sections = _evidence_sections(candidate_text, req_tokens)

    if not req_tokens:
        return 0.0, 'Low', '', 'Clearly Missing', 'Insufficient requirement text to evaluate.'

    # Step 2-3: Search CV and assess evidence strength/explicitness.
    coverage = len(hits) / max(1, len(set(req_tokens)))
    explicitness = 'High' if requirement.lower() in candidate_text.lower() else 'Medium'
    evidence_text = evidence_sections[0] if evidence_sections else ', '.join(hits[:8])

    # Step 4: Assign base score/confidence/gap.
    score = 0.0
    confidence = 'Low'
    gap_type = 'Clearly Missing'
    if coverage >= 0.7:
        score = 1.0
        confidence = 'High'
        gap_type = 'Strongly Demonstrated'
    elif coverage >= 0.3:
        score = 0.5
        confidence = 'Medium'
        gap_type = 'Partially Demonstrated'

    # Step 5: Self-critique to reduce over-scoring.
    if score == 1.0 and (explicitness != 'High' or not evidence_sections):
        score = 0.5
        confidence = 'Medium'
        gap_type = 'Partially Demonstrated'
    if score == 0.5 and not hits:
        score = 0.0
        confidence = 'Low'
        gap_type = 'Clearly Missing'

    # Step 6: Finalize with evidence trace.
    notes = (
        f"Step 1 Read Requirement: '{requirement}'. "
        f"Step 2 Search CV: found {len(evidence_sections)} relevant sections. "
        f"Step 3 Assess Evidence: token coverage {round(coverage * 100, 1)}%, explicitness {explicitness}. "
        f"Step 4 Assign Score: provisional {score}. "
        f"Step 5 Self-Critique: re-checked evidence for recruiter-level confidence. "
        f"Step 6 Finalise & Cite: {evidence_text[:220] if evidence_text else 'No direct evidence found.'}"
    )
    return score, confidence, evidence_text[:240], gap_type, notes


def match_level_for_score(score: float) -> MatchLevel:
    if score >= 80:
        return MatchLevel.strong
    if score >= 65:
        return MatchLevel.moderate
    return MatchLevel.weak


def score_candidate_for_job(db: Session, candidate: Candidate, job: Job) -> MatchResult:
    db.query(RequirementScore).filter(
        RequirementScore.candidate_id == candidate.id,
        RequirementScore.job_id == job.id,
    ).delete()

    total = 0.0
    possible = 0.0
    risk_flag = False

    for req in job.requirements:
        llm_eval = evaluate_requirement_with_llm(
            requirement_text=req.requirement_text,
            requirement_type=req.requirement_type.value,
            candidate_text=candidate.raw_text or '',
        )
        if llm_eval is not None:
            score = llm_eval.score
            confidence = llm_eval.confidence
            evidence = llm_eval.evidence
            gap_type = llm_eval.gap_type
            notes = llm_eval.notes
        else:
            score, confidence, evidence, gap_type, notes = _evaluate_requirement(req.requirement_text, candidate.raw_text)
        possible += 1.0
        total += score
        if req.requirement_type.value == 'mandatory' and score == 0.0:
            risk_flag = True

        db.add(
            RequirementScore(
                candidate_id=candidate.id,
                job_id=job.id,
                requirement_id=req.id,
                score=score,
                confidence=confidence,
                evidence=evidence,
                gap_type=gap_type,
                notes=notes,
            )
        )

    total_percent = round((total / possible) * 100, 2) if possible else 0.0
    match_level = match_level_for_score(total_percent)

    summary = (
        f"Candidate {candidate.full_name} is a {match_level.value} match for {job.title} "
        f"with {total_percent}% score."
    )
    interview_questions = [
        'Can you share a concrete project example for missing or partial requirements?',
        'Which tools and technologies did you use most recently?',
        'Tell us about impact and ownership in your last role.',
    ]
    outreach_email = (
        f"Hi {candidate.full_name},\n\n"
        f"Your profile appears relevant for {job.title}. We'd like to discuss your experience.\n\n"
        'Best regards,\nRecruitment Team'
    )

    result = db.query(MatchResult).filter(
        MatchResult.candidate_id == candidate.id,
        MatchResult.job_id == job.id,
    ).first()

    if result is None:
        result = MatchResult(candidate_id=candidate.id, job_id=job.id)
        db.add(result)

    result.total_score_percent = total_percent
    result.match_level = match_level
    result.risk_flag = risk_flag
    result.summary = summary
    result.interview_questions = interview_questions
    result.outreach_email = outreach_email

    db.commit()
    db.refresh(result)
    return result
