# Resume Matching Agent (Open-Source MVP)

Ready-to-run product implementing your CV matching spec with open-source components only.

## What's Included

- CV/JD ingestion endpoints
- CV upload from local file and Google Drive public links
- Requirement-level scoring with confidence and evidence tokens
- Mandatory requirement risk flags
- Match levels and shortlist thresholds
- Recruiter summary, interview question generation, outreach email draft
- Hourly continuous matching using Celery Beat
- Open-source infra via Docker: PostgreSQL, Redis, MinIO, Qdrant
- React frontend for candidate/job creation and match results

## Run

```bash
docker compose up --build
```

Services:

- API: http://localhost:8000
- API docs: http://localhost:8000/docs
- Frontend (manual): `cd frontend && npm install && npm run dev` then open http://localhost:5173
- MinIO: http://localhost:9001
- Qdrant: http://localhost:6333/dashboard

## Run Without Docker

You can run everything locally. For local mode, the backend uses SQLite by default.

### 1) Backend (local)

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

Open:

- API: http://localhost:8000
- API docs: http://localhost:8000/docs

### 2) Frontend (local)

```bash
cd frontend
npm install
npm run dev
```

Open:

- Frontend: http://localhost:5173

If your machine shows a Vite crypto error (`getRandomValues is not a function`), this project already includes a startup polyfill in `frontend/scripts/crypto-polyfill.cjs` and the npm scripts use it automatically.

### 3) Optional local worker/scheduler

If you want hourly background matching locally, run Redis first, then start worker + beat:

```bash
cd backend
source .venv/bin/activate
celery -A app.worker.celery_app worker --loglevel=info
celery -A app.worker.celery_app beat --loglevel=info
```

If you do not run worker/scheduler, manual matching still works via:

- `POST /api/match/run-all`

## Key APIs

- `POST /api/candidates`
- `POST /api/candidates/upload`
- `POST /api/candidates/upload-drive`
- `GET /api/candidates`
- `GET /api/candidates/{candidate_id}`
- `PUT /api/candidates/{candidate_id}`
- `DELETE /api/candidates/{candidate_id}`
- `POST /api/jobs`
- `GET /api/jobs`
- `GET /api/jobs/{job_id}`
- `PUT /api/jobs/{job_id}`
- `DELETE /api/jobs/{job_id}`
- `POST /api/match/{job_id}/{candidate_id}`
- `POST /api/match/run-all`
- `GET /api/matches`

## Notes

- Scoring currently uses deterministic open-source rule logic (no paid LLM).
- You can later plug in Ollama/vLLM model calls inside `app/services/scoring.py`.
- Local mode is fully supported without Docker; Docker is optional.
- Resume upload parser supports `PDF`, `DOCX`, and `CSV`.
- Uploaded resume files are stored in MinIO when MinIO is configured and reachable.
- Google Drive upload requires a public share link.
- On first startup with an empty DB, the backend auto-seeds dummy Candidates and Jobs for quick testing.
