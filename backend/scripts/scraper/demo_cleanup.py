"""Identify rows and images created by `scripts.seed --demo` so a successful scrape can replace them.

Seed images are saved with a `seed-` name marker (scripts/seed.py), so a stored URL containing
`/seed-` is always a generated placeholder. Older databases seeded before the marker existed are
covered by matching the seed_data slugs/titles as well; both checks are required together so an
admin-uploaded photo is never deleted.
"""

import logging

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.text import slugify
from app.models import Banner, BlogPost, Category, Showroom
from scripts import seed_data


def is_seed_image(url: str | None) -> bool:
    return bool(url) and "/seed-" in url


def seed_showroom_slugs() -> set[str]:
    return {slugify(str(room["name"])) for room in seed_data.SHOWROOMS}


def seed_blog_slugs() -> set[str]:
    return {slugify(title) for title, _, _ in seed_data.BLOG_POSTS}


def seed_banner_titles() -> set[str]:
    return {title for title, *_ in (*seed_data.HERO_BANNERS, *seed_data.OFFER_BANNERS)}


def purge_seed_showrooms(db: Session, storage) -> int:
    rows = [r for r in db.scalars(select(Showroom).where(Showroom.slug.in_(seed_showroom_slugs())))
            if is_seed_image(r.image)]
    return _purge(db, storage, rows)


def purge_seed_blog(db: Session, storage) -> int:
    rows = [r for r in db.scalars(select(BlogPost).where(BlogPost.slug.in_(seed_blog_slugs())))
            if is_seed_image(r.cover_image)]
    return _purge(db, storage, rows)


def purge_seed_banners(db: Session, storage) -> int:
    rows = [r for r in db.scalars(select(Banner).where(Banner.title.in_(seed_banner_titles())))
            if is_seed_image(r.image)]
    return _purge(db, storage, rows)


def purge_seed_category_image(db: Session, storage, category: Category) -> bool:
    """Delete a category's seed placeholder image; returns True when one was removed."""
    if not is_seed_image(category.image):
        return False
    _delete_files(storage, [category.image])
    return True


def _purge(db: Session, storage, rows: list) -> int:
    for row in rows:
        _delete_files(storage, [getattr(row, "image", None) or getattr(row, "cover_image", None)])
        db.delete(row)
    return len(rows)


def _delete_files(storage, urls: list[str | None]) -> None:
    for url in urls:
        if url:
            try:
                storage.delete(url)
            except OSError as exc:
                logging.getLogger("scraper.demo_cleanup").warning("Could not delete %s: %s", url, exc)
