from celery import Celery

from app.core.config import settings
from app.db.session import SessionLocal
from app.services.matching import run_full_matching

celery_app = Celery('resume_matching', broker=settings.redis_url, backend=settings.redis_url)
celery_app.conf.beat_schedule = {
    'hourly-matching': {
        'task': 'app.worker.run_hourly_matching',
        'schedule': 3600.0,
    }
}


@celery_app.task(name='app.worker.run_hourly_matching')
def run_hourly_matching() -> int:
    db = SessionLocal()
    try:
        return run_full_matching(db)
    finally:
        db.close()
