"""Tests for scripts/deploy_import.sh (fully offline).

Fakes are injected via PATH: `python` (scrape_log_count / scraper / verify_import / server_version),
`pg_dump` (records its URL, can fail or emit nothing) and `flock` (macOS has no real flock; the shim
either grants the lock or reports it held, which is all the script depends on).
"""

import os
import subprocess
from pathlib import Path
from typing import Any

import pytest
from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD

SCRIPT = Path(__file__).resolve().parents[1] / "scripts" / "deploy_import.sh"
BACKEND_DIR = Path(__file__).resolve().parents[1]
FAKE_URL = "postgresql://user:pass@localhost:5432/fake"

PYTHON_SHIM = r"""#!/usr/bin/env bash
echo "python $*" >> "$CALL_LOG"
case " $* " in
  *" -m scripts.scrape_log_count "*) echo "${FAKE_ROWS:-0}"; exit 0 ;;
  *" -m scripts.scraper "*)
    echo "${@: -1}" >> "$SCRAPER_MODE_FILE"
    mkdir -p "$SCRAPER_OUTPUT_DIR"
    printf 'Attempted: 12\nCreated: 10\nUpdated: 1\nFailed: 1\n' > "$SCRAPER_OUTPUT_DIR/report-001.md"
    exit "${SCRAPER_EXIT:-0}" ;;
  *" -m scripts.verify_import "*) exit "${VERIFY_EXIT:-0}" ;;
  *"SHOW\ server_version"*|*SHOW*server_version*) echo "15.6"; exit 0 ;;
  *) exit 0 ;;
esac
"""

PG_DUMP_SHIM = r"""#!/usr/bin/env bash
if [ "$1" = "--version" ]; then echo 'pg_dump (PostgreSQL) 15.2'; exit 0; fi
echo "$*" > "$PGDUMP_ARGS_FILE"
[ "${PGDUMP_RC:-0}" != "0" ] && exit "${PGDUMP_RC}"
[ "${PGDUMP_EMPTY:-0}" = "1" ] || echo "-- fake dump --"
exit 0
"""

FLOCK_SHIM = r"""#!/usr/bin/env bash
[ "${LOCK_HELD:-0}" = "1" ] && exit 1
exit 0
"""


def _write_shims(bin_dir: Path) -> None:
    for name, body in (("python", PYTHON_SHIM), ("pg_dump", PG_DUMP_SHIM), ("flock", FLOCK_SHIM)):
        path = bin_dir / name
        path.write_text(body)
        path.chmod(0o755)


@pytest.fixture
def paths(tmp_path: Path) -> dict[str, Path]:
    d = {
        "bin": tmp_path / "bin",
        "data": tmp_path / "data",
        "call_log": tmp_path / "calls.log",
        "scraper_mode": tmp_path / "scraper-mode.txt",
        "pgdump_args": tmp_path / "pgdump-args.txt",
    }
    d["bin"].mkdir()
    _write_shims(d["bin"])
    return d  # type: ignore[return-value]


def run_import(paths: dict[str, Path], **env: Any) -> subprocess.CompletedProcess[str]:
    full_env = {
        **os.environ,
        "PATH": f"{paths['bin']}:{os.environ['PATH']}",
        "DATA_DIR": str(paths["data"]),
        "APP_DIR": str(BACKEND_DIR),
        "DATABASE_URL": FAKE_URL,
        "CALL_LOG": str(paths["call_log"]),
        "SCRAPER_MODE_FILE": str(paths["scraper_mode"]),
        "PGDUMP_ARGS_FILE": str(paths["pgdump_args"]),
        **{k: str(v) for k, v in env.items()},
    }
    full_env.pop("SCRAPER_OUTPUT_DIR", None)  # the script must set it itself
    return subprocess.run(
        ["bash", str(SCRIPT)], env=full_env, capture_output=True, text=True, timeout=60, check=False
    )


def calls(paths: dict[str, Path]) -> list[str]:
    if not paths["call_log"].exists():
        return []
    return paths["call_log"].read_text().splitlines()


