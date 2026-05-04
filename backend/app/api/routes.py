import csv
import io
import os
import re
import tempfile
from urllib.parse import parse_qs, urlparse

import requests

from fastapi import APIRouter, Depends, File, Form, HTTPException, Response, UploadFile
from sqlalchemy.orm import Session

from app.db.session import get_db
from app.models.entities import Candidate, Job, JobRequirement, MatchResult, RequirementScore, RequirementType
from app.schemas.schemas import CandidateCreate, CandidateUpdate, JobCreate, JobUpdate, MatchResponse
from app.services.matching import run_full_matching
from app.services.parsers import extract_candidate_profile, extract_text_from_csv_bytes, extract_text_from_docx, extract_text_from_pdf
from app.services.scoring import score_candidate_for_job
from app.services.storage import safe_upload_bytes_to_minio

router = APIRouter(prefix='/api', tags=['api'])


def _file_id_from_google_drive_url(url: str) -> str | None:
    parsed = urlparse(url)
    if 'drive.google.com' not in parsed.netloc:
        return None

    query_id = parse_qs(parsed.query).get('id', [None])[0]
    if query_id:
        return query_id

    match = re.search(r'/d/([a-zA-Z0-9_-]+)', parsed.path)
    if match:
        return match.group(1)
    return None


def _parse_resume_file(filename: str, file_bytes: bytes) -> str:
    suffix = filename.lower().split('.')[-1]
    if suffix == 'csv':
        return extract_text_from_csv_bytes(file_bytes)

    with tempfile.NamedTemporaryFile(delete=False, suffix=f'.{suffix}') as tmp:
        tmp.write(file_bytes)
        temp_path = tmp.name

    try:
        if suffix == 'pdf':
            return extract_text_from_pdf(temp_path)
        if suffix == 'docx':
            return extract_text_from_docx(temp_path)
        raise HTTPException(status_code=400, detail='Only PDF, DOCX, and CSV supported')
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


@router.get('/health')
def health():
    return {'status': 'ok'}


@router.post('/candidates')
def create_candidate(payload: CandidateCreate, db: Session = Depends(get_db)):
    data = payload.model_dump()
    profile = extract_candidate_profile(data.get('raw_text', ''))
    data['email'] = data.get('email') or profile.get('parsed_email')
    data['phone'] = data.get('phone') or profile.get('parsed_phone')
    data['location'] = data.get('location') or profile.get('parsed_location')
    data['current_title'] = data.get('current_title') or profile.get('parsed_current_title')
    if profile.get('parsed_years_of_experience') is not None and not data.get('years_of_experience'):
        data['years_of_experience'] = profile['parsed_years_of_experience']
    data['profile_json'] = {k: v for k, v in profile.items() if not k.startswith('parsed_')}
    candidate = Candidate(**data)
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


