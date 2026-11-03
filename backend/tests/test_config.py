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