def scraper_modes(paths: dict[str, Path]) -> list[str]:
    if not paths["scraper_mode"].exists():
        return []
    return paths["scraper_mode"].read_text().splitlines()


def test_off_does_nothing(paths: dict[str, Path]) -> None:
    res = run_import(paths, CATALOG_IMPORT="off")
    assert res.returncode == 0
    assert "disabled" in res.stdout
    assert calls(paths) == []


def test_lock_held_exits_without_scraping(paths: dict[str, Path]) -> None:
    res = run_import(paths, CATALOG_IMPORT="auto", LOCK_HELD=1)
    assert res.returncode == 0
    assert "import already running" in res.stdout
    assert calls(paths) == []
    assert scraper_modes(paths) == []


def test_done_marker_skips_run(paths: dict[str, Path]) -> None:
    paths["data"].mkdir(parents=True)
    (paths["data"] / "import.done").write_text("completed: 2026-01-01T00:00:00Z\nmode: --all\n")
    res = run_import(paths, CATALOG_IMPORT="auto")
    assert res.returncode == 0
    assert "import already complete" in res.stdout
    assert scraper_modes(paths) == []


def test_done_marker_ignored_when_forced(paths: dict[str, Path]) -> None:
    paths["data"].mkdir(parents=True)
    (paths["data"] / "import.done").write_text("completed: 2026-01-01T00:00:00Z\n")
    res = run_import(paths, CATALOG_IMPORT="auto", CATALOG_IMPORT_FORCE="yes")
    assert res.returncode == 0
    assert scraper_modes(paths) == ["--all"]  # forced run, fresh scrape_log -> --all


@pytest.mark.parametrize(
    ("rows", "expected"),
    [(0, "--all"), ("", "--all"), (7, "--resume"), (1234, "--resume")],
)
def test_resume_vs_all_decision(paths: dict[str, Path], rows: Any, expected: str) -> None:
    res = run_import(paths, CATALOG_IMPORT="auto", FAKE_ROWS=rows)
    assert res.returncode == 0
    assert scraper_modes(paths) == [expected]


def test_pg_dump_failure_aborts_before_scraping(paths: dict[str, Path]) -> None:
    res = run_import(paths, CATALOG_IMPORT="auto", PGDUMP_RC=1)
    assert res.returncode == 1
    assert "pg_dump failed" in res.stdout
    assert scraper_modes(paths) == []
    assert not (paths["data"] / "import.done").exists()


def test_empty_backup_aborts_before_scraping(paths: dict[str, Path]) -> None:
    res = run_import(paths, CATALOG_IMPORT="auto", PGDUMP_EMPTY=1)
    assert res.returncode == 1
    assert "backup file is empty" in res.stdout
    assert scraper_modes(paths) == []
    assert not (paths["data"] / "import.done").exists()


@pytest.mark.parametrize(
    ("url", "expected"),
    [
        ("postgresql+psycopg://user:pass@localhost:5432/fake", FAKE_URL),
        ("postgresql+asyncpg://user:pass@localhost:5432/fake", FAKE_URL),
        (FAKE_URL, FAKE_URL),
    ],
)
def test_database_url_converted_for_pg_dump(paths: dict[str, Path], url: str, expected: str) -> None:
    res = run_import(paths, CATALOG_IMPORT="auto", DATABASE_URL=url)
    assert res.returncode == 0
    recorded = paths["pgdump_args"].read_text()
    assert expected in recorded
    assert "+psycopg" not in recorded
    assert "+asyncpg" not in recorded


def test_successful_run_writes_markers_report_and_prunes_backups(paths: dict[str, Path]) -> None:
    backups = paths["data"] / "backups"
    backups.mkdir(parents=True)
    for i in range(3):  # old dumps -> all kept (only the 4th-oldest onward gets pruned)
        (backups / f"hatil-2026010{i}-000000.sql.gz").write_text("old")
    res = run_import(paths, CATALOG_IMPORT="auto")
    assert res.returncode == 0, res.stdout + res.stderr
    done = (paths["data"] / "import.done").read_text()
    assert "created: 10" in done and "failed: 1" in done and "completed:" in done
    assert scraper_modes(paths) == ["--all"]
    assert "Created: 10" in (paths["data"] / "import-report.md").read_text()
    assert len(list(backups.glob("hatil-*.sql.gz"))) == 4  # 3 kept from before + the new one
    assert not (paths["data"] / "import.failed").exists()
    assert any("run --all" in line for line in calls(paths))


