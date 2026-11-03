"""Auto-provision deploy secrets so a fresh deploy needs no manual `openssl` step.

Run by docker-entrypoint.sh before migrations. For each managed secret whose env value is
missing or still a template placeholder, a strong random value is generated once, stored in
the `deploy_secrets` table (the database is the only state every deploy already persists),
and reused on every later deploy. Prints `export NAME='value'` lines for the shell to eval.

A real value set in the environment always wins and is never written to the database.
"""

import os
import secrets
import sys
from collections.abc import Callable

from sqlalchemy import Engine, create_engine, text
from sqlalchemy.exc import IntegrityError

from app.core.config import is_placeholder, normalize_database_url

TABLE_NAME = "deploy_secrets"
JWT_SECRET_BYTES = 64
ADMIN_PASSWORD_BYTES = 18

# env var name -> generator for a fresh value
MANAGED_SECRETS: dict[str, Callable[[], str]] = {
    "JWT_SECRET": lambda: secrets.token_hex(JWT_SECRET_BYTES),
    "SUPER_ADMIN_PASSWORD": lambda: secrets.token_urlsafe(ADMIN_PASSWORD_BYTES),
}

_SELECT = text(f"SELECT value FROM {TABLE_NAME} WHERE name = :name")  # noqa: S608 - constant table name
_INSERT = text(f"INSERT INTO {TABLE_NAME} (name, value) VALUES (:name, :value)")  # noqa: S608


def needs_value(value: str | None) -> bool:
    return value is None or not value.strip() or is_placeholder(value)


def _ensure_table(engine: Engine) -> None:
    with engine.begin() as conn:
        conn.execute(text(
            f"CREATE TABLE IF NOT EXISTS {TABLE_NAME} "
            "(name VARCHAR(64) PRIMARY KEY, value TEXT NOT NULL)"
        ))


def _load_or_create(engine: Engine, name: str, generate: Callable[[], str]) -> tuple[str, bool]:
    """Return (value, created). Race-safe: if another replica inserts first, its value is used."""
    with engine.begin() as conn:
        stored = conn.execute(_SELECT, {"name": name}).scalar_one_or_none()
    if stored is not None:
        return stored, False
    value = generate()
    try:
        with engine.begin() as conn:
            conn.execute(_INSERT, {"name": name, "value": value})
    except IntegrityError:
        with engine.begin() as conn:
            return conn.execute(_SELECT, {"name": name}).scalar_one(), False
    return value, True


def resolve_secrets(engine: Engine, env: dict[str, str | None]) -> dict[str, tuple[str, bool]]:
    """Return {name: (value, created)} for every managed secret the environment lacks."""
    missing = {name: gen for name, gen in MANAGED_SECRETS.items() if needs_value(env.get(name))}
    if not missing:
        return {}
    _ensure_table(engine)
    return {name: _load_or_create(engine, name, gen) for name, gen in missing.items()}


def _shell_quote(value: str) -> str:
    return "'" + value.replace("'", "'\"'\"'") + "'"


def _report(name: str, value: str, created: bool) -> None:
    if not created:
        message = f"{name}: using value stored in {TABLE_NAME}"
    elif name == "SUPER_ADMIN_PASSWORD":
        message = f"generated SUPER_ADMIN_PASSWORD (shown once, save it): {value}"
    else:
        message = f"generated {name} and stored it in {TABLE_NAME}"
    print(f"[secrets] {message}", file=sys.stderr)


def main() -> int:
    engine = create_engine(normalize_database_url(os.environ["DATABASE_URL"]))
    for name, (value, created) in resolve_secrets(engine, dict(os.environ)).items():
        print(f"export {name}={_shell_quote(value)}")
        _report(name, value, created)
    return 0


if __name__ == "__main__":
    sys.exit(main())