@router.post('/candidates/upload')
def upload_candidate_cv(
    full_name: str = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    file_bytes = file.file.read()
    raw_text = _parse_resume_file(file.filename, file_bytes)
    minio_path = safe_upload_bytes_to_minio(file_bytes, file.filename, file.content_type or 'application/octet-stream')
    profile = extract_candidate_profile(raw_text)

    candidate = Candidate(
        full_name=full_name,
        raw_text=raw_text,
        email=profile.get('parsed_email'),
        phone=profile.get('parsed_phone'),
        location=profile.get('parsed_location'),
        current_title=profile.get('parsed_current_title'),
        years_of_experience=profile.get('parsed_years_of_experience') or 0,
        profile_json={'source': 'local_upload', 'minio_object': minio_path, **{k: v for k, v in profile.items() if not k.startswith('parsed_')}},
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


@router.post('/candidates/upload-drive')
def upload_candidate_from_google_drive(
    full_name: str = Form(...),
    drive_url: str = Form(...),
    db: Session = Depends(get_db),
):
    file_id = _file_id_from_google_drive_url(drive_url)
    if not file_id:
        raise HTTPException(status_code=400, detail='Invalid Google Drive URL. Use a public share link.')

    download_url = f'https://drive.google.com/uc?export=download&id={file_id}'
    response = requests.get(download_url, timeout=45)
    if response.status_code != 200:
        raise HTTPException(status_code=400, detail='Could not download file from Google Drive. Ensure link is public.')

    content_disposition = response.headers.get('content-disposition', '')
    filename_match = re.search(r'filename=\"?([^\";]+)\"?', content_disposition)
    filename = filename_match.group(1) if filename_match else f'{file_id}.pdf'
    file_bytes = response.content

    raw_text = _parse_resume_file(filename, file_bytes)
    minio_path = safe_upload_bytes_to_minio(file_bytes, filename, response.headers.get('content-type', 'application/octet-stream'))
    profile = extract_candidate_profile(raw_text)

    candidate = Candidate(
        full_name=full_name,
        raw_text=raw_text,
        email=profile.get('parsed_email'),
        phone=profile.get('parsed_phone'),
        location=profile.get('parsed_location'),
        current_title=profile.get('parsed_current_title'),
        years_of_experience=profile.get('parsed_years_of_experience') or 0,
        profile_json={
            'source': 'google_drive',
            'drive_url': drive_url,
            'minio_object': minio_path,
            **{k: v for k, v in profile.items() if not k.startswith('parsed_')},
        },
    )
    db.add(candidate)
    db.commit()
    db.refresh(candidate)
    return candidate


@router.get('/candidates')
def list_candidates(db: Session = Depends(get_db)):
    return db.query(Candidate).order_by(Candidate.created_at.desc()).all()


@router.get('/candidates/{candidate_id}')
def get_candidate(candidate_id: int, db: Session = Depends(get_db)):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail='Candidate not found')
    return candidate


def _extract_key_skills(raw_text: str) -> list[str]:
    skill_keywords = [
        'python', 'fastapi', 'django', 'flask', 'react', 'typescript', 'javascript',
        'aws', 'docker', 'kubernetes', 'sql', 'postgresql', 'pandas', 'machine', 'learning',
        'nlp', 'redis', 'celery', 'terraform', 'linux',
    ]
    text = raw_text.lower()
    found = []
    for skill in skill_keywords:
        if skill in text:
            found.append(skill.upper() if skill in {'aws', 'nlp', 'sql'} else skill.title())
    return found[:8]


def _cv_improvement_suggestions(raw_text: str) -> list[str]:
    suggestions = []
    if len(raw_text.strip()) < 250:
        suggestions.append('Expand CV bullets with measurable impact (numbers, scope, outcomes).')
    if '\n' not in raw_text:
        suggestions.append('Improve readability by splitting content into clear sections and bullet points.')
    if raw_text and raw_text == raw_text.lower():
        suggestions.append('Use consistent capitalization for technologies, roles, and headings.')
    if ',' in raw_text and '-' not in raw_text and '•' not in raw_text:
        suggestions.append('Convert comma-separated skills into a structured skills section for recruiter scanning.')
    if not suggestions:
        suggestions.append('Keep evidence statements specific: include technology + action + business result per bullet.')
    return suggestions


@router.get('/candidates/{candidate_id}/analysis')
def candidate_analysis(candidate_id: int, db: Session = Depends(get_db)):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail='Candidate not found')

    best_match = (
        db.query(MatchResult)
        .filter(MatchResult.candidate_id == candidate_id)
        .order_by(MatchResult.total_score_percent.desc())
        .first()
    )
    if not best_match:
        return {
            'section_a': {
                'name': candidate.full_name,
                'current_title': candidate.current_title,
                'total_score_percent': 0,
                'match_level': 'unscored',
                'years_of_experience': candidate.years_of_experience,
                'key_skills': _extract_key_skills(candidate.raw_text or ''),
                'location': candidate.location or 'Not specified',
                'availability': 'Not specified',
            },
            'section_b': [],
            'section_c': [],
            'section_d': [],
            'section_e': _cv_improvement_suggestions(candidate.raw_text or ''),
        }

    job = db.query(Job).filter(Job.id == best_match.job_id).first()
    rows = (
        db.query(RequirementScore, JobRequirement)
        .join(JobRequirement, RequirementScore.requirement_id == JobRequirement.id)
        .filter(
            RequirementScore.candidate_id == candidate_id,
            RequirementScore.job_id == best_match.job_id,
        )
        .all()
    )

    section_b = [
        {
            'requirement': req.requirement_text,
            'score': score.score,
            'evidence_from_cv': score.evidence,
            'confidence_level': score.confidence,
            'gap_type': score.gap_type,
            'notes': score.notes,
        }
        for score, req in rows
    ]
    section_c = [f"{item['requirement']} ({item['confidence_level']})" for item in section_b if item['score'] >= 1.0][:5]
    section_d = [f"{item['requirement']} ({item['gap_type']})" for item in section_b if item['score'] <= 0.0][:5]

    return {
        'job_context': {
            'job_id': best_match.job_id,
            'job_title': job.title if job else f'Job #{best_match.job_id}',
        },
        'section_a': {
            'name': candidate.full_name,
            'current_title': candidate.current_title,
            'total_score_percent': best_match.total_score_percent,
            'match_level': best_match.match_level.value,
            'years_of_experience': candidate.years_of_experience,
            'key_skills': _extract_key_skills(candidate.raw_text or ''),
            'location': candidate.location or 'Not specified',
            'availability': 'Not specified',
        },
        'section_b': section_b,
        'section_c': section_c,
        'section_d': section_d,
        'section_e': _cv_improvement_suggestions(candidate.raw_text or ''),
    }


