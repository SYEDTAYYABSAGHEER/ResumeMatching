import enum
from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Enum, Float, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RequirementType(str, enum.Enum):
    mandatory = 'mandatory'
    preferred = 'preferred'
    optional = 'optional'


class MatchLevel(str, enum.Enum):
    strong = 'strong'
    moderate = 'moderate'
    weak = 'weak'


class Candidate(Base):
    __tablename__ = 'candidates'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), index=True)
    email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    phone: Mapped[str | None] = mapped_column(String(100), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    current_title: Mapped[str | None] = mapped_column(String(255), nullable=True)
    years_of_experience: Mapped[float] = mapped_column(Float, default=0.0)
    raw_text: Mapped[str] = mapped_column(Text, default='')
    profile_json: Mapped[dict] = mapped_column(JSON, default=dict)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    scores = relationship('RequirementScore', back_populates='candidate', cascade='all, delete-orphan')


class Job(Base):
    __tablename__ = 'jobs'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    title: Mapped[str] = mapped_column(String(255), index=True)
    company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    seniority: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description_text: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    requirements = relationship('JobRequirement', back_populates='job', cascade='all, delete-orphan')


class JobRequirement(Base):
    __tablename__ = 'job_requirements'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    job_id: Mapped[int] = mapped_column(ForeignKey('jobs.id'))
    requirement_text: Mapped[str] = mapped_column(Text)
    requirement_type: Mapped[RequirementType] = mapped_column(Enum(RequirementType), default=RequirementType.preferred)

    job = relationship('Job', back_populates='requirements')
    scores = relationship('RequirementScore', back_populates='requirement', cascade='all, delete-orphan')


class RequirementScore(Base):
    __tablename__ = 'requirement_scores'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey('candidates.id'))
    job_id: Mapped[int] = mapped_column(ForeignKey('jobs.id'))
    requirement_id: Mapped[int] = mapped_column(ForeignKey('job_requirements.id'))

    score: Mapped[float] = mapped_column(Float, default=0.0)
    confidence: Mapped[str] = mapped_column(String(50), default='Low')
    evidence: Mapped[str] = mapped_column(Text, default='')
    gap_type: Mapped[str] = mapped_column(String(100), default='Clearly Missing')
    notes: Mapped[str] = mapped_column(Text, default='')

    candidate = relationship('Candidate', back_populates='scores')
    requirement = relationship('JobRequirement', back_populates='scores')


class MatchResult(Base):
    __tablename__ = 'match_results'

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    candidate_id: Mapped[int] = mapped_column(ForeignKey('candidates.id'))
    job_id: Mapped[int] = mapped_column(ForeignKey('jobs.id'))
    total_score_percent: Mapped[float] = mapped_column(Float, default=0.0)
    match_level: Mapped[MatchLevel] = mapped_column(Enum(MatchLevel), default=MatchLevel.weak)
    risk_flag: Mapped[bool] = mapped_column(Boolean, default=False)
    summary: Mapped[str] = mapped_column(Text, default='')
    interview_questions: Mapped[list] = mapped_column(JSON, default=list)
    outreach_email: Mapped[str] = mapped_column(Text, default='')
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
