import csv
import re
from io import StringIO

from docx import Document
from pypdf import PdfReader


def extract_text_from_pdf(path: str) -> str:
    reader = PdfReader(path)
    parts = []
    for page in reader.pages:
        parts.append(page.extract_text() or '')
    return '\n'.join(parts)


def extract_text_from_docx(path: str) -> str:
    doc = Document(path)
    return '\n'.join([p.text for p in doc.paragraphs])


def extract_text_from_csv_bytes(file_bytes: bytes) -> str:
    decoded = file_bytes.decode('utf-8', errors='ignore')
    reader = csv.reader(StringIO(decoded))
    rows = []
    for row in reader:
        cleaned = [cell.strip() for cell in row if cell.strip()]
        if cleaned:
            rows.append(' | '.join(cleaned))
    return '\n'.join(rows)


def extract_candidate_profile(raw_text: str) -> dict:
    text = raw_text or ''
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    lowered = text.lower()

    email_match = re.search(r'[\w\.-]+@[\w\.-]+\.\w+', text)
    phone_match = re.search(r'(\+?\d[\d\-\s\(\)]{7,}\d)', text)
    years_match = re.search(r'(\d+(?:\.\d+)?)\+?\s*(?:years?|yrs?)\s*(?:of)?\s*experience', lowered)

    possible_titles = [
        'software engineer', 'backend engineer', 'frontend engineer', 'full stack developer',
        'data scientist', 'data analyst', 'devops engineer', 'machine learning engineer',
        'product manager', 'qa engineer',
    ]
    current_title = next((title.title() for title in possible_titles if title in lowered), None)

    locations = ['karachi', 'lahore', 'islamabad', 'rawalpindi', 'remote', 'dubai', 'london']
    location = next((city.title() for city in locations if city in lowered), None)

    tech_keywords = ['python', 'django', 'fastapi', 'flask', 'react', 'typescript', 'javascript', 'aws', 'docker', 'kubernetes', 'sql', 'postgresql']
    soft_keywords = ['communication', 'leadership', 'collaboration', 'problem solving', 'teamwork', 'stakeholder management']
    tool_keywords = ['jira', 'git', 'github', 'gitlab', 'figma', 'power bi', 'tableau', 'excel']
    language_keywords = ['english', 'urdu', 'arabic', 'hindi']
    domain_keywords = ['fintech', 'healthcare', 'ecommerce', 'saas', 'edtech', 'telecom']

    def _pick(keywords: list[str], max_items: int = 6) -> str:
        found = [k.title() if k != 'aws' else 'AWS' for k in keywords if k in lowered]
        return ', '.join(found[:max_items]) if found else ''

    work_history_lines = [line for line in lines if re.search(r'\b(20\d{2}|19\d{2})\b', line) and len(line) > 18]
    education_lines = [line for line in lines if any(k in line.lower() for k in ['bachelor', 'master', 'bs', 'ms', 'university', 'college'])]
    cert_lines = [line for line in lines if any(k in line.lower() for k in ['certified', 'certification', 'certificate'])]

    return {
        'seniority_level': 'Senior' if (years_match and float(years_match.group(1)) >= 5) else 'Mid',
        'technical_skills': _pick(tech_keywords),
        'soft_skills': _pick(soft_keywords),
        'tools_technologies': _pick(tool_keywords),
        'work_history': ' | '.join(work_history_lines[:4]),
        'education': ' | '.join(education_lines[:3]),
        'certifications': ' | '.join(cert_lines[:3]),
        'languages': _pick(language_keywords),
        'domain_expertise': _pick(domain_keywords),
        'employment_type_preference': 'Not specified',
        'work_authorization': 'Not specified',
        'parsed_email': email_match.group(0) if email_match else None,
        'parsed_phone': phone_match.group(0) if phone_match else None,
        'parsed_location': location,
        'parsed_current_title': current_title,
        'parsed_years_of_experience': float(years_match.group(1)) if years_match else None,
    }