def test_backup_pruning_keeps_only_three_newest(paths: dict[str, Path]) -> None:
    backups = paths["data"] / "backups"
    backups.mkdir(parents=True)
    for i in range(5):
        (backups / f"hatil-2026010{i}-000000.sql.gz").write_text("old")
    res = run_import(paths, CATALOG_IMPORT="auto")
    assert res.returncode == 0, res.stdout + res.stderr
    remaining = sorted(backups.glob("hatil-*.sql.gz"))
    assert len(remaining) == 4  # 3 newest of the old + the new dump
    assert "hatil-20260100-000000.sql.gz" not in [p.name for p in remaining]


def test_scraper_failure_leaves_no_done_marker(paths: dict[str, Path]) -> None:
    res = run_import(paths, CATALOG_IMPORT="auto", SCRAPER_EXIT=3)
    assert res.returncode == 3
    assert "no done marker" in res.stdout
    assert not (paths["data"] / "import.done").exists()
    assert (paths["data"] / "import.failed").exists()


def test_verify_failure_leaves_no_done_marker(paths: dict[str, Path]) -> None:
    res = run_import(paths, CATALOG_IMPORT="auto", VERIFY_EXIT=2)
    assert res.returncode == 2
    assert not (paths["data"] / "import.done").exists()
    assert (paths["data"] / "import.failed").exists()


def test_second_consecutive_run_exits_complete(paths: dict[str, Path]) -> None:
    first = run_import(paths, CATALOG_IMPORT="auto")
    assert first.returncode == 0, first.stdout + first.stderr
    second = run_import(paths, CATALOG_IMPORT="auto")
    assert second.returncode == 0
    assert "import already complete" in second.stdout
    assert len(scraper_modes(paths)) == 1  # scraper ran exactly once across both invocations


# --- GET /api/v1/admin/import/status -------------------------------------------------------------


def _login(client: TestClient) -> dict[str, str]:
    res = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert res.status_code == 200, res.text
    return {"Authorization": f"Bearer {res.json()['access_token']}"}


def test_status_requires_admin(client: TestClient) -> None:
    assert client.get("/api/v1/admin/import/status").status_code == 401


def test_status_reports_states(client: TestClient, monkeypatch: pytest.MonkeyPatch) -> None:
    from app.api.v1.admin import imports as imports_module

    data_dir = imports_module._data_dir()
    headers = _login(client)

    monkeypatch.setenv("CATALOG_IMPORT", "off")
    assert client.get("/api/v1/admin/import/status", headers=headers).json()["status"] == "off"
    monkeypatch.setenv("CATALOG_IMPORT", "auto")

    monkeypatch.setattr(imports_module, "_data_dir", lambda: data_dir)
    logs = data_dir / "logs"
    logs.mkdir(parents=True, exist_ok=True)
    (logs / "import-20260101-000000.log").write_text("line1\nline2\n")

    # nothing on disk yet -> running, and without a live lock holder it degrades to failed
    assert client.get("/api/v1/admin/import/status", headers=headers).json()["status"] == "failed"

    (data_dir / "import.done").write_text("completed: 2026-01-01T00:00:00Z\nmode: --all\n")
    (data_dir / "import-report.md").write_text("# report\nCreated: 10\n")
    body = client.get("/api/v1/admin/import/status", headers=headers).json()
    assert body["status"] == "done"
    assert body["completed"] == "2026-01-01T00:00:00Z"
    assert "Created: 10" in body["report"]
    assert "line1" in body["last_log_tail"]

    (data_dir / "import.failed").write_text("")
    assert client.get("/api/v1/admin/import/status", headers=headers).json()["status"] == "failed"
