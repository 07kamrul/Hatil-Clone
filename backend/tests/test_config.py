import pytest

from app.core.config import normalize_database_url


@pytest.mark.parametrize(
    "url",
    [
        "postgresql+asyncpg://u:p@h:5432/db",
        "postgresql+psycopg2://u:p@h:5432/db",
        "postgresql://u:p@h:5432/db",
        "postgres://u:p@h:5432/db",
        "postgresql+psycopg://u:p@h:5432/db",
    ],
)
def test_postgres_urls_are_mapped_to_psycopg3(url):
    assert normalize_database_url(url) == "postgresql+psycopg://u:p@h:5432/db"


def test_sqlite_url_is_left_unchanged():
    assert normalize_database_url("sqlite:///dev.db") == "sqlite:///dev.db"


from pydantic import ValidationError  # noqa: E402

from app.core.config import Settings  # noqa: E402

_REAL_SECRET = "a" * 64
_REAL_PASSWORD = "S0me-Real-Admin-Pass!"


@pytest.mark.parametrize("secret", ["__openssl_rand_hex_64__", "replace-with-a-long-random-secret-at-least-32-chars"])
def test_production_rejects_placeholder_jwt_secret_with_clear_message(secret):
    with pytest.raises(ValidationError, match="JWT_SECRET is still a template placeholder"):
        Settings(environment="production", jwt_secret=secret, super_admin_password=_REAL_PASSWORD)


def test_production_rejects_placeholder_admin_password():
    with pytest.raises(ValidationError, match="SUPER_ADMIN_PASSWORD is still a template placeholder"):
        Settings(environment="production", jwt_secret=_REAL_SECRET, super_admin_password="__strong_password__")


def test_production_accepts_real_secrets():
    settings = Settings(environment="production", jwt_secret=_REAL_SECRET, super_admin_password=_REAL_PASSWORD)
    assert settings.jwt_secret == _REAL_SECRET


def test_development_ignores_placeholder_password():
    settings = Settings(environment="development", jwt_secret=_REAL_SECRET, super_admin_password="__strong_password__")
    assert settings.super_admin_password == "__strong_password__"


from app.core.config import find_url_placeholder  # noqa: E402


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("postgresql+psycopg://postgres:__DB_PASSWORD__@h:5432/hatil", "__DB_PASSWORD__"),
        ("postgresql://u:p@__DB_HOST__:5432/db", "__DB_HOST__"),
    ],
)
def test_find_url_placeholder_reports_template_token(url, expected):
    assert find_url_placeholder(url) == expected


def test_find_url_placeholder_returns_none_for_real_url():
    assert find_url_placeholder("postgresql://u:s3cr_et@h:5432/db") is None
