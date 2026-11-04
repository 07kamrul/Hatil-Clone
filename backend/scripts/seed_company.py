"""Idempotent import of the company's own details from the saved Facebook page (facebook/).

Updates site settings (including the logo from the profile picture) and the About page, and upserts the
showroom, banners (the cover photo is the hero banner), FAQs, categories, products and blog posts.
Previous showrooms, banners, FAQs, blog posts and products (e.g. scraped or demo content) are deactivated
unless --keep-existing is passed. Nothing is deleted.

Usage:
    python -m scripts.seed_company [--source ../facebook/Facebook_files] [--keep-existing]
"""

import argparse
import io
import logging
from datetime import UTC, datetime
from decimal import Decimal
from pathlib import Path

from PIL import Image
from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.enums import StockStatus
from app.core.text import slugify
from app.db.session import SessionLocal
from app.models import Banner, BlogPost, Category, Faq, Page, Product, ProductImage, Showroom
from app.services.settings_service import SettingsService
from app.storage import get_storage
from app.storage.base import InvalidImageError, StoredImage
from scripts import company_data as data

log = logging.getLogger("seed_company")

DEFAULT_SOURCE = Path(__file__).resolve().parents[2] / "facebook" / "Facebook_files"


class _Images:
    """Uploads each source image at most once per run; returns None for missing or invalid files."""

    def __init__(self, source: Path) -> None:
        self.source = source
        self.stored: dict[str, StoredImage | None] = {}

    def get(self, key: str, folder: str) -> StoredImage | None:
        if key not in self.stored:
            self.stored[key] = self._upload(key, folder)
        return self.stored[key]

    def url(self, key: str, folder: str) -> str | None:
        stored = self.get(key, folder)
        return stored.url if stored else None

    def _read(self, key: str) -> bytes | None:
        if key in data.IMAGE_CROPS:
            source_key, box = data.IMAGE_CROPS[key]
            raw = self._read(source_key)
            return None if raw is None else _crop(raw, box)
        path = self.source / data.IMAGE_FILES[key]
        if not path.is_file():
            log.warning("Image %s not found at %s; skipping", key, path)
            return None
        return path.read_bytes()

    def _upload(self, key: str, folder: str) -> StoredImage | None:
        try:
            raw = self._read(key)
            return None if raw is None else get_storage().save_image(raw, folder, f"company-{key}")
        except InvalidImageError as exc:
            log.warning("Image %s is not usable (%s); skipping", key, exc)
            return None


def _crop(raw: bytes, box: tuple[float, float, float, float]) -> bytes:
    """Cut a fractional (left, top, right, bottom) region out of an image and return it as PNG bytes."""
    try:
        with Image.open(io.BytesIO(raw)) as img:
            width, height = img.size
            region = img.crop((round(box[0] * width), round(box[1] * height),
                               round(box[2] * width), round(box[3] * height)))
            out = io.BytesIO()
            region.convert("RGB").save(out, format="PNG")
            return out.getvalue()
    except OSError as exc:
        raise InvalidImageError("File is not a valid image") from exc


def _seed_logo(db: Session, images: _Images) -> None:
    logo = images.url("logo", "branding")
    if logo:
        SettingsService(db).update({"logo_url": logo})


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


def _seed_posts(db: Session, images: _Images) -> list[BlogPost]:
    posts = []
    for slug, title, excerpt, tags, published_at, cover_key, image_keys in data.POSTS:
        post = db.scalar(select(BlogPost).where(BlogPost.slug == slug))
        if post is None:
            post = BlogPost(slug=slug, title=title)
            db.add(post)
        urls = [u for u in (images.url(k, "blog") for k in image_keys) if u]
        post.title, post.excerpt, post.tags, post.author = title, excerpt, tags, data.SITE_NAME
        post.body_html = f"<p>{excerpt}</p>" + "".join(f'<p><img src="{u}" alt="{title}"></p>' for u in urls) + (
            f"<p>WhatsApp: {data.WHATSAPP}<br>Sharjah, UAE</p>")
        post.cover_image = images.url(cover_key, "blog") or post.cover_image
        post.published_at = datetime.fromisoformat(published_at)
        post.is_published, post.seo_title = True, title
        posts.append(post)
    return posts


def _seed_categories(db: Session, images: _Images) -> dict[str, Category]:
    categories = {}
    for i, (slug, name, description, image_key) in enumerate(data.CATEGORIES):
        category = db.scalar(select(Category).where(Category.slug == slug))
        if category is None:
            category = Category(slug=slug, name=name)
            db.add(category)
        category.name, category.description_html = name, f"<p>{description}</p>"
        category.sort_order, category.is_active, category.show_in_menu = i, True, True
        category.is_featured, category.seo_title = True, name
        category.image = images.url(image_key, "categories") or category.image
        categories[slug] = category
    return categories


def _seed_products(db: Session, images: _Images, categories: dict[str, Category]) -> list[Product]:
    products = []
    for sku, name, category_slug, image_key, short_desc in data.PRODUCTS:
        product = db.scalar(select(Product).where(Product.sku == sku))
        if product is None:
            product = Product(sku=sku, slug=slugify(name), name=name, price=Decimal("0"))
            db.add(product)
        product.name, product.short_desc = name, short_desc
        product.description_html = f"<p>{short_desc}</p><p>{data.MADE_TO_ORDER}</p>"
        product.category = categories[category_slug]
        product.stock_status, product.is_published = StockStatus.MADE_TO_ORDER, True
        product.is_featured, product.seo_title = True, name
        stored = images.get(image_key, "products")
        if stored and not product.images:
            product.images.append(ProductImage(path=stored.url, thumb_path=stored.thumb_url, alt=name))
        products.append(product)
    return products


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


def _deactivate_others(db: Session, showroom: Showroom, posts: list[BlogPost], banners: list[Banner],
                       faqs: list[Faq], categories: list[Category], products: list[Product]) -> None:
    db.execute(update(Showroom).where(Showroom.id != showroom.id).values(is_active=False))
    db.execute(update(BlogPost).where(BlogPost.id.not_in([p.id for p in posts])).values(is_published=False))
    db.execute(update(Banner).where(Banner.id.not_in([b.id for b in banners])).values(is_active=False))
    db.execute(update(Faq).where(Faq.id.not_in([f.id for f in faqs])).values(is_active=False))
    db.execute(update(Category).where(Category.id.not_in([c.id for c in categories])).values(is_active=False))
    db.execute(update(Product).where(Product.id.not_in([p.id for p in products])).values(is_published=False))


def seed_company(db: Session, source: Path, deactivate_others: bool = True) -> None:
    images = _Images(source)
    SettingsService(db).update(data.SETTINGS)
    _seed_logo(db, images)
    _seed_about(db)
    showroom = _seed_showroom(db, images)
    post = _seed_blog_post(db, images)
    posts = [post, *_seed_posts(db, images)]
    banners = _seed_banners(db, images)
    faqs = _seed_faqs(db)
    categories = _seed_categories(db, images)
    products = _seed_products(db, images, categories)
    db.flush()
    if deactivate_others:
        _deactivate_others(db, showroom, posts, banners, faqs, list(categories.values()), products)
    db.commit()
    log.info("Company content imported (%d banners, %d FAQs, %d categories, %d products, %d posts, "
             "deactivate_others=%s)", len(banners), len(faqs), len(categories), len(products), len(posts),
             deactivate_others)


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
