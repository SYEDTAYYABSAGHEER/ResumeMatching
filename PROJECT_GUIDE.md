# Resume Matching Agent - Project Guide

This guide explains how to run the project, what libraries are used, which models exist, and what every major module does.

## 1) Project Overview

Resume Matching Agent is a full-stack application that:

- Ingests candidates (manual, local file upload, Google Drive link)
- Ingests jobs with requirements
- Runs rule-based matching between candidates and jobs
- Stores and displays per-requirement scores and final match results
- Provides dashboards, candidate/job management, and reporting

Main stack:

- Backend: FastAPI + SQLAlchemy + Celery
- Frontend: React + Vite + Axios
- Infra (Docker): PostgreSQL, Redis, MinIO, Qdrant
- Local development DB fallback: SQLite

## 2) Prerequisites

- Python 3.11+ (3.12 recommended)
- Node.js 18+ and npm
- Docker + Docker Compose (optional, but recommended for full stack)

## 3) Quick Start (Docker)

From repository root:

```bash
docker compose up --build
```

If your machine only supports legacy compose:

```bash
docker-compose up --build
```

Endpoints:

- API: `http://localhost:8000`
- Swagger docs: `http://localhost:8000/docs`
- MinIO Console: `http://localhost:9001`
- Qdrant Dashboard: `http://localhost:6333/dashboard`

Frontend (run separately):

```bash
cd frontend
npm install
npm run dev
```

Open: `http://localhost:5173`

## 4) Local Start (Without Docker)

### Backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### Frontend

```bash
cd frontend
npm install
npm run dev
```

### Optional worker + scheduler

```bash
cd backend
source .venv/bin/activate
celery -A app.worker.celery_app worker --loglevel=info
celery -A app.worker.celery_app beat --loglevel=info
```

## 5) Seeding Dummy Data

Backend auto-seeds candidates and jobs on startup when DB is empty.

Manual seed command:

```bash
source backend/.venv/bin/activate && PYTHONPATH=backend python -c "from app.db.base import Base; from app.db.session import engine, SessionLocal; from app.models import entities as _entities; from app.db.seed_data import seed_dummy_data; Base.metadata.create_all(bind=engine); db=SessionLocal(); seed_dummy_data(db); db.close(); print('Seed complete')"
```

## 6) Libraries Used

### Backend (`backend/requirements.txt`)

- `fastapi`: API framework
- `uvicorn`: ASGI server for FastAPI
- `sqlalchemy`: ORM/database access
- `psycopg2-binary`: PostgreSQL driver
- `pydantic`, `pydantic-settings`: schema validation + config management
- `python-multipart`: file upload handling
- `jinja2`: templating support
- `alembic`: database migrations
- `celery`: background jobs/scheduling
- `redis`: Redis client for Celery broker/backend
- `minio`: object storage client for CV files
- `qdrant-client`: vector DB client
- `numpy`: numeric utilities (future scoring/vector use)
- `pypdf`: PDF parser
- `python-docx`: DOCX parser
- `email-validator`: email validation support
- `requests`: HTTP client (Google Drive downloads)

### Frontend (`frontend/package.json`)

- `react`, `react-dom`: UI framework
- `axios`: API HTTP client
- `vite`, `@vitejs/plugin-react`: dev server and build tool

## 7) Data Models (Backend)

Defined in `backend/app/models/entities.py`.

- `Candidate`
  - Candidate profile and parsed resume content (`raw_text`, contact fields, metadata JSON)
- `Job`
  - Job details (`title`, company/location/seniority, description)
- `JobRequirement`
  - Per-job requirement row with type (`mandatory`, `preferred`, `optional`)
- `RequirementScore`
  - Candidate-vs-requirement evaluation (score, confidence, evidence, gap)
- `MatchResult`
  - Final candidate-vs-job aggregated result (score %, level, risk flag, summary, generated interview/outreach content)
