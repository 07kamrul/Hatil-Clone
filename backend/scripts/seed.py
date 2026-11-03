"""Idempotent seed: super-admin, taxonomy, settings, CMS pages, FAQs, showrooms, blog and banners.

Usage:
    python -m scripts.seed           # base data
    python -m scripts.seed --demo    # base data + demo products with generated images
"""

import argparse
import io
import logging
from datetime import UTC, datetime
from decimal import Decimal

from PIL import Image, ImageDraw
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.enums import AdminRole, BannerPlacement
from app.core.security import hash_password
from app.core.site_settings import DEFAULT_SETTINGS
from app.core.text import slugify
from app.db.session import SessionLocal
from app.models import (
    AdminUser, Banner, BlogPost, Category, Color, Faq, Material, Page, Product, ProductImage,
    ProductSpec, ProductVariant, Room, Setting, Showroom,
)
from app.storage import get_storage
from scripts import seed_data as data

log = logging.getLogger("seed")

PALETTE = ["#8a5a2b", "#5d4037", "#37474f", "#6d4c41", "#455a64", "#795548", "#3e2723"]


def placeholder_image(text: str, size: tuple[int, int], color: str) -> bytes:
    img = Image.new("RGB", size, color)
    draw = ImageDraw.Draw(img)
    w, h = size
    draw.rectangle([w * 0.08, h * 0.08, w * 0.92, h * 0.92], outline="#ffffff", width=max(2, w // 200))
    draw.text((w * 0.12, h * 0.45), text, fill="#ffffff", font_size=max(16, w // 22))
    out = io.BytesIO()
    img.save(out, format="PNG")
    return out.getvalue()


def seed_admin(db: Session) -> None:
    settings = get_settings()
    email = settings.super_admin_email.lower()
    if db.scalar(select(AdminUser).where(AdminUser.email == email)):
        return
    db.add(AdminUser(email=email, full_name="Super Admin", role=AdminRole.SUPER_ADMIN,
                     password_hash=hash_password(settings.super_admin_password)))
    log.info("Created super admin %s", email)


def seed_settings(db: Session) -> None:
    existing = set(db.scalars(select(Setting.key)))
    for key, value in DEFAULT_SETTINGS.items():
        if key not in existing:
            if key == "site_name":
                value = get_settings().default_site_name
            db.add(Setting(key=key, value=value))


def _get_or_create(db: Session, model: type, slug: str, **fields: object) -> object:
    obj = db.scalar(select(model).where(model.slug == slug))
    if obj is None:
        obj = model(slug=slug, **fields)
        db.add(obj)
        db.flush()
    return obj


def seed_taxonomy(db: Session) -> None:
    for i, (room_name, children) in enumerate(data.CATEGORY_TREE):
        root = _get_or_create(db, Category, slugify(room_name), name=room_name, sort_order=i, is_featured=True)
        for j, (cat_name, subs) in enumerate(children):
            cat = _get_or_create(db, Category, slugify(cat_name), name=cat_name, parent_id=root.id, sort_order=j,
                                 is_featured=j < 2)
            for k, sub_name in enumerate(subs):
                _get_or_create(db, Category, slugify(sub_name), name=sub_name, parent_id=cat.id, sort_order=k)
    for i, name in enumerate(data.ROOMS):
        _get_or_create(db, Room, slugify(name), name=name, sort_order=i)
    for name, hex_code in data.COLORS:
        _get_or_create(db, Color, slugify(name), name=name, hex_code=hex_code)
    for name in data.MATERIALS:
        _get_or_create(db, Material, slugify(name), name=name)


def seed_content(db: Session) -> None:
    for title, slug, body in data.PAGES:
        _get_or_create(db, Page, slug, title=title, body_html=body, seo_title=title)
    if not db.scalar(select(Faq.id).limit(1)):
        for i, (question, answer, group, home) in enumerate(data.FAQS):
            db.add(Faq(question=question, answer_html=answer, group=group, sort_order=i, show_on_home=home))
    storage = get_storage()
    for i, room in enumerate(data.SHOWROOMS):
        slug = slugify(str(room["name"]))
        if not db.scalar(select(Showroom.id).where(Showroom.slug == slug)):
            img = storage.save_image(placeholder_image(str(room["name"]), (800, 500), PALETTE[i % len(PALETTE)]),
                                     "showrooms", slug)
            db.add(Showroom(slug=slug, image=img.url, sort_order=i, **room))
    for i, (title, excerpt, body) in enumerate(data.BLOG_POSTS):
        slug = slugify(title)
        if not db.scalar(select(BlogPost.id).where(BlogPost.slug == slug)):
            img = storage.save_image(placeholder_image(title[:28], (1200, 630), PALETTE[i % len(PALETTE)]), "blog", slug)
            db.add(BlogPost(title=title, slug=slug, excerpt=excerpt, body_html=body, cover_image=img.url,
                            author="Editorial Team", is_published=True, published_at=datetime.now(UTC)))


def seed_banners(db: Session) -> None:
    if db.scalar(select(Banner.id).limit(1)):
        return
    storage = get_storage()
    groups = [(BannerPlacement.HERO, data.HERO_BANNERS, (1600, 600)), (BannerPlacement.OFFER, data.OFFER_BANNERS, (800, 400))]
    for placement, banners, size in groups:
        for i, (title, subtitle, link, button) in enumerate(banners):
            img = storage.save_image(placeholder_image(title, size, PALETTE[i % len(PALETTE)]), "banners", title)
            db.add(Banner(title=title, subtitle=subtitle, image=img.url, link_url=link, button_text=button,
                          placement=placement, sort_order=i))


def seed_demo_products(db: Session) -> None:
    storage = get_storage()
    colors = {c.name: c for c in db.scalars(select(Color))}
    materials = {m.name: m for m in db.scalars(select(Material))}
    rooms = {r.name: r for r in db.scalars(select(Room))}
    categories = {c.name: c for c in db.scalars(select(Category))}
    for i, (name, cat, price, sale, cols, mats, rms, featured, best) in enumerate(data.DEMO_PRODUCTS):
        slug = slugify(name)
        if db.scalar(select(Product.id).where(Product.slug == slug)):
            continue
        product = Product(
            slug=slug, sku=f"DEMO-{i + 1:04d}", name=name,
            short_desc=f"{name} — designed for everyday comfort and built from carefully selected materials.",
            description_html=f"<p>The <strong>{name}</strong> combines clean lines with durable construction.</p>"
                             "<ul><li>Hand-finished surfaces</li><li>Easy to clean</li><li>Assembled on delivery</li></ul>",
            price=Decimal(price), sale_price=Decimal(sale) if sale else None,
            category_id=categories[cat].id if cat in categories else None,
            dimensions="L 210 cm × W 90 cm × H 85 cm", warranty=DEFAULT_SETTINGS["default_warranty"],
            is_featured=featured, is_best_seller=best, view_count=(len(data.DEMO_PRODUCTS) - i) * 7,
        )
        product.colors = [colors[c] for c in cols if c in colors]
        product.materials = [materials[m] for m in mats if m in materials]
        product.rooms = [rooms[r] for r in rms if r in rooms]
        for j in range(3):
            img = storage.save_image(placeholder_image(name[:22], (1000, 1000), PALETTE[(i + j) % len(PALETTE)]),
                                     "products", slug)
            product.images.append(ProductImage(path=img.url, thumb_path=img.thumb_url, alt=name, sort_order=j))
        for col in product.colors:
            product.variants.append(ProductVariant(color_id=col.id, sku=f"{product.sku}-{col.slug[:3].upper()}"))
        specs = [("Dimensions", product.dimensions), ("Material", ", ".join(mats)), ("Finish", "Lacquer"),
                 ("Assembly", "Assembled on delivery")]
        product.specs = [ProductSpec(key=k, value=v, sort_order=n) for n, (k, v) in enumerate(specs)]
        db.add(product)


def run(demo: bool) -> None:
    with SessionLocal() as db:
        seed_admin(db)
        seed_settings(db)
        seed_taxonomy(db)
        seed_content(db)
        seed_banners(db)
        if demo:
            seed_demo_products(db)
        db.commit()
    log.info("Seed complete (demo=%s)", demo)


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
    parser = argparse.ArgumentParser(description="Seed the database")
    parser.add_argument("--demo", action="store_true", help="also create demo products")
    run(parser.parse_args().demo)