@router.put('/candidates/{candidate_id}')
def update_candidate(candidate_id: int, payload: CandidateUpdate, db: Session = Depends(get_db)):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail='Candidate not found')

    updates = payload.model_dump(exclude_unset=True)
    if 'raw_text' in updates and 'profile_json' not in updates:
        parsed_profile = extract_candidate_profile(updates.get('raw_text') or '')
        updates['profile_json'] = {k: v for k, v in parsed_profile.items() if not k.startswith('parsed_')}
        updates['email'] = updates.get('email') or parsed_profile.get('parsed_email') or candidate.email
        updates['phone'] = updates.get('phone') or parsed_profile.get('parsed_phone') or candidate.phone
        updates['location'] = updates.get('location') or parsed_profile.get('parsed_location') or candidate.location
        updates['current_title'] = updates.get('current_title') or parsed_profile.get('parsed_current_title') or candidate.current_title
        if updates.get('years_of_experience') in (None, 0):
            updates['years_of_experience'] = parsed_profile.get('parsed_years_of_experience') or candidate.years_of_experience
    for key, value in updates.items():
        setattr(candidate, key, value)

    db.commit()
    db.refresh(candidate)
    return candidate


@router.delete('/candidates/{candidate_id}')
def delete_candidate(candidate_id: int, db: Session = Depends(get_db)):
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not candidate:
        raise HTTPException(status_code=404, detail='Candidate not found')

    db.query(MatchResult).filter(MatchResult.candidate_id == candidate_id).delete(synchronize_session=False)
    db.delete(candidate)
    db.commit()
    return {'ok': True}


@router.post('/jobs')
def create_job(payload: JobCreate, db: Session = Depends(get_db)):
    job = Job(
        title=payload.title,
        company=payload.company,
        location=payload.location,
        seniority=payload.seniority,
        description_text=payload.description_text,
    )
    db.add(job)
    db.flush()

    for req in payload.requirements:
        req_type = req.requirement_type.lower()
        if req_type not in {'mandatory', 'preferred', 'optional'}:
            req_type = 'preferred'
        db.add(
            JobRequirement(
                job_id=job.id,
                requirement_text=req.requirement_text,
                requirement_type=RequirementType(req_type),
            )
        )

    db.commit()
    db.refresh(job)
    return job


@router.get('/jobs')
def list_jobs(db: Session = Depends(get_db)):
    return db.query(Job).order_by(Job.created_at.desc()).all()


