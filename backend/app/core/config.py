from functools import lru_cache
from typing import Annotated

from pydantic import Field, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Development-only placeholders; production startup refuses to run with them.
_DEV_JWT_SECRET = "dev-only-insecure-jwt-secret-change-me-0000"  # noqa: S105
_DEV_ADMIN_PASSWORD = "ChangeMe123!"  # noqa: S105


def _split_csv(value: object) -> object:
    if isinstance(value, str):
        return [part.strip() for part in value.split(",") if part.strip()]
    return value


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    environment: str = "development"
    database_url: str = "postgresql+psycopg://furniture:furniture@localhost:5432/furniture"

    jwt_secret: str = Field(default=_DEV_JWT_SECRET, min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7

    super_admin_email: str = "admin@example.com"
    super_admin_password: str = _DEV_ADMIN_PASSWORD

    cors_origins: Annotated[list[str], NoDecode] = ["http://localhost:4200", "http://localhost"]
    public_base_url: str = "http://localhost"

    upload_dir: str = "uploads"
    upload_url_prefix: str = "/uploads"
    storage_backend: str = "local"  # local | s3
    s3_bucket: str = ""
    s3_region: str = ""
    s3_public_url: str = ""
    max_upload_mb: int = 10
    thumbnail_size: int = 400

    rate_limit_public_post: str = "5/minute"
    rate_limit_login: str = "10/minute"
    rate_limit_enabled: bool = True

    # Rebranding: when "neutral", imported text has source brand terms replaced by the site name.
    brand_mode: str = "neutral"
    brand_source_terms: Annotated[list[str], NoDecode] = ["HATIL", "Hatil", "hatil"]
    default_site_name: str = "Casa Furnish"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@example.com"
    admin_notify_email: str = ""

    _split_lists = field_validator("cors_origins", "brand_source_terms", mode="before")(_split_csv)

    @model_validator(mode="after")
    def _no_placeholder_secrets_in_production(self) -> "Settings":
        if self.environment == "production":
            if self.jwt_secret == _DEV_JWT_SECRET or self.super_admin_password == _DEV_ADMIN_PASSWORD:
                raise ValueError("Set JWT_SECRET and SUPER_ADMIN_PASSWORD before running in production")
        return self

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


@lru_cache
def get_settings() -> Settings:
    return Settings()
