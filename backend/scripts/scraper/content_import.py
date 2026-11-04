"""Discover, fetch and upsert the non-product content: showrooms, banners, static pages, FAQs, blog posts.

Storage rule: text and structured data go into the database; every image is downloaded, re-encoded as
WebP through StorageService.save_image (into UPLOAD_DIR, the hatil-uploads volume in production) and
only its relative /uploads/... path is stored. `localize_html` rewrites <img src> inside page and blog
bodies so nothing hotlinks hatil.com. Upserts are idempotent; banners are create-only.
"""

import logging
import re
import secrets
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import UTC, datetime
from urllib.parse import urljoin

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.enums import BannerPlacement
from app.core.text import sanitize_html
from app.models import Banner, BlogPost, Faq, Page, Showroom
from app.storage import get_storage
from app.storage.base import InvalidImageError, StorageService
from scraper.config import ScraperConfig
from scraper.content import (
    ContentParseError,
    ScrapedBanner,
    ScrapedShowroom,
    classify_content_url,
    parse_banners,
    parse_blog_post,
    parse_faqs,
    parse_page,
    parse_showroom,
)
from scraper.discovery import parse_sitemap
from scraper.http import FetchError, PoliteClient, RobotsDisallowedError

log = logging.getLogger("scraper.content")

IMG_TAG = re.compile(r"<img\b[^>]*>", re.I)
SRC_ATTR = re.compile(r'\bsrc="([^"]+)"', re.I)
MAX_IMAGES_PER_DOC = 60  # safety cap for one HTML body
BANNER_FOLDER = "banners"
BLOG_FOLDER = "blog"
PAGE_FOLDER = "content/pages"
SHOWROOM_FOLDER = "showrooms"
KINDS = ("showrooms", "banners", "pages", "blog")


@dataclass
class ContentReport:
    started_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    attempted: int = 0
    created: int = 0
    updated: int = 0
    failed: int = 0
    images_stored: int = 0
    failures: list[dict[str, str]] = field(default_factory=list)


