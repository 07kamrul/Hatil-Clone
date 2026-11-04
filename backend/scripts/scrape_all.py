"""One command: scrape the whole source catalogue and its content into this application.

Stages: migrate -> products (--all) -> retry failed (--resume) -> content (showrooms, banners, pages,
FAQs, blog) -> verify (row counts, no image still pointing at the source site). Images are downloaded,
converted to WebP and stored under UPLOAD_DIR by the existing scraper stages.

    python -m scripts.scrape_all                 # full run (about an hour at 1 req/s)
    python -m scripts.scrape_all --limit 5       # smoke test
    python -m scripts.scrape_all --backup --skip-products -v

DATABASE_URL defaults to sqlite:///dev.db and UPLOAD_DIR to uploads when unset.
"""

import argparse
import logging
import os
import shutil
import subprocess
import sys
from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parents[1]
DEFAULT_DATABASE_URL = "sqlite:///dev.db"
DEFAULT_UPLOAD_DIR = "uploads"
CONTENT_KINDS = ("showrooms", "banners", "pages", "blog")
BACKUP_DIR = BACKEND_DIR / "backups"

log = logging.getLogger("scrape_all")


@dataclass(frozen=True)
class StageResult:
    name: str
    created: int = 0
    updated: int = 0
    failed: int = 0
    skipped: int = 0
    note: str = ""

    @property
    def ok(self) -> bool:
        return not self.failed or bool(self.created or self.updated)


# ---------- environment ----------
def prepare_env(environ: dict[str, str] = os.environ) -> None:
    """Default the DB and upload dir before any app module reads settings."""
    environ.setdefault("DATABASE_URL", DEFAULT_DATABASE_URL)
    environ.setdefault("UPLOAD_DIR", DEFAULT_UPLOAD_DIR)
    for path in (str(BACKEND_DIR), str(BACKEND_DIR / "scripts")):
        if path not in sys.path:
            sys.path.insert(0, path)


def migrate() -> None:
    from alembic.config import Config

    from alembic import command

    command.upgrade(Config(str(BACKEND_DIR / "alembic.ini")), "head")


def backup(database_url: str, now: datetime | None = None) -> Path:
    """Copy a SQLite file or pg_dump a Postgres DB into backend/backups. Raises when it cannot."""
    BACKUP_DIR.mkdir(exist_ok=True)
    stamp = (now or datetime.now(UTC)).strftime("%Y%m%d-%H%M%S")
    if database_url.startswith("sqlite:///"):
        source = Path(database_url.removeprefix("sqlite:///"))
        if not source.is_absolute():
            source = BACKEND_DIR / source
        target = BACKUP_DIR / f"hatil-{stamp}.db"
        if source.exists():
            shutil.copy2(source, target)
        return target
    target = BACKUP_DIR / f"hatil-{stamp}.sql"
    plain_url = database_url.replace("+psycopg", "").replace("+asyncpg", "")
    with target.open("wb") as fh:
        subprocess.run(["pg_dump", "--clean", "--if-exists", "--no-owner", plain_url],  # noqa: S603, S607
                       stdout=fh, check=True)
    if target.stat().st_size == 0:
        raise RuntimeError("pg_dump produced an empty backup")
    return target


# ---------- stages ----------
def run_products(mode: str, limit: int | None) -> StageResult:
    from app.db.session import SessionLocal
    from scraper.config import ScraperConfig
    from scraper.pipeline import ScrapeRun

    report = ScrapeRun(ScraperConfig(), SessionLocal).run(mode, limit=limit)
    return StageResult(f"products ({mode})", report.created, report.updated, report.failed,
                       report.skipped + report.gone, f"report scraper_output/report-{report.run_id}.md")


def run_content(limit: int | None) -> StageResult:
    from app.db.session import SessionLocal
    from scraper.config import ScraperConfig
    from scraper.content_import import ContentImporter

    report = ContentImporter(ScraperConfig(), SessionLocal).run(list(CONTENT_KINDS), limit=limit)
    return StageResult("content", report.created, report.updated, report.failed,
                       note=f"{report.images_stored} images stored")


def verify() -> StageResult:
    """Count imported rows and flag stored image paths that still point at a remote host."""
    from sqlalchemy import func, select

    from app.db.session import SessionLocal
    from app.models.catalog import Category, Product, ProductImage
    from app.models.content import Banner, BlogPost, Faq, Page, Showroom

    counted = (Product, ProductImage, Category, Showroom, Banner, Page, Faq, BlogPost)
    image_columns = (ProductImage.path, Banner.image, Showroom.image, BlogPost.cover_image)
    with SessionLocal() as db:
        counts = {model.__tablename__: db.scalar(select(func.count()).select_from(model)) for model in counted}
        remote = sum(db.scalar(select(func.count()).where(column.like("http%"))) for column in image_columns)
    empty = [name for name, n in counts.items() if not n]
    note = ", ".join(f"{name}={n}" for name, n in counts.items()) + f"; remote images={remote}"
    return StageResult("verify", failed=len(empty) + remote, note=note + (f"; EMPTY: {empty}" if empty else ""))


# ---------- orchestration ----------
@dataclass(frozen=True)
class Stages:
    products: Callable[[str, int | None], StageResult] = run_products
    content: Callable[[int | None], StageResult] = run_content
    verify: Callable[[], StageResult] = verify


def run_all(args: argparse.Namespace, stages: Stages = Stages()) -> list[StageResult]:
    results: list[StageResult] = []
    if not args.skip_products:
        results.append(stages.products("all", args.limit))
        if not args.no_resume and results[-1].failed:
            results.append(stages.products("resume", args.limit))
    if not args.skip_content:
        results.append(stages.content(args.limit))
    results.append(stages.verify())
    return results


def print_summary(results: list[StageResult]) -> None:
    print(f"\n{'stage':<20}{'created':>9}{'updated':>9}{'failed':>8}{'skipped':>9}  note")
    for r in results:
        print(f"{r.name:<20}{r.created:>9}{r.updated:>9}{r.failed:>8}{r.skipped:>9}  {r.note}")


def exit_code(results: list[StageResult], strict_verify: bool = True) -> int:
    scrape_ok = all(r.ok for r in results if r.name != "verify")
    verify_ok = all(not r.failed for r in results if r.name == "verify")
    return 0 if scrape_ok and (verify_ok or not strict_verify) else 1


def parse_args(argv: list[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--limit", type=int, default=None, help="at most N items per stage (smoke test)")
    parser.add_argument("--skip-products", action="store_true", help="do not scrape products")
    parser.add_argument("--skip-content", action="store_true", help="do not import showrooms/banners/pages/blog")
    parser.add_argument("--no-resume", action="store_true", help="do not retry failed product URLs")
    parser.add_argument("--backup", action="store_true", help="back up the database first")
    parser.add_argument("-v", "--verbose", action="store_true")
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = parse_args(argv)
    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    prepare_env()
    log.info("database %s, uploads in %s", os.environ["DATABASE_URL"].split("@")[-1], os.environ["UPLOAD_DIR"])
    if args.backup:
        log.info("backup written to %s", backup(os.environ["DATABASE_URL"]))
    migrate()
    results = run_all(args)
    print_summary(results)
    # A --limit run imports only a sample, so empty tables there are not a failure.
    return exit_code(results, strict_verify=args.limit is None)


if __name__ == "__main__":
    sys.exit(main())
