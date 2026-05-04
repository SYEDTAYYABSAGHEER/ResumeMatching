from sqlalchemy.orm import Session

from app.models.entities import Candidate, Job
from app.services.scoring import score_candidate_for_job


def run_full_matching(db: Session) -> int:
    candidates = db.query(Candidate).all()
    jobs = db.query(Job).all()

    count = 0
    for candidate in candidates:
        for job in jobs:
            score_candidate_for_job(db, candidate, job)
            count += 1
    return count
