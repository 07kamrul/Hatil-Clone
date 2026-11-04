#!/usr/bin/env bash
# Catalogue import run automatically on backend container start (docker-entrypoint.sh launches it in the
# background, so the Dokploy healthcheck never waits on the scraper). Controlled by env vars (Dokploy):
#   CATALOG_IMPORT=auto|off     auto (default): import on deploy; off: do nothing.
#   CATALOG_IMPORT_FORCE=yes    re-run even when /app/data/import.done exists.
#   SCRAPER_RPS=1  SCRAPER_MAX_IMAGES=30
# Behaviour on every run (state lives in DATA_DIR, default /app/data, a persistent volume):
#   - flock on DATA_DIR/import.lock: a second concurrent run logs "import already running" and exits 0.
#   - DATA_DIR/import.done (timestamp + counts): present -> "import already complete", exit 0, unless FORCE.
#   - pg_dump | gzip to DATA_DIR/backups/hatil-<ts>.sql.gz first; a failed/empty dump aborts before scraping.
#   - scrape_log rows > 0 -> `run --resume`, else `run --all` (scripts/scrape_log_count.py).
#   - scraper exit 0 -> scripts/verify_import.sh against the local API, then import.done + import-report.md.
#   - any non-zero exit -> DATA_DIR/import.failed, no done marker; the next redeploy/restart resumes.
# Everything is logged to DATA_DIR/logs/import-<ts>.log and echoed to stdout (Dokploy logs).
set -uo pipefail

log() { echo "[catalog-import] $*"; }

MODE_SETTING="${CATALOG_IMPORT:-auto}"
if [ "$MODE_SETTING" = "off" ]; then
  log "disabled (CATALOG_IMPORT=off)"
  exit 0
fi
if [ "$MODE_SETTING" != "auto" ] && [ "$MODE_SETTING" != "full" ]; then
  log "invalid CATALOG_IMPORT='$MODE_SETTING' (use auto|off); doing nothing"
  exit 0
fi

DATA_DIR="${DATA_DIR:-/app/data}"
BACKUP_DIR="$DATA_DIR/backups"
LOG_DIR="$DATA_DIR/logs"
LOCK_FILE="$DATA_DIR/import.lock"
DONE_FILE="$DATA_DIR/import.done"
FAILED_FILE="$DATA_DIR/import.failed"
REPORT_FILE="$DATA_DIR/import-report.md"
APP_DIR="${APP_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
API_BASE="${IMPORT_API:-http://127.0.0.1:${PORT:-8000}/api/v1}"
KEEP_BACKUPS="${KEEP_BACKUPS:-3}"

mkdir -p "$BACKUP_DIR" "$LOG_DIR" "$DATA_DIR/scraper_output"
RUN_TS="$(date +%Y%m%d-%H%M%S)"
LOG_FILE="$LOG_DIR/import-$RUN_TS.log"
exec > >(tee -a "$LOG_FILE") 2>&1
log "starting (mode=$MODE_SETTING, data dir=$DATA_DIR, log=$LOG_FILE)"
rm -f "$FAILED_FILE"

# --- lock: never let a redeploy start a second scraper -----------------------------------------
exec 9>"$LOCK_FILE"
if ! flock -n 9; then
  log "import already running (lock held on $LOCK_FILE); exiting"
  exit 0
fi

# --- done marker: skip when the first full import finished -------------------------------------
if [ -s "$DONE_FILE" ] && [ "${CATALOG_IMPORT_FORCE:-no}" != "yes" ]; then
  log "import already complete: $(tr '\n' ' ' < "$DONE_FILE")"
  log "delete $DONE_FILE or set CATALOG_IMPORT_FORCE=yes to re-run"
  exit 0
fi

# --- backup: never scrape before a fresh dump is on disk ---------------------------------------
if [ -z "${DATABASE_URL:-}" ]; then
  log "FATAL: DATABASE_URL is not set; refusing to import"
  exit 1
fi
DB_URL_PLAIN="${DATABASE_URL/+asyncpg/}"
DB_URL_PLAIN="${DB_URL_PLAIN/+psycopg/}"   # pg_dump wants plain postgresql:// (no SQLAlchemy driver suffix)
BACKUP_FILE="$BACKUP_DIR/hatil-$RUN_TS.sql.gz"
RAW_DUMP="$BACKUP_DIR/.hatil-$RUN_TS.sql"
log "backing up database to $BACKUP_FILE"
if ! pg_dump --clean --if-exists --no-owner --no-privileges "$DB_URL_PLAIN" > "$RAW_DUMP"; then
  log "FATAL: pg_dump failed; not scraping"
  rm -f "$RAW_DUMP"
  exit 1
fi
if [ ! -s "$RAW_DUMP" ]; then
  log "FATAL: backup dump is empty; not scraping"
  rm -f "$RAW_DUMP"
  exit 1
fi
gzip -c "$RAW_DUMP" > "$BACKUP_FILE" && rm -f "$RAW_DUMP"
log "backup OK ($(wc -c < "$BACKUP_FILE" | tr -d ' ') bytes)"
ls -1t "$BACKUP_DIR"/hatil-*.sql.gz 2>/dev/null | tail -n +$((KEEP_BACKUPS + 1)) | while IFS= read -r old; do
  log "pruning old backup $old"
  rm -f "$old"
