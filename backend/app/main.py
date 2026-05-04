from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.db.base import Base
from app.db.seed_data import seed_dummy_data
from app.db.session import engine
from app.db.session import SessionLocal

Base.metadata.create_all(bind=engine)
with SessionLocal() as db:
    seed_dummy_data(db)

app = FastAPI(title='Resume Matching Agent')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(router)