class ContentImporter:
    def __init__(self, config: ScraperConfig, session_factory: Callable[[], Session],
                 client: PoliteClient | None = None, storage: StorageService | None = None) -> None:
        self.config = config
        self.session_factory = session_factory
        self.client = client or PoliteClient(config)
        self.storage = storage or get_storage()
        self._image_cache: dict[str, str | None] = {}
        self.images_stored = 0

    # ---------- discovery ----------
    def discover(self) -> dict[str, list[str]]:
        urls: dict[str, list[str]] = {kind: [] for kind in (*KINDS, "home")}
        kind_of = {"showroom": "showrooms", "page": "pages", "blog": "blog", "home": "home"}
        queue, seen = list(self.config.sitemap_urls), set()
        while queue and len(seen) < 50:
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
            for url in pages:
                kind = classify_content_url(url)
                if kind:
                    urls[kind_of[kind]].append(url)
        return urls

    # ---------- run ----------
    def run(self, kinds: list[str], limit: int | None = None) -> ContentReport:
        report = ContentReport()
        discovered = self.discover()
        with self.session_factory() as db:
            if "banners" in kinds:
                self._run_banners(db, discovered.get("home", []), report)
            if "showrooms" in kinds:
                self._run_items(db, report, discovered.get("showrooms", []), parse_showroom, limit,
                                self._upsert_showroom)
            if "pages" in kinds:
                self._run_items(db, report, discovered.get("pages", []), parse_page, limit,
                                self._upsert_page)
                faq_url = next((u for u in discovered.get("pages", []) if u.rstrip("/").endswith("/faq")), None)
                if faq_url:
                    self.import_faqs(db, faq_url, report)
            if "blog" in kinds:
                self._run_items(db, report, discovered.get("blog", []), parse_blog_post, limit,
                                self._upsert_blog)
            db.commit()
        report.images_stored = self.images_stored
        return report

    def _run_items(self, db: Session, report: ContentReport, urls: list[str], parser: Callable,
                   limit: int | None, upsert: Callable) -> None:
        for url in urls[:limit] if limit else urls:
            report.attempted += 1
            try:
                parsed = parser(self.client.get_text(url), url)
                action = upsert(db, parsed)
                report.created += action == "created"
                report.updated += action == "updated"
            except (FetchError, RobotsDisallowedError, ContentParseError, ValueError, InvalidImageError) as exc:
                report.failed += 1
                report.failures.append({"url": url, "error": str(exc)[:300]})
                log.warning("Content %s failed: %s", url, exc)

    def _run_banners(self, db: Session, home_urls: list[str], report: ContentReport) -> None:
        url = home_urls[0] if home_urls else self.config.base_url + "/"
        report.attempted += 1
        try:
            banners = parse_banners(self.client.get_text(url))
            existing = {(title, placement.value if hasattr(placement, "value") else str(placement))
                        for title, placement in db.execute(select(Banner.title, Banner.placement).where(
                            Banner.placement.in_([BannerPlacement.HERO, BannerPlacement.PROMO])))}
            for banner in banners:
                key = (banner.title, banner.placement)
                if key in existing:
                    report.updated += 1  # create-only: existing banners (admin edits included) stay untouched
                    continue
                db.add(self._banner_row(banner))
                existing.add(key)
                report.created += 1
        except (FetchError, RobotsDisallowedError, ContentParseError, ValueError) as exc:
            report.failed += 1
            report.failures.append({"url": url, "error": str(exc)[:300]})
            log.warning("Banners failed: %s", exc)

    # ---------- image handling ----------
    def store_image(self, source_url: str, folder: str, name_hint: str = "") -> str | None:
        """Download, convert to WebP and store one image; returns its /uploads/... path. Cached by URL."""
        if source_url in self._image_cache:
            return self._image_cache[source_url]
        stored: str | None = None
        try:
            data = self.client.get_bytes(urljoin(self.config.base_url + "/", source_url))
            stored = self.storage.save_image(data, folder, name_hint or secrets.token_hex(4)).url
            self.images_stored += 1
        except (FetchError, RobotsDisallowedError, InvalidImageError, OSError, ValueError) as exc:
            log.warning("Image %s skipped: %s", source_url, exc)
        self._image_cache[source_url] = stored
        return stored

    def localize_html(self, html: str | None, folder: str, name_hint: str = "") -> str | None:
        """Rewrite <img src> to stored /uploads paths and sanitise; images that fail to download are dropped."""
        if not html:
            return html

        def replace(match: re.Match) -> str:
            tag = match.group(0)
            src = SRC_ATTR.search(tag)
            if not src:
                return ""
            stored = self.store_image(src.group(1), folder, name_hint)
            if stored is None:
                return ""
            return SRC_ATTR.sub(f'src="{stored}"', tag, count=1)

        parts, count = IMG_TAG.subn(replace, html)
        if count > MAX_IMAGES_PER_DOC:
            log.warning("Large document %s: %d images (cap %d is not enforced)", name_hint, count,
                        MAX_IMAGES_PER_DOC)
        return sanitize_html(parts)  # sanitise after rewriting

    # ---------- upserts ----------
    def _upsert_showroom(self, db: Session, data: ScrapedShowroom) -> str:
        row = db.scalars(select(Showroom).where(Showroom.slug == data.slug)).first()
        image = self.store_image(data.image, SHOWROOM_FOLDER, data.slug) if data.image else None
        if row is None:
            row = Showroom(slug=data.slug)
            db.add(row)
            action = "created"
        else:
            action = "updated"
        row.name, row.address, row.city = data.name, data.address, data.city
        row.phone, row.off_days, row.opening_hours = data.phone, data.off_days, data.opening_hours
        row.latitude, row.longitude = data.latitude, data.longitude
        row.image = image or row.image
        row.is_active = True
        return action

    def _banner_row(self, banner: ScrapedBanner) -> Banner:
        stored = self.store_image(banner.image, BANNER_FOLDER, banner.title)
        return Banner(title=banner.title[:200], subtitle=banner.subtitle, image=stored or banner.image[:500],
                      link_url=banner.link_url, placement=BannerPlacement(banner.placement),
                      sort_order=banner.sort_order, is_active=True)

    def _upsert_page(self, db: Session, data) -> str:
        row = db.scalars(select(Page).where(Page.slug == data.slug)).first()
        body = self.localize_html(data.body_html, PAGE_FOLDER, data.slug)
        if not (body and body.strip()):
            return "unchanged"
        if row is None:
            row = Page(slug=data.slug)
            db.add(row)
            action = "created"
        else:
            action = "updated"
        row.title, row.body_html = data.title[:255], body
        row.is_published = True
        row.seo_title = data.meta_title
        row.seo_description = data.meta_description
        return action

    def _upsert_blog(self, db: Session, data) -> str:
        row = db.scalars(select(BlogPost).where(BlogPost.slug == data.slug)).first()
        body = self.localize_html(data.body_html, BLOG_FOLDER, data.slug) or ""
        cover = self.store_image(data.cover_image, BLOG_FOLDER, data.slug) if data.cover_image else None
        if row is None:
            row = BlogPost(slug=data.slug)
            db.add(row)
            action = "created"
        else:
            action = "updated"
        row.title = data.title[:255]
        row.body_html = body
        row.excerpt = (data.excerpt or "")[:600] or None
        row.cover_image = cover or row.cover_image
        row.author, row.tags = data.author, ",".join(data.tags)[:300] or None
        row.is_published = True
        row.published_at = data.published_at or row.published_at
        row.seo_title = data.meta_title
        row.seo_description = data.meta_description
        return action

    # ---------- faqs (attached to the faq page) ----------
    def import_faqs(self, db: Session, url: str, report: ContentReport) -> None:
        report.attempted += 1
        try:
            faqs = parse_faqs(self.client.get_text(url))
        except (FetchError, RobotsDisallowedError, ValueError) as exc:
            report.failed += 1
            report.failures.append({"url": url, "error": str(exc)[:300]})
            return
        existing = {row.question: row for row in db.scalars(select(Faq))}
        for position, faq in enumerate(faqs):
            answer = self.localize_html(faq.answer_html, PAGE_FOLDER, "faq")
            if not answer:
                continue
            row = existing.get(faq.question[:500])
            if row is None:
                db.add(Faq(question=faq.question[:500], answer_html=answer, group="General",
                           sort_order=position, is_active=True))
                report.created += 1
            else:
                row.answer_html, row.sort_order, row.is_active = answer, position, True
                report.updated += 1

    def close(self) -> None:
        self.client.close()