done

# --- pg_dump vs server major version (warn only; the apt package is pinned at image build time) ---
server_major="$(python -c 'import os;from sqlalchemy import create_engine,text;e=create_engine(os.environ["DATABASE_URL"]);print(e.connect().execute(text("SHOW server_version")).scalar().split(".")[0])' 2>/dev/null || true)"
dump_major="$(pg_dump --version 2>/dev/null | sed -n 's/.*PostgreSQL) \([0-9]*\).*/\1/p')"
if [ -n "$server_major" ] && [ -n "$dump_major" ] && [ "$server_major" != "$dump_major" ]; then
  log "WARNING: pg_dump major $dump_major != server major $server_major; rebuild the image with postgresql-client-$server_major if dumps misbehave"
fi

# --- mode: resume an interrupted import, or start from scratch ----------------------------------
ROWS="$(python -m scripts.scrape_log_count 2>/dev/null || echo 0)"
case "$ROWS" in
  ''|*[!0-9]*) ROWS=0 ;;
esac
if [ "$MODE_SETTING" = "full" ]; then
  MODE="--all"
elif [ "$ROWS" -gt 0 ]; then
  MODE="--resume"
else
  MODE="--all"
fi
log "scrape_log has $ROWS row(s) -> run $MODE (SCRAPER_RPS=${SCRAPER_RPS:-1}, output in $DATA_DIR/scraper_output)"

export SCRAPER_RPS="${SCRAPER_RPS:-1}"
export SCRAPER_OUTPUT_DIR="$DATA_DIR/scraper_output"
export SCRAPER_MAX_IMAGES="${SCRAPER_MAX_IMAGES:-30}"

cd "$APP_DIR"
SCRAPER_RC=0
python -m scripts.scraper run "$MODE" || SCRAPER_RC=$?
if [ "$SCRAPER_RC" -eq 0 ]; then
  log "running content import (showrooms, banners, pages, FAQs, blog)"
  python -m scripts.scraper content --all >> "$LOG_FILE" 2>&1 || log "WARNING: content import exited non-zero (continuing)"
fi

# --- verify + report ----------------------------------------------------------------------------
REPORT_SRC=""
for f in "$SCRAPER_OUTPUT_DIR"/report-*.md; do [ -e "$f" ] && REPORT_SRC="$f"; done  # newest (glob is sorted)
[ -n "$REPORT_SRC" ] && cp "$REPORT_SRC" "$REPORT_FILE"

if [ "$SCRAPER_RC" -ne 0 ]; then
  log "FAILED: scraper exited $SCRAPER_RC; no done marker (next redeploy/restart resumes automatically)"
  touch "$FAILED_FILE"
  exit "$SCRAPER_RC"
fi

log "scraper finished; verifying against $API_BASE"
VERIFY_RC=0
PYTHON_BIN="$(command -v python)"
VERIFY_ARGS=(--api "$API_BASE" --content)
newest_in() { ls -1t "$1"/$2 2>/dev/null | head -1; }
REPORT_JSON="$(newest_in "$SCRAPER_OUTPUT_DIR" 'products-*.json')"
[ -n "$REPORT_JSON" ] && VERIFY_ARGS+=(--products-json "$REPORT_JSON")
[ -n "$REPORT_SRC" ] && VERIFY_ARGS+=(--report "$REPORT_SRC")
PYTHON="$PYTHON_BIN" OUTPUT_DIR="$SCRAPER_OUTPUT_DIR" \
  "$PYTHON_BIN" -m scripts.verify_import "${VERIFY_ARGS[@]}" || VERIFY_RC=$?

if [ "$VERIFY_RC" -ne 0 ]; then
  log "FAILED: verification exited $VERIFY_RC; no done marker (next redeploy/restart resumes automatically)"
  touch "$FAILED_FILE"
  exit "$VERIFY_RC"
fi

CREATED="$(sed -n 's/^Created: \([0-9]*\).*/\1/p' "$REPORT_FILE" | tail -1)"
UPDATED="$(sed -n 's/^Updated: \([0-9]*\).*/\1/p' "$REPORT_FILE" | tail -1)"
FAILED_COUNT="$(sed -n 's/^Failed: \([0-9]*\).*/\1/p' "$REPORT_FILE" | tail -1)"
{
  echo "completed: $(date -u +%FT%TZ)"
  echo "mode: $MODE"
  echo "created: ${CREATED:-?}  updated: ${UPDATED:-?}  failed: ${FAILED_COUNT:-?}"
  echo "backup: $BACKUP_FILE"
  echo "report: $REPORT_FILE"
} > "$DONE_FILE"
log "done: created=${CREATED:-?} updated=${UPDATED:-?} failed=${FAILED_COUNT:-?}; marker written to $DONE_FILE"
rm -f "$FAILED_FILE"
log "verify the site, then set CATALOG_IMPORT=off in the deploy environment"