- Enums:
  - `RequirementType`: mandatory/preferred/optional
  - `MatchLevel`: strong/moderate/weak

## 8) Backend Module-by-Module Description

- `backend/app/main.py`
  - FastAPI app bootstrap, CORS setup, table initialization, auto-seeding, router registration.

- `backend/app/core/config.py`
  - Centralized settings via environment variables (`DATABASE_URL`, `REDIS_URL`, `MINIO_*`, `QDRANT_URL`).

- `backend/app/db/base.py`
  - SQLAlchemy base class used by all ORM models.

- `backend/app/db/session.py`
  - DB engine and session factory (`SessionLocal`), dependency provider (`get_db`).

- `backend/app/db/seed_data.py`
  - Inserts demo candidates/jobs/requirements for testing.

- `backend/app/models/entities.py`
  - ORM entity definitions and relationships.

- `backend/app/schemas/schemas.py`
  - Pydantic request/response schemas (`CandidateCreate`, `CandidateUpdate`, `JobCreate`, `JobUpdate`, etc.).

- `backend/app/api/routes.py`
  - All API endpoints:
    - Candidate CRUD + upload/import
    - Job CRUD
    - Match run (single + full)
    - Matches listing
    - Dashboard metrics
    - Candidate report CSV

- `backend/app/services/parsers.py`
  - Resume text extraction for PDF, DOCX, CSV.

- `backend/app/services/storage.py`
  - MinIO upload utilities with safe-fail behavior.

- `backend/app/services/scoring.py`
  - Rule-based matching engine:
    - tokenization
    - requirement coverage scoring
    - confidence/evidence generation
    - risk flag for missing mandatory requirements
    - final match level + summary/interview/outreach content

- `backend/app/services/matching.py`
  - Batch runner that matches every candidate against every job.

- `backend/app/worker.py`
  - Celery app and hourly scheduled matching task.

## 9) Frontend Module-by-Module Description

- `frontend/src/App.jsx`
  - Main UI logic and state:
    - dashboard
    - candidate management (create/view/edit/delete)
    - job management (create/view/edit/delete)
    - match listing
    - job-specific and candidate-specific match views

- `frontend/src/styles.css`
  - Global styling, layout, dark mode, table/button/list styles.

- `frontend/src/main.jsx`
  - React app entry point.

- `frontend/scripts/crypto-polyfill.cjs`
  - Polyfill for environments where Vite needs `getRandomValues`.

## 10) Core API Endpoints

Candidates:

- `POST /api/candidates`
- `POST /api/candidates/upload`
- `POST /api/candidates/upload-drive`
- `GET /api/candidates`
- `GET /api/candidates/{candidate_id}`
- `PUT /api/candidates/{candidate_id}`
- `DELETE /api/candidates/{candidate_id}`

Jobs:

- `POST /api/jobs`
- `GET /api/jobs`
- `GET /api/jobs/{job_id}`
- `PUT /api/jobs/{job_id}`
- `DELETE /api/jobs/{job_id}`

Matching/Reporting:

- `POST /api/match/{job_id}/{candidate_id}`
- `POST /api/match/run-all`
- `GET /api/matches`
- `GET /api/dashboard`
- `GET /api/reports/candidate/{candidate_id}.csv`

## 11) Typical Development Flow

1. Start backend + frontend.
2. Seed data (if DB is empty, auto-seed handles this).
3. Create or import candidates/jobs.
4. Run full matching from UI or API.
5. Review job and candidate match details in UI.
6. Export candidate report CSV as needed.

## 12) Troubleshooting

- `ModuleNotFoundError: app`
  - Use `PYTHONPATH=backend` for one-off scripts.
- `no such table`
  - Ensure app has run once or call `Base.metadata.create_all(bind=engine)` before scripts.
- MinIO upload issues
  - Check `MINIO_*` values and service availability.
- Frontend Vite crypto issue
  - Use provided npm scripts (already include polyfill).
