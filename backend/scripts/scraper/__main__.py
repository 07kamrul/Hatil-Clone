"""CLI: python -m scraper run --all | --category <slug> | --resume [--limit N]"""

import argparse
import logging
import sys
from pathlib import Path

# Allow `python -m scraper` from backend/scripts as well as `python -m scripts.scraper` from backend/.
_BACKEND = Path(__file__).resolve().parents[2]
_SCRIPTS = _BACKEND / "scripts"
for path in (str(_BACKEND), str(_SCRIPTS)):
    if path not in sys.path:
        sys.path.insert(0, path)

from app.db.session import SessionLocal  # noqa: E402
from scraper.config import ScraperConfig  # noqa: E402
from scraper.pipeline import ScrapeRun  # noqa: E402


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="scraper", description="Import products from the source catalogue")
    sub = parser.add_subparsers(dest="command", required=True)
    run = sub.add_parser("run", help="discover, scrape and upsert products")
    group = run.add_mutually_exclusive_group(required=True)
    group.add_argument("--all", action="store_true", help="scrape every product found in the sitemap")
    group.add_argument("--category", metavar="SLUG", help="only products of one category (e.g. sofa)")
    group.add_argument("--resume", action="store_true", help="continue pending/failed URLs from scrape_log")
    run.add_argument("--limit", type=int, default=None, help="process at most N products")
    run.add_argument("-v", "--verbose", action="store_true")
    content = sub.add_parser("content", help="import showrooms, banners, pages, FAQs and blog posts")
    cgroup = content.add_mutually_exclusive_group()
    for kind in ("showrooms", "banners", "pages", "blog"):
        cgroup.add_argument(f"--{kind}", action="append_const", dest="kinds", const=kind,
                            help=f"import only {kind}")
    content.add_argument("--all", action="store_const", dest="kinds", const=("showrooms", "banners", "pages", "blog"),
                         help="import every content type")
    content.add_argument("--limit", type=int, default=None, help="process at most N items per type")
    content.add_argument("-v", "--verbose", action="store_true")
    args = parser.parse_args(argv)

    logging.basicConfig(level=logging.DEBUG if args.verbose else logging.INFO,
                        format="%(asctime)s %(levelname)s %(name)s: %(message)s")
    if args.command == "content":
        from scraper.content_import import ContentImporter

        kinds = list(args.kinds or ("showrooms", "banners", "pages", "blog"))
        report = ContentImporter(ScraperConfig(), SessionLocal).run(kinds, limit=args.limit)
        print(f"Content import: attempted={report.attempted} created={report.created} "
              f"updated={report.updated} failed={report.failed} images_stored={report.images_stored}")
        return 1 if report.failed and not (report.created or report.updated) else 0
    mode = "resume" if args.resume else ("category" if args.category else "all")
    report = ScrapeRun(ScraperConfig(), SessionLocal).run(mode, category=args.category, limit=args.limit)
    print(f"Run {report.run_id}: created={report.created} updated={report.updated} "
          f"failed={report.failed} skipped={report.skipped} (report in scraper_output/report-{report.run_id}.md)")
    return 1 if report.failed and not (report.created or report.updated) else 0


if __name__ == "__main__":
    sys.exit(main())
