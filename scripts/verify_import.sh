#!/usr/bin/env bash
# Verify a catalogue import against the live API and source site (read-only). Wraps backend/scripts/verify_import.py.
#   ./scripts/verify_import.sh                         # uses the newest report/products json it can find
#   API=https://host/api/v1 OUTPUT_DIR=./scraper_output ./scripts/verify_import.sh --samples 20 --spot 5
# Env: API (default the production API), OUTPUT_DIR (where report-*.md / products-*.json are; default
# backend/scraper_output, else /tmp/scraper_output), PYTHON (default backend/.venv/bin/python, else python3).
# Extra arguments are passed through. Exit code is non-zero when a check fails.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
API="${API:-https://hatilapi.anshintech.dpdns.org/api/v1}"
OUTPUT_DIR="${OUTPUT_DIR:-$ROOT/backend/scraper_output}"
[ -d "$OUTPUT_DIR" ] || OUTPUT_DIR=/tmp/scraper_output
PYTHON="${PYTHON:-$ROOT/backend/.venv/bin/python}"
[ -x "$PYTHON" ] || PYTHON="$(command -v python3)"

newest() { ls -1t "$OUTPUT_DIR"/$1 2>/dev/null | head -1 || true; }
REPORT="$(newest 'report-*.md')"
PRODUCTS="$(newest 'products-*.json')"

ARGS=(--api "$API")
if [ -n "$REPORT" ]; then ARGS+=(--report "$REPORT"); else echo "note: no report-*.md in $OUTPUT_DIR; skipping the count comparison" >&2; fi
if [ -n "$PRODUCTS" ]; then ARGS+=(--products-json "$PRODUCTS"); else echo "note: no products-*.json in $OUTPUT_DIR; skipping the live spot-check" >&2; fi

cd "$ROOT/backend"
exec "$PYTHON" -m scripts.verify_import "${ARGS[@]}" "$@"
