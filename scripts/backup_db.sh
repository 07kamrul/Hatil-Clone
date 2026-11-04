#!/usr/bin/env bash
# Dump the production database to backups/hatil-YYYY-MM-DD.sql before a catalogue import.
# Needs `pg_dump` (same major version as the server) or Docker (uses postgres:$PG_MAJOR-alpine, default 18).
# DATABASE_URL comes from the environment, else from deploy/dokploy/backend.env (gitignored).
#   ./scripts/backup_db.sh
# Restore (plain SQL with --clean, so it REPLACES current data, including admin changes made since the dump):
#   psql "${DATABASE_URL/+psycopg/}" -f backups/hatil-YYYY-MM-DD.sql
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ENV_FILE="${ENV_FILE:-$ROOT/deploy/dokploy/backend.env}"
if [ -z "${DATABASE_URL:-}" ] && [ -f "$ENV_FILE" ]; then
  DATABASE_URL="$(grep -E '^DATABASE_URL=' "$ENV_FILE" | head -1 | cut -d= -f2-)"
fi
: "${DATABASE_URL:?set DATABASE_URL (or fill deploy/dokploy/backend.env)}"
case "$DATABASE_URL" in
  *__*) echo "DATABASE_URL still contains a __placeholder__; fill in the real value" >&2; exit 1 ;;
esac
URL="${DATABASE_URL/+psycopg/}"   # the CLI tools do not understand the SQLAlchemy driver suffix

cd "$ROOT"
git check-ignore -q backups || { echo "backups/ must be listed in .gitignore (dumps hold admin hashes and customer data)" >&2; exit 1; }
mkdir -p backups
umask 077
OUT="backups/hatil-$(date +%F).sql"
trap 'rc=$?; [ "$rc" -eq 0 ] || rm -f "$OUT"' EXIT   # never leave a partial dump behind

DUMP_FLAGS=(--clean --if-exists --no-owner --no-privileges)
if command -v pg_dump >/dev/null 2>&1; then
  pg_dump "${DUMP_FLAGS[@]}" "$URL" -f "$OUT"
else
  command -v docker >/dev/null 2>&1 || { echo "need pg_dump or docker" >&2; exit 1; }
  docker run --rm "postgres:${PG_MAJOR:-18}-alpine" pg_dump "${DUMP_FLAGS[@]}" "$URL" > "$OUT"
fi

[ -s "$OUT" ] || { echo "dump is empty" >&2; exit 1; }
echo "OK: $OUT ($(wc -c < "$OUT" | tr -d ' ') bytes)"
echo "restore: psql \"\${DATABASE_URL/+psycopg/}\" -f $OUT"
