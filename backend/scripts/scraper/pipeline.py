"""Discovery → scrape_log → fetch → parse → upsert → dump/report. Resumable via scrape_log."""

import csv
import json
import logging
import secrets
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from urllib.parse import urljoin

from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import ScrapeStatus
from app.models import Product, ScrapeLog
from app.repositories.category_repository import CategoryRepository
from app.services.product_import_service import EXPORT_COLUMNS, ProductImporter, product_to_row
from scraper.config import ScraperConfig
from scraper.discovery import category_slug_of, classify_url, extract_product_links, next_page_url, parse_sitemap
from scraper.http import FetchError, GoneError, PoliteClient, RobotsDisallowedError, render_with_playwright
from scraper.mapper import to_import
from scraper.parsers import ParseError, ScrapedProduct, SkipProduct, parse_product

log = logging.getLogger("scraper")

MAX_SITEMAPS = 50
MAX_CATEGORY_PAGES = 50


@dataclass
class RunReport:
    run_id: str
    mode: str
    started_at: str
    finished_at: str = ""
    discovered: int = 0
    attempted: int = 0
    created: int = 0
    updated: int = 0
    failed: int = 0
    skipped: int = 0
    requests: int = 0
    gone: int = 0
    failures: list[dict[str, str]] = field(default_factory=list)
    skips: list[dict[str, str]] = field(default_factory=list)
    gone_urls: list[dict[str, str]] = field(default_factory=list)


