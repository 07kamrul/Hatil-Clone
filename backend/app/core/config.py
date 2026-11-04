import re
from functools import lru_cache
from typing import Annotated

from pydantic import Field, ValidationInfo, field_validator, model_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

# Development-only placeholders; production startup refuses to run with them.
_DEV_JWT_SECRET = "dev-only-insecure-jwt-secret-change-me-0000"  # noqa: S105
_DEV_ADMIN_PASSWORD = "ChangeMe123!"  # noqa: S105


# The app uses sync SQLAlchemy + psycopg 3; map other Postgres schemes (asyncpg, psycopg2,
# bare postgres://) that hosting panels commonly generate onto the installed driver.
_PG_SCHEME_ALIASES = ("postgresql+asyncpg://", "postgresql+psycopg2://", "postgresql://", "postgres://")
_PG_SCHEME = "postgresql+psycopg://"


def normalize_database_url(url: str) -> str:
    for alias in _PG_SCHEME_ALIASES:
        if url.startswith(alias):
            return _PG_SCHEME + url[len(alias):]
    return url


_URL_TEMPLATE_TOKEN = re.compile(r"__[A-Za-z0-9_]*[A-Za-z0-9]__")


def find_url_placeholder(url: str) -> str | None:
    """Return the first unfilled `__TOKEN__` in a URL (e.g. `__DB_PASSWORD__`), else None."""
    match = _URL_TEMPLATE_TOKEN.search(url)
    return match.group(0) if match else None


# Values copied unedited from .env.example / deploy/dokploy/backend.env.example.
_PLACEHOLDER_PREFIXES = ("replace-with", "changeme", "change-me")


def is_placeholder(value: str) -> bool:
    lowered = value.strip().lower()
    is_dunder_template = len(lowered) > 4 and lowered.startswith("__") and lowered.endswith("__")
    return is_dunder_template or lowered.startswith(_PLACEHOLDER_PREFIXES)


def _reject_placeholder_in_production(value: object, info: ValidationInfo) -> object:
    if info.data.get("environment") == "production" and isinstance(value, str) and is_placeholder(value):
        env_name = (info.field_name or "").upper()
        hint = " (generate one with `openssl rand -hex 64`)" if env_name == "JWT_SECRET" else ""
        raise ValueError(f"{env_name} is still a template placeholder; set a real value{hint}")
    return value


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

    cache_enabled: bool = True
    cache_ttl_seconds: int = 300
    cache_max_entries: int = 1000

    # Rebranding: when "neutral", imported text has source brand terms replaced by the site name.
    brand_mode: str = "neutral"
    brand_source_terms: Annotated[list[str], NoDecode] = ["HATIL", "Hatil", "hatil"]
    default_site_name: str = "Sahat Al Ramlah Furniture"

    smtp_host: str = ""
    smtp_port: int = 587
    smtp_user: str = ""
    smtp_password: str = ""
    smtp_from: str = "noreply@example.com"
    admin_notify_email: str = ""

    _normalize_db_url = field_validator("database_url", mode="before")(
        lambda v: normalize_database_url(v) if isinstance(v, str) else v
    )
    _no_placeholders = field_validator("jwt_secret", "super_admin_password", mode="before")(
        _reject_placeholder_in_production
    )
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
