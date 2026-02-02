"""Application configuration using Pydantic Settings."""
from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    """Application settings loaded from environment variables."""

    # Meta WhatsApp API
    meta_jwt_token: str = ""
    meta_number_id: str = ""
    meta_verify_token: str = ""
    meta_version: str = "v21.0"

    # Grok AI
    xai_api_key: str = ""

    # Google Services
    google_sheet_id: str = ""
    google_credentials_path: str = "./google-credentials.json"
    meet_link: str = ""
    karuna_email: str = ""

    # Server
    port: int = 3008
    environment: str = "development"
    frontend_url: str = "http://localhost:5173"

    # Config file path
    config_file_path: str = "./config/bot-config.json"

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance."""
    return Settings()