class ScrapeRun:
    def __init__(self, config: ScraperConfig, session_factory: Callable[[], Session],
                 client: PoliteClient | None = None) -> None:
        self.config = config
        self.session_factory = session_factory
        self.client = client or PoliteClient(config)
        self.run_id = datetime.now(UTC).strftime("%Y%m%d-%H%M%S-") + secrets.token_hex(2)
        self.scraped: list[ScrapedProduct] = []
        self._category_links: set[str] = set()

    # ---------- discovery ----------
    def discover(self, category: str | None) -> list[str]:
        urls: dict[str, None] = {}
        queue, seen = list(self.config.sitemap_urls), set()
        while queue and len(seen) < MAX_SITEMAPS:
            sitemap = queue.pop(0)
            if sitemap in seen:
                continue
            seen.add(sitemap)
            try:
                pages, children = parse_sitemap(self.client.get_text(sitemap))
            except (FetchError, RobotsDisallowedError) as exc:
                log.warning("Sitemap %s unavailable: %s", sitemap, exc)
                continue
            queue.extend(children)
            urls.update((u, None) for u in pages if classify_url(u, self.config) == "product")
        if category:
            urls.update((u, None) for u in self._category_pages(category))
            urls = {u: None for u in urls if category_slug_of(u) == category or u in self._category_links}
        log.info("Discovered %d product URLs", len(urls))
        return list(urls)

    def _category_pages(self, slug: str) -> list[str]:
        found: list[str] = []
        for start in (f"{slug}-price-in-bangladesh", slug):
            url: str | None = urljoin(self.config.base_url + "/", start)
            pages = 0
            while url and pages < MAX_CATEGORY_PAGES:
                try:
                    html = self.client.get_text(url)
                except (FetchError, RobotsDisallowedError):
                    break
                found.extend(extract_product_links(html, url, self.config))
                url, pages = next_page_url(html, url), pages + 1
        self._category_links = set(found)
        return found

    def register(self, db: Session, urls: list[str]) -> None:
        known = set(db.scalars(select(ScrapeLog.url).where(ScrapeLog.url.in_(urls)))) if urls else set()
        for url in urls:
            if url not in known:
                db.add(ScrapeLog(url=url, kind="product", category_slug=category_slug_of(url)))
        db.commit()

    def targets(self, db: Session, resume: bool, category: str | None, urls: list[str] | None) -> list[ScrapeLog]:
        stmt = select(ScrapeLog).where(ScrapeLog.kind == "product").order_by(ScrapeLog.id)
        if urls is not None:
            # An explicit URL list (e.g. --category) is matched exactly: listing-page links carry a
            # different slug than the product URLs they lead to, so the category filter would drop them.
            return list(db.scalars(stmt.where(ScrapeLog.url.in_(urls))))
        if resume:
            stmt = stmt.where(ScrapeLog.status.in_([ScrapeStatus.PENDING, ScrapeStatus.FAILED]),
                              ScrapeLog.attempts < self.config.max_attempts_per_url)
        if category:
            stmt = stmt.where(ScrapeLog.category_slug == category)
        return list(db.scalars(stmt))

    # ---------- processing ----------
    def fetch_and_parse(self, url: str) -> ScrapedProduct:
        html = self.client.get_text(url)
        try:
            return parse_product(html, url)
        except ParseError:
            if not self.config.use_playwright:
                raise
            rendered = render_with_playwright(url, self.config.user_agent)
            if rendered is None:
                raise
            return parse_product(rendered, url)

    def process(self, db: Session, entry: ScrapeLog, report: RunReport) -> None:
        entry.attempts += 1
        entry.last_attempt_at = datetime.now(UTC)
        entry.run_id = self.run_id
        report.attempted += 1
        try:
            scraped = self.fetch_and_parse(entry.url)
            importer = ProductImporter(db, image_fetcher=self.client.get_bytes)
            with db.begin_nested():
                action, _ = importer.upsert(to_import(scraped, self.config.max_images_per_product))
            entry.status, entry.error, entry.sku = ScrapeStatus.DONE, None, scraped.sku
            self.scraped.append(scraped)
            report.created += action == "created"
            report.updated += action == "updated"
        except GoneError as exc:
            # The existing product (if any) is left untouched: not deleted, not unpublished.
            entry.status, entry.error = ScrapeStatus.GONE, f"HTTP {exc.status_code}"
            report.gone += 1
            report.gone_urls.append({"url": entry.url, "status": str(exc.status_code)})
            log.info("Gone (HTTP %s): %s", exc.status_code, entry.url)
        except (RobotsDisallowedError, SkipProduct) as exc:
            entry.status, entry.error = ScrapeStatus.SKIPPED, str(exc)
            report.skipped += 1
            report.skips.append({"url": entry.url, "reason": str(exc)[:300]})
        except (FetchError, ParseError, ValueError) as exc:
            entry.status, entry.error = ScrapeStatus.FAILED, str(exc)[:2000]
            report.failed += 1
            report.failures.append({"url": entry.url, "error": str(exc)[:300]})
            log.warning("Failed %s: %s", entry.url, exc)
        db.commit()

    def run(self, mode: str, category: str | None = None, limit: int | None = None) -> RunReport:
        report = RunReport(run_id=self.run_id, mode=mode, started_at=datetime.now(UTC).isoformat())
        resume = mode == "resume"
        with self.session_factory() as db:
            urls = None
            if not resume:
                urls = self.discover(category)
                report.discovered = len(urls)
                self.register(db, urls)
            entries = self.targets(db, resume, category, urls)
            if limit:
                entries = entries[:limit]
            started = time.monotonic()
            for n, entry in enumerate(entries, start=1):
                self.process(db, entry, report)
                if n % 10 == 0:
                    log.info("Progress %d/%d (%.0fs)", n, len(entries), time.monotonic() - started)
            report.requests = self.client.request_count
            report.finished_at = datetime.now(UTC).isoformat()
            self.write_outputs(db, report)
        self.client.close()
        return report

    # ---------- outputs ----------
    def write_outputs(self, db: Session, report: RunReport) -> None:
        out = self.config.output_dir
        out.mkdir(parents=True, exist_ok=True)
        (out / f"products-{self.run_id}.json").write_text(
            json.dumps([p.to_dict() for p in self.scraped], ensure_ascii=False, indent=2), encoding="utf-8")
        skus = [p.sku for p in self.scraped]
        categories = CategoryRepository(db)
        products = db.scalars(select(Product).where(Product.sku.in_(skus)).options(
            selectinload(Product.images), selectinload(Product.colors), selectinload(Product.materials),
            selectinload(Product.rooms), selectinload(Product.specs), selectinload(Product.category))) if skus else []
        with (out / f"products-{self.run_id}.csv").open("w", newline="", encoding="utf-8-sig") as fh:
            writer = csv.DictWriter(fh, fieldnames=EXPORT_COLUMNS)
            writer.writeheader()
            for p in products:
                writer.writerow(product_to_row(p, [c.name for c in categories.ancestors(p.category)] if p.category else []))
        (out / f"report-{self.run_id}.json").write_text(json.dumps(report.__dict__, indent=2), encoding="utf-8")
        (out / f"report-{self.run_id}.md").write_text(render_report(report), encoding="utf-8")


def render_report(r: RunReport) -> str:
    lines = [
        f"# Scrape report {r.run_id}", "",
        f"- Mode: `{r.mode}`", f"- Started: {r.started_at}", f"- Finished: {r.finished_at}",
        f"- URLs discovered: {r.discovered}", f"- Attempted: {r.attempted}",
        f"- Created: {r.created}", f"- Updated: {r.updated}", f"- Failed: {r.failed}",
        f"- Skipped (robots.txt / discontinued / no price): {r.skipped}", f"- Gone (HTTP 404/410): {r.gone}",
        f"- HTTP requests: {r.requests}", "",
    ]
    if r.gone_urls:
        lines += ["## Gone (404/410)", "", "| URL | Status |", "|---|---|"]
        lines += [f"| {g['url']} | {g['status']} |" for g in r.gone_urls]
        lines += [""]
    if r.failures:
        lines += ["## Failures", "", "| URL | Error |", "|---|---|"]
        lines += [f"| {f['url']} | {f['error'].replace('|', '/')} |" for f in r.failures]
    if r.skips:
        lines += ["", "## Skipped", "", "| URL | Reason |", "|---|---|"]
        lines += [f"| {s['url']} | {s['reason'].replace('|', '/')} |" for s in r.skips]
    return "\n".join(lines) + "\n"