@router.get('/jobs/{job_id}')
def get_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')

    return {
        'id': job.id,
        'title': job.title,
        'company': job.company,
        'location': job.location,
        'seniority': job.seniority,
        'description_text': job.description_text,
        'created_at': job.created_at,
        'requirements': [
            {
                'id': req.id,
                'requirement_text': req.requirement_text,
                'requirement_type': req.requirement_type.value,
            }
            for req in job.requirements
        ],
    }


@router.put('/jobs/{job_id}')
def update_job(job_id: int, payload: JobUpdate, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')

    updates = payload.model_dump(exclude_unset=True)
    for key, value in updates.items():
        setattr(job, key, value)

    db.commit()
    db.refresh(job)
    return job


@router.delete('/jobs/{job_id}')
def delete_job(job_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail='Job not found')

    db.query(MatchResult).filter(MatchResult.job_id == job_id).delete(synchronize_session=False)
    db.query(RequirementScore).filter(RequirementScore.job_id == job_id).delete(synchronize_session=False)
    db.delete(job)
    db.commit()
    return {'ok': True}


@router.post('/match/{job_id}/{candidate_id}', response_model=MatchResponse)
def match_candidate(job_id: int, candidate_id: int, db: Session = Depends(get_db)):
    job = db.query(Job).filter(Job.id == job_id).first()
    candidate = db.query(Candidate).filter(Candidate.id == candidate_id).first()
    if not job or not candidate:
        raise HTTPException(status_code=404, detail='Candidate or Job not found')

    result = score_candidate_for_job(db, candidate, job)
    return MatchResponse(
        candidate_id=result.candidate_id,
        job_id=result.job_id,
        total_score_percent=result.total_score_percent,
        match_level=result.match_level.value,
        risk_flag=result.risk_flag,
        summary=result.summary,
        interview_questions=result.interview_questions,
        outreach_email=result.outreach_email,
    )


@router.post('/match/run-all')
def run_all_matching(db: Session = Depends(get_db)):
    count = run_full_matching(db)
    return {'matches_processed': count}


@router.get('/matches')
def list_matches(db: Session = Depends(get_db)):
    return db.query(MatchResult).order_by(MatchResult.created_at.desc()).all()


@router.get('/dashboard')
def dashboard(db: Session = Depends(get_db)):
    matches = db.query(MatchResult).all()
    avg_score = round(sum(m.total_score_percent for m in matches) / len(matches), 2) if matches else 0.0
    top = sorted(matches, key=lambda m: m.total_score_percent, reverse=True)[:5]
    return {
        'total_candidates': db.query(Candidate).count(),
        'total_jobs': db.query(Job).count(),
        'total_matches': len(matches),
        'average_match_score': avg_score,
        'risk_alerts': len([m for m in matches if m.risk_flag]),
        'top_matches': [
            {
                'candidate_id': m.candidate_id,
                'job_id': m.job_id,
                'score': m.total_score_percent,
                'match_level': m.match_level.value,
            }
            for m in top
        ],
    }


@router.get('/reports/candidate/{candidate_id}.csv')
def candidate_report_csv(candidate_id: int, db: Session = Depends(get_db)):
    rows = (
        db.query(RequirementScore, JobRequirement, Job)
        .join(JobRequirement, RequirementScore.requirement_id == JobRequirement.id)
        .join(Job, RequirementScore.job_id == Job.id)
        .filter(RequirementScore.candidate_id == candidate_id)
        .all()
    )
    if not rows:
        raise HTTPException(status_code=404, detail='No report data found for candidate')

    out = io.StringIO()
    writer = csv.writer(out)
    writer.writerow(['candidate_id', 'job_id', 'job_title', 'requirement', 'type', 'score', 'confidence', 'evidence', 'gap_type'])
    for score, req, job in rows:
        writer.writerow([
            score.candidate_id,
            score.job_id,
            job.title,
            req.requirement_text,
            req.requirement_type.value,
            score.score,
            score.confidence,
            score.evidence,
            score.gap_type,
        ])
    return Response(
        content=out.getvalue(),
        media_type='text/csv',
        headers={'Content-Disposition': f'attachment; filename=candidate_{candidate_id}_report.csv'},
    )
