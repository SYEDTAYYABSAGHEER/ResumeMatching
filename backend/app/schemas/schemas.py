from pydantic import BaseModel, Field


class CandidateCreate(BaseModel):
    full_name: str
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    current_title: str | None = None
    years_of_experience: float = 0
    raw_text: str = ''


class CandidateUpdate(BaseModel):
    full_name: str | None = None
    email: str | None = None
    phone: str | None = None
    location: str | None = None
    current_title: str | None = None
    years_of_experience: float | None = None
    raw_text: str | None = None


class JobRequirementIn(BaseModel):
    requirement_text: str
    requirement_type: str = Field(default='preferred')


class JobCreate(BaseModel):
    title: str
    company: str | None = None
    location: str | None = None
    seniority: str | None = None
    description_text: str
    requirements: list[JobRequirementIn]


class JobUpdate(BaseModel):
    title: str | None = None
    company: str | None = None
    location: str | None = None
    seniority: str | None = None
    description_text: str | None = None


class MatchResponse(BaseModel):
    candidate_id: int
    job_id: int
    total_score_percent: float
    match_level: str
    risk_flag: bool
    summary: str
    interview_questions: list[str]
    outreach_email: str
