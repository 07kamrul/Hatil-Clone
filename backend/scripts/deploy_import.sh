#!/bin/sh
# Catalogue import run by the backend container on deploy (docker-entrypoint.sh starts it in the background,
# so the API is never blocked). Opt-in through env vars set in Dokploy:
#   CATALOG_IMPORT=off|auto|full   off (default): do nothing.
#                                  auto: first deploy imports everything (`run --all`); later deploys only
#                                        `--resume` pending/failed URLs (no requests when nothing is pending).
#                                  full: always `run --all` (re-fetches every page; use sparingly).
#   CATALOG_IMPORT_BACKUP_CONFIRMED=yes   required: take a DB backup first (scripts/backup_db.sh).
# The scraper is capped at 1 request/second per host regardless of SCRAPER_RPS. Output goes to the container log.
set -eu

log() { echo "[catalog-import] $*"; }

MODE_SETTING="${CATALOG_IMPORT:-off}"
if [ "$MODE_SETTING" = "off" ]; then
  log "disabled (CATALOG_IMPORT=off)"
  exit 0
fi
if [ "${CATALOG_IMPORT_BACKUP_CONFIRMED:-}" != "yes" ]; then
  log "NOT importing: back up the database (scripts/backup_db.sh), then set CATALOG_IMPORT_BACKUP_CONFIRMED=yes"
  exit 0
fi

export SCRAPER_RPS="${SCRAPER_RPS:-1}"
export SCRAPER_OUTPUT_DIR="${SCRAPER_OUTPUT_DIR:-/tmp/scraper_output}"

python - <<'PY'
import glob
import os
import subprocess
import sys

from sqlalchemy import create_engine, text

from app.core.config import normalize_database_url

LOCK_KEY = 7351001  # postgres advisory lock: only one container imports at a time during a rolling deploy


def log(message: str) -> None:
    print(f"[catalog-import] {message}", flush=True)


engine = create_engine(normalize_database_url(os.environ["DATABASE_URL"]))
with engine.connect() as conn:  # the connection stays open (and the lock held) while the scraper runs
    if engine.dialect.name == "postgresql":
        if not conn.execute(text("SELECT pg_try_advisory_lock(:k)"), {"k": LOCK_KEY}).scalar():
            log("another container is already importing; skipping")
            sys.exit(0)
    logged = conn.execute(text("SELECT count(*) FROM scrape_log")).scalar() or 0
    mode = "--all" if os.environ["CATALOG_IMPORT"] == "full" or logged == 0 else "--resume"
    log(f"scrape_log has {logged} rows -> `run {mode}` (1 req/s, output in {os.environ['SCRAPER_OUTPUT_DIR']})")
    result = subprocess.run([sys.executable, "-m", "scripts.scraper", "run", mode], check=False)

reports = sorted(glob.glob(os.path.join(os.environ["SCRAPER_OUTPUT_DIR"], "report-*.md")))
if reports:
    log(f"final report ({reports[-1]}):")
    print(open(reports[-1], encoding="utf-8").read(), flush=True)
log(f"finished with exit code {result.returncode}")
sys.exit(result.returncode)
PY
