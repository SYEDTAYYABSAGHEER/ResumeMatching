from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file='.env', env_file_encoding='utf-8', extra='ignore')

    app_name: str = 'Resume Matching Agent'
    database_url: str = 'sqlite:///./resume_matching.db'
    redis_url: str = 'redis://localhost:6379/0'
    secret_key: str = 'change-me'

    minio_endpoint: str = 'localhost:9000'
    minio_access_key: str = 'minioadmin'
    minio_secret_key: str = 'minioadmin'
    minio_bucket: str = 'resumes'

    qdrant_url: str = 'http://localhost:6333'


settings = Settings()
