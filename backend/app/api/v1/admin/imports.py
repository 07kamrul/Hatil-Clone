"""Read-only status of the automatic catalogue import (scripts/deploy_import.sh).

GET /api/v1/admin/import/status -> running|done|failed|off, the last log tail (200 lines) and the report.
"""

import os
import re
from pathlib import Path

try:  # Unix-only; the lock check degrades gracefully on Windows dev machines
    import fcntl
except ImportError:  # pragma: no cover - platform specific
    fcntl = None  # type: ignore[assignment]

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()

LOG_TAIL_LINES = 200
_LOG_NAME = re.compile(r"^import-(\d{8}-\d{6})\.log$")


def _data_dir() -> Path:
    return Path(os.getenv("DATA_DIR", "/app/data"))


def _is_running(lock_file: Path) -> bool:
    """True when another process currently holds the import flock."""
    if fcntl is None or not lock_file.exists():
        return False
    try:
        fd = os.open(lock_file, os.O_RDWR)
    except OSError:
        return False
    try:
        fcntl.flock(fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        return True
    else:
        fcntl.flock(fd, fcntl.LOCK_UN)
        return False
    finally:
        os.close(fd)


def _newest_log(log_dir: Path) -> Path | None:
    candidates = sorted(
        (m.group(1), p) for p in log_dir.glob("import-*.log") if (m := _LOG_NAME.match(p.name))
    )
    return candidates[-1][1] if candidates else None


def _read_tail(path: Path, lines: int = LOG_TAIL_LINES) -> str | None:
    try:
        return "\n".join(path.read_text(encoding="utf-8", errors="replace").splitlines()[-lines:])
    except OSError:
        return None


class ImportStatus(BaseModel):
    status: str
    completed: str | None = None
    report: str | None = None
    last_log_tail: str | None = None


@router.get("/import/status")
def import_status() -> ImportStatus:
    data_dir = _data_dir()
    if os.getenv("CATALOG_IMPORT", "auto").lower() == "off":
        return ImportStatus(status="off")

    lock_file = data_dir / "import.lock"
    done_file = data_dir / "import.done"
    failed_file = data_dir / "import.failed"
    log_dir = data_dir / "logs"

    status = "done" if done_file.exists() else "failed" if failed_file.exists() else "running"
    if status == "running" and not _is_running(lock_file):
        status = "failed"  # a previous run died without finishing (no done marker, lock free)
    if status == "done" and _is_running(lock_file):
        status = "running"  # a forced re-run is in progress

    completed: str | None = None
    if done_file.exists():
        for line in done_file.read_text(encoding="utf-8", errors="replace").splitlines():
            if line.startswith("completed:"):
                completed = line.split(":", 1)[1].strip()
                break

    newest = _newest_log(log_dir)
    return ImportStatus(
        status=status,
        completed=completed,
        report=_read_tail(data_dir / "import-report.md"),
        last_log_tail=_read_tail(newest) if newest else None,
    )
