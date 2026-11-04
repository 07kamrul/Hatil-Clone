"""Idempotent import of the company's own details from the saved Facebook page (fb_page/).

Updates site settings and the About page, and upserts the showroom, blog post, banners and FAQs.
Previous showrooms, banners, FAQs and blog posts (e.g. scraped or demo content) are deactivated unless
--keep-existing is passed. Nothing is deleted.

Usage:
    python -m scripts.seed_company [--source ../fb_page/"Sahat Al Ramlah Furniture L.L_files"] [--keep-existing]
"""

import argparse
import logging
from datetime import UTC, datetime
from pathlib import Path

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models import Banner, BlogPost, Faq, Page, Showroom
from app.services.settings_service import SettingsService
from app.storage import get_storage
from app.storage.base import InvalidImageError
from scripts import company_data as data

log = logging.getLogger("seed_company")

DEFAULT_SOURCE = Path(__file__).resolve().parents[2] / "fb_page" / "Sahat Al Ramlah Furniture L.L_files"


class _Images:
    """Uploads each source image at most once per run; returns None for missing or invalid files."""

    def __init__(self, source: Path) -> None:
        self.source = source
        self.urls: dict[str, str | None] = {}

    def url(self, key: str, folder: str) -> str | None:
        if key not in self.urls:
            self.urls[key] = self._upload(key, folder)
        return self.urls[key]

    def _upload(self, key: str, folder: str) -> str | None:
        path = self.source / data.IMAGE_FILES[key]
        if not path.is_file():
            log.warning("Image %s not found at %s; skipping", key, path)
            return None
        try:
            return get_storage().save_image(path.read_bytes(), folder, f"company-{key}").url
        except InvalidImageError as exc:
            log.warning("Image %s is not usable (%s); skipping", key, exc)
            return None


def _seed_about(db: Session) -> None:
    page = db.scalar(select(Page).where(Page.slug == "about"))
    if page is None:
        page = Page(slug="about", title="About Us")
        db.add(page)
    page.body_html = data.ABOUT_HTML
    page.seo_title = f"About {data.SITE_NAME}"
    page.is_published = True


def _seed_showroom(db: Session, images: _Images) -> Showroom:
    fields = {k: v for k, v in data.SHOWROOM.items() if k not in ("slug", "image_key")}
    showroom = db.scalar(select(Showroom).where(Showroom.slug == data.SHOWROOM["slug"]))
    if showroom is None:
        showroom = Showroom(slug=data.SHOWROOM["slug"], **fields)
        db.add(showroom)
    else:
        for key, value in fields.items():
            setattr(showroom, key, value)
    showroom.is_active = True
    showroom.sort_order = 0
    if not showroom.image:
        showroom.image = images.url(data.SHOWROOM["image_key"], "showrooms")
    return showroom


def _seed_blog_post(db: Session, images: _Images) -> BlogPost:
    fields = {k: v for k, v in data.BLOG_POST.items() if k not in ("slug", "image_key")}
    post = db.scalar(select(BlogPost).where(BlogPost.slug == data.BLOG_POST["slug"]))
    if post is None:
        post = BlogPost(slug=data.BLOG_POST["slug"], published_at=datetime.now(UTC), **fields)
        db.add(post)
    else:
        for key, value in fields.items():
            setattr(post, key, value)
    post.is_published = True
    post.seo_title = post.title
    if not post.cover_image:
        post.cover_image = images.url(data.BLOG_POST["image_key"], "blog")
    return post


def _seed_banners(db: Session, images: _Images) -> list[Banner]:
    banners = []
    for i, (title, subtitle, link, button, placement, image_key) in enumerate(data.BANNERS):
        banner = db.scalar(select(Banner).where(Banner.title == title))
        if banner is None:
            image = images.url(image_key, "banners")
            if image is None:
                continue
            banner = Banner(title=title, image=image)
            db.add(banner)
        banner.subtitle, banner.link_url, banner.button_text = subtitle, link, button
        banner.placement, banner.sort_order, banner.is_active = placement, i, True
        banners.append(banner)
    return banners


def _seed_faqs(db: Session) -> list[Faq]:
    faqs = []
    for i, (question, answer, on_home) in enumerate(data.FAQS):
        faq = db.scalar(select(Faq).where(Faq.question == question))
        if faq is None:
            faq = Faq(question=question, answer_html=answer)
            db.add(faq)
        faq.answer_html, faq.group, faq.sort_order = answer, "About Us", i
        faq.show_on_home, faq.is_active = on_home, True
        faqs.append(faq)
    return faqs


def _deactivate_others(db: Session, showroom: Showroom, post: BlogPost, banners: list[Banner],
                       faqs: list[Faq]) -> None:
    db.execute(update(Showroom).where(Showroom.id != showroom.id).values(is_active=False))
    db.execute(update(BlogPost).where(BlogPost.id != post.id).values(is_published=False))
    db.execute(update(Banner).where(Banner.id.not_in([b.id for b in banners])).values(is_active=False))
    db.execute(update(Faq).where(Faq.id.not_in([f.id for f in faqs])).values(is_active=False))


def seed_company(db: Session, source: Path, deactivate_others: bool = True) -> None:
    images = _Images(source)
    SettingsService(db).update(data.SETTINGS)
    _seed_about(db)
    showroom = _seed_showroom(db, images)
    post = _seed_blog_post(db, images)
    banners = _seed_banners(db, images)
    faqs = _seed_faqs(db)
    db.flush()
    if deactivate_others:
        _deactivate_others(db, showroom, post, banners, faqs)
    db.commit()
    log.info("Company content imported (%d banners, %d FAQs, deactivate_others=%s)",
             len(banners), len(faqs), deactivate_others)


def main() -> None:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Import company details from the saved Facebook page")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="folder with the saved page images")
    parser.add_argument("--keep-existing", action="store_true", help="do not deactivate other content")
    args = parser.parse_args()
    with SessionLocal() as db:
        seed_company(db, args.source, deactivate_others=not args.keep_existing)


if __name__ == "__main__":
    main()
