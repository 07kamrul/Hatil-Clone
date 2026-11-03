#!/bin/sh
# Backend container entrypoint. Runs automatically on every deploy (docker compose / Dokploy):
#   1. wait for the database to accept connections
#   2. apply migrations (alembic upgrade head)
#   3. seed idempotently (super admin, settings, taxonomy; demo products when SEED_DEMO=true)
#   4. start the API
# Any other command (e.g. `docker compose run --rm backend pytest`) runs after step 1 only.
set -eu

DB_WAIT_SECONDS="${DB_WAIT_SECONDS:-60}"

log() { echo "[entrypoint] $*"; }

wait_for_db() {
  log "waiting for database (up to ${DB_WAIT_SECONDS}s)"
  python - <<'PY'
import os, sys, time
from sqlalchemy import create_engine, text

from app.core.config import normalize_database_url

deadline = time.monotonic() + int(os.environ.get("DB_WAIT_SECONDS", "60"))
engine = create_engine(normalize_database_url(os.environ["DATABASE_URL"]), pool_pre_ping=True)
while True:
    try:
        with engine.connect() as conn:
            conn.execute(text("SELECT 1"))
        break
    except Exception as exc:  # noqa: BLE001 - any connection error means "not ready yet"
        if time.monotonic() > deadline:
            print(f"[entrypoint] database not reachable: {exc}", file=sys.stderr)
            sys.exit(1)
        time.sleep(2)
PY
  log "database is ready"
}

ensure_secrets() {
  # Placeholder/missing JWT_SECRET or SUPER_ADMIN_PASSWORD -> generated once, kept in the DB.
  log "ensuring secrets"
  exports="$(python -m scripts.ensure_secrets)"
  eval "$exports"
}

migrate() {
  log "alembic upgrade head"
  alembic upgrade head
}

seed() {
  if [ "${SEED_DEMO:-false}" = "true" ]; then
    log "seeding (with demo products)"
    python -m scripts.seed --demo
  else
    log "seeding"
    python -m scripts.seed
  fi
}

serve() {
  log "starting API"
  exec uvicorn app.main:app --host 0.0.0.0 --port 8000 --proxy-headers --forwarded-allow-ips='*'
}

wait_for_db
ensure_secrets

if [ "$#" -eq 0 ] || [ "$1" = "serve" ]; then
  migrate
  seed
  serve
fi

exec "$@"
