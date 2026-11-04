"""Tests for scripts/scrape_all.py: stage order, flags and exit codes (stages are faked, fully offline)."""

from datetime import UTC, datetime

from scripts import scrape_all
from scripts.scrape_all import StageResult, Stages, exit_code, parse_args, run_all

VERIFY_OK = StageResult("verify", note="ok")


def fake_stages(calls: list[str], product_failed: int = 0, verify: StageResult = VERIFY_OK) -> Stages:
    def products(mode: str, limit: int | None) -> StageResult:
        calls.append(f"products:{mode}:{limit}")
        return StageResult(f"products ({mode})", created=5, failed=product_failed if mode == "all" else 0)

    def content(limit: int | None) -> StageResult:
        calls.append(f"content:{limit}")
        return StageResult("content", created=3)

    def verify_stage() -> StageResult:
        calls.append("verify")
        return verify

    return Stages(products=products, content=content, verify=verify_stage)


def test_runs_products_content_then_verify():
    calls: list[str] = []
    run_all(parse_args([]), fake_stages(calls))
    assert calls == ["products:all:None", "content:None", "verify"]


def test_retries_failed_products_with_resume():
    calls: list[str] = []
    results = run_all(parse_args(["--limit", "2"]), fake_stages(calls, product_failed=4))
    assert calls == ["products:all:2", "products:resume:2", "content:2", "verify"]
    assert [r.name for r in results] == ["products (all)", "products (resume)", "content", "verify"]


def test_no_resume_and_skip_flags():
    calls: list[str] = []
    run_all(parse_args(["--no-resume", "--skip-content"]), fake_stages(calls, product_failed=4))
    assert calls == ["products:all:None", "verify"]
    calls.clear()
    run_all(parse_args(["--skip-products"]), fake_stages(calls))
    assert calls == ["content:None", "verify"]


def test_exit_code_fails_when_a_stage_imports_nothing():
    assert exit_code([StageResult("products (all)", failed=3), VERIFY_OK]) == 1
    assert exit_code([StageResult("products (all)", created=1, failed=3), VERIFY_OK]) == 0


def test_exit_code_verify_is_strict_only_for_full_runs():
    results = [StageResult("content", created=1), StageResult("verify", failed=2)]
    assert exit_code(results) == 1
    assert exit_code(results, strict_verify=False) == 0


def test_prepare_env_keeps_explicit_values():
    env = {"DATABASE_URL": "postgresql://x"}
    scrape_all.prepare_env(env)
    assert env == {"DATABASE_URL": "postgresql://x", "UPLOAD_DIR": "uploads"}


def test_sqlite_backup_copies_the_file(tmp_path, monkeypatch):
    monkeypatch.setattr(scrape_all, "BACKUP_DIR", tmp_path / "backups")
    db = tmp_path / "dev.db"
    db.write_bytes(b"data")
    target = scrape_all.backup(f"sqlite:///{db}", now=datetime(2026, 11, 4, tzinfo=UTC))
    assert target.name == "hatil-20261104-000000.db"
    assert target.read_bytes() == b"data"


def test_verify_counts_rows_and_flags_remote_images(db, monkeypatch):
    from app.models.content import Banner

    db.add(Banner(title="Hero", image="https://www.hatil.com/x.jpg"))
    db.commit()
    monkeypatch.setattr("app.db.session.SessionLocal", lambda: db)
    result = scrape_all.verify()
    assert "banners=1" in result.note
    assert "remote images=1" in result.note
    assert result.failed >= 1
