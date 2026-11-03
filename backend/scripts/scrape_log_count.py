"""Print the number of rows in scrape_log (0 when the table is missing or the DB is unreachable).

Used by scripts/deploy_import.sh to pick `--resume` (rows exist) vs `--all` (fresh DB).
"""

import os
import sys

from sqlalchemy import create_engine, text

from app.core.config import normalize_database_url


def main() -> int:
    url = os.environ.get("DATABASE_URL")
    if not url:
        print("DATABASE_URL is not set", file=sys.stderr)
        return 1
    try:
        with create_engine(normalize_database_url(url)).connect() as conn:
            print(conn.execute(text("SELECT count(*) FROM scrape_log")).scalar() or 0)
    except Exception as exc:  # noqa: BLE001 - the caller treats any failure as "start from scratch"
        print(f"could not read scrape_log: {exc}", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
