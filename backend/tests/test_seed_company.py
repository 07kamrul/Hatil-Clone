from pathlib import Path

from PIL import Image
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import BannerPlacement
from app.models import Banner, BlogPost, Category, Faq, Page, Product, Showroom
from app.services.settings_service import SettingsService
from scripts import company_data as data
from scripts.seed_company import seed_company


def _fake_fb_images(folder: Path) -> Path:
    for i, name in enumerate(data.IMAGE_FILES.values()):
        Image.new("RGB", (400, 300), (15 * i, 80, 120)).save(folder / name, format="PNG")
    return folder


def _count(db: Session, model: type, *where: object) -> int:
    return db.scalar(select(func.count()).select_from(model).where(*where))


def test_seed_company_sets_business_settings(db: Session, tmp_path: Path) -> None:
    seed_company(db, _fake_fb_images(tmp_path))

    settings = SettingsService(db).all()
    assert settings["site_name"] == "Sahat Al Ramlah Furniture"
    assert settings["whatsapp_number"] == "971558907793"
    assert settings["currency"] == "AED"
    assert "Sharjah" in settings["address"]


def test_seed_company_creates_content(db: Session, tmp_path: Path) -> None:
    seed_company(db, _fake_fb_images(tmp_path))

    about = db.scalar(select(Page).where(Page.slug == "about"))
    assert about is not None and "Sahat Al Ramlah" in about.body_html
    showroom = db.scalar(select(Showroom).where(Showroom.slug == data.SHOWROOM["slug"]))
    assert showroom is not None and showroom.is_active and showroom.image
    post = db.scalar(select(BlogPost).where(BlogPost.slug == data.BLOG_POST["slug"]))
    assert post is not None and post.is_published and post.cover_image
    assert _count(db, Banner, Banner.is_active, Banner.placement == BannerPlacement.HERO) == 1
    assert _count(db, Faq, Faq.is_active) == len(data.FAQS)


def test_seed_company_uses_profile_picture_as_logo_and_cover_as_banner(db: Session, tmp_path: Path) -> None:
    seed_company(db, _fake_fb_images(tmp_path))

    assert SettingsService(db).all()["logo_url"]
    hero = db.scalar(select(Banner).where(Banner.placement == BannerPlacement.HERO))
    assert hero is not None and hero.image


def test_seed_company_groups_products_by_category_with_images(db: Session, tmp_path: Path) -> None:
    seed_company(db, _fake_fb_images(tmp_path))

    for slug, *_ in data.CATEGORIES:
        category = db.scalar(select(Category).where(Category.slug == slug))
        assert category is not None and category.image
        assert _count(db, Product, Product.category_id == category.id) > 0
    expected_images = [p for p in db.scalars(select(Product)) if p.images]
    assert len(expected_images) == len(data.PRODUCTS)
    assert len({p.images[0].path for p in expected_images}) == len(data.PRODUCTS)


def test_seed_company_imports_posts_with_images(db: Session, tmp_path: Path) -> None:
    seed_company(db, _fake_fb_images(tmp_path))

    post = db.scalar(select(BlogPost).where(BlogPost.slug == data.POSTS[1][0]))
    assert post is not None and post.cover_image and len(post.gallery) == len(data.POSTS[1][6])
    assert "<img" not in post.body_html
    assert post.published_at.year == 2026


def test_seed_company_is_idempotent(db: Session, tmp_path: Path) -> None:
    folder = _fake_fb_images(tmp_path)
    seed_company(db, folder)
    seed_company(db, folder)

    assert _count(db, Showroom) == 1
    assert _count(db, BlogPost) == 1 + len(data.POSTS)
    assert _count(db, Category) == len(data.CATEGORIES)
    assert _count(db, Product) == len(data.PRODUCTS)
    assert _count(db, Banner) == len(data.BANNERS)
    assert _count(db, Faq) == len(data.FAQS)


def test_seed_company_deactivates_previous_content(db: Session, tmp_path: Path) -> None:
    db.add(Showroom(name="Old", slug="old", city="Dhaka", address="Gulshan"))
    db.add(BlogPost(title="Old post", slug="old-post", is_published=True))
    db.add(Banner(title="Old banner", image="/uploads/x.webp"))
    db.add(Faq(question="Old?", answer_html="<p>x</p>"))
    db.commit()

    seed_company(db, _fake_fb_images(tmp_path))

    assert not db.scalar(select(Showroom).where(Showroom.slug == "old")).is_active
    assert not db.scalar(select(BlogPost).where(BlogPost.slug == "old-post")).is_published
    assert not db.scalar(select(Banner).where(Banner.title == "Old banner")).is_active
    assert not db.scalar(select(Faq).where(Faq.question == "Old?")).is_active


def test_seed_company_keep_existing_leaves_previous_content(db: Session, tmp_path: Path) -> None:
    db.add(Showroom(name="Old", slug="old", city="Dhaka", address="Gulshan"))
    db.commit()

    seed_company(db, _fake_fb_images(tmp_path), deactivate_others=False)

    assert db.scalar(select(Showroom).where(Showroom.slug == "old")).is_active


def test_seed_company_skips_missing_images(db: Session, tmp_path: Path) -> None:
    seed_company(db, tmp_path)

    showroom = db.scalar(select(Showroom).where(Showroom.slug == data.SHOWROOM["slug"]))
    assert showroom is not None and showroom.image is None
    assert _count(db, Banner) == 0
    assert _count(db, Product, Product.images.any()) == 0


def test_seed_company_deactivates_previous_products_and_categories(db: Session, tmp_path: Path) -> None:
    db.add(Category(name="Old", slug="old-cat"))
    db.add(Product(name="Old", slug="old-prod", sku="OLD-1", price=10))
    db.commit()

    seed_company(db, _fake_fb_images(tmp_path))

    assert not db.scalar(select(Category).where(Category.slug == "old-cat")).is_active
    assert not db.scalar(select(Product).where(Product.sku == "OLD-1")).is_published
