#!/usr/bin/env bash
# Copy locally scraped images to the production `hatil-uploads` volume (alternative path in
# docs/PRODUCTION_IMPORT.md). Dry run by default; pass --apply to copy. Never deletes anything remote.
#
#   REMOTE=user@server ./scripts/sync_uploads.sh            # show what would be copied
#   REMOTE=user@server ./scripts/sync_uploads.sh --apply    # copy
#
# Env: REMOTE (required), LOCAL_DIR (default backend/uploads), REMOTE_PATH (default: the volume's host path,
# confirm on the server with `docker volume inspect hatil-uploads`).
set -euo pipefail

: "${REMOTE:?set REMOTE=user@host}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
LOCAL_DIR="${LOCAL_DIR:-$ROOT/backend/uploads}"
REMOTE_PATH="${REMOTE_PATH:-/var/lib/docker/volumes/hatil-uploads/_data}"

[ -d "$LOCAL_DIR" ] || { echo "local uploads dir not found: $LOCAL_DIR" >&2; exit 1; }

MODE="--dry-run"
[ "${1:-}" = "--apply" ] && MODE=""

# --ignore-existing: files already on the server (e.g. admin uploads) are never overwritten.
# sudo on the remote end because docker volumes are root-owned; no --delete on purpose.
rsync -avz --partial --ignore-existing --itemize-changes $MODE \
  --rsync-path="sudo rsync" \
  "$LOCAL_DIR"/ "$REMOTE:$REMOTE_PATH"/

[ -z "$MODE" ] || echo "dry run only; re-run with --apply to copy"
