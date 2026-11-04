#!/bin/sh
# Backend container entrypoint. Runs automatically on every deploy (docker compose / Dokploy):
#   1. wait for the database to accept connections
#   2. apply migrations (alembic upgrade head)
#   3. seed idempotently (super admin, settings, taxonomy; demo products when SEED_DEMO=true)
#   4. import the Sahat Al Ramlah Facebook page content + images once (COMPANY_IMPORT)
#   5. start the API (any hatil.com catalogue scrape runs in the background, never blocking the healthcheck)
# Any other command (e.g. `docker compose run --rm backend pytest`) runs after step 1 only.
set -eu

DB_WAIT_SECONDS="${DB_WAIT_SECONDS:-60}"

log() { echo "[entrypoint] $*"; }

wait_for_db() {
  log "waiting for database (up to ${DB_WAIT_SECONDS}s)"
  python - <<'PY'
import os, sys, time
from sqlalchemy import create_engine, text

from app.core.config import find_url_placeholder, normalize_database_url

placeholder = find_url_placeholder(os.environ["DATABASE_URL"])
if placeholder:
    print(f"[entrypoint] DATABASE_URL still contains the template value {placeholder}; "
          "set the real value in the deploy environment", file=sys.stderr)
    sys.exit(1)

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

import_company() {
  # COMPANY_IMPORT=auto (default): load the bundled Facebook page content (logo, banners, categories,
  # products, posts, images) on the first deploy, then skip via DATA_DIR/company.done so admin edits survive
  # redeploys. force: re-run and overwrite; off: never. It is local-only (no network) and takes seconds.
  mode="${COMPANY_IMPORT:-auto}"
  marker="${DATA_DIR:-/app/data}/company.done"
  [ "$mode" = "off" ] && return 0
  if [ "$mode" = "auto" ] && [ -s "$marker" ]; then
    log "company content already imported ($(cat "$marker")); set COMPANY_IMPORT=force to re-run"
    return 0
  fi
  log "importing company content from the Facebook page (COMPANY_IMPORT=$mode)"
  if python -m scripts.seed_company; then
    mkdir -p "$(dirname "$marker")" && date -u +%FT%TZ > "$marker"
  else
    log "WARNING: company import failed; the API will still start and the next deploy retries"
  fi
}

start_catalog_import() {
  # CATALOG_IMPORT=auto or full (default off: it scrapes hatil.com and would replace the company content): runs in the background so the API starts and
  # passes the Dokploy healthcheck immediately; see scripts/deploy_import.sh. The script takes its own
  # flock, backs the DB up, resumes or starts the scrape, verifies, and writes /app/data/import.done.
  if [ "${CATALOG_IMPORT:-off}" != "off" ]; then
    log "catalog import requested (CATALOG_IMPORT=${CATALOG_IMPORT}); running in the background"
    nohup bash scripts/deploy_import.sh &
  fi
}

serve() {
  log "starting API on port ${PORT:-8000}"
  exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}" --proxy-headers --forwarded-allow-ips='*'
}

wait_for_db
ensure_secrets

if [ "$#" -eq 0 ] || [ "$1" = "serve" ]; then
  migrate
  seed
  import_company
  start_catalog_import
  serve
fi

exec "$@"
