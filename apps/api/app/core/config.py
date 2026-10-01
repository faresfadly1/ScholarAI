from functools import lru_cache

from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")
    environment: str = "development"
    database_url: str = "sqlite:///./.data/scholarai.db"
    redis_url: str = ""
    app_url: str = "http://localhost:3000"
    jwt_secret: str = ""
    task_mode: str = "local"
    storage_backend: str = "local"
    storage_path: str = ".data/objects"
    s3_endpoint: str = "http://minio:9000"
    s3_region: str = "us-east-1"
    s3_access_key: str = ""
    s3_secret_key: str = ""
    s3_bucket: str = "scholarai"
    llm_provider: str = "mock"
    llm_api_key: str = ""
    llm_base_url: str = "https://api.openai.com/v1"
    llm_chat_model: str = ""
    llm_embedding_model: str = ""
    embedding_dimensions: int = 1536
    max_upload_mb: int = 15
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@scholarai.example"
    demo_password: str = ""
    internal_proxy_secret: str = ""
    free_deployment_mode: bool = False
    gemini_api_key: str = ""
    resend_api_key: str = ""

    @field_validator("database_url", mode="before")
    @classmethod
    def use_psycopg_driver(cls, value):
        if isinstance(value, str):
            if value.startswith("postgres://"):
                return value.replace("postgres://", "postgresql+psycopg://", 1)
            if value.startswith("postgresql://"):
                return value.replace("postgresql://", "postgresql+psycopg://", 1)
        return value


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
