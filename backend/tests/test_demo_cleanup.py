"""Seed-placeholder recognition and the category-image replacement rule."""

from decimal import Decimal

import pytest

from app.models import Category, Product, ProductImage
from app.services.product_import_service import ProductImporter
from scraper.demo_cleanup import is_seed_image


@pytest.fixture
def living_room(db) -> Category:
    category = Category(slug="living-room", name="Living Room", image="/uploads/categories/seed-living-room-ab12.webp")
    db.add(category)
    db.commit()
    return category


def _product(db, category: Category) -> Product:
    product = Product(slug="nova-sofa", sku="SKU-1", name="Nova Sofa", price=Decimal("100"))
    product.images.append(ProductImage(path="/uploads/products/nova-1.webp", alt="Nova", sort_order=0))
    product.category_id = category.id
    db.add(product)
    db.commit()
    return product


def test_seed_image_marker_detection() -> None:
    assert is_seed_image("/uploads/categories/seed-living-room-ab12.webp")
    assert not is_seed_image("/uploads/categories/nova-photo-ab12.webp")
    assert not is_seed_image(None)


def test_importer_replaces_seed_category_image(db, living_room, monkeypatch, tmp_path) -> None:
    from app.storage.local import LocalStorage
    from tests.conftest import png_bytes

    deleted: list[str] = []
    storage = LocalStorage(str(tmp_path / "up"), "/uploads")
    monkeypatch.setattr("app.services.product_import_service.get_storage", lambda: storage)
    monkeypatch.setattr(storage, "delete", deleted.append, raising=False)

    product = _product(db, living_room)
    importer = ProductImporter(db, image_fetcher=lambda _url: png_bytes("blue"))
    importer._maybe_image_category(product)  # noqa: SLF001 - unit under test

    assert living_room.image == "/uploads/products/nova-1.webp"
    assert deleted == ["/uploads/categories/seed-living-room-ab12.webp"]


def test_importer_keeps_real_category_image(db, living_room, monkeypatch, tmp_path) -> None:
    from app.storage.local import LocalStorage

    storage = LocalStorage(str(tmp_path / "up"), "/uploads")
    monkeypatch.setattr("app.services.product_import_service.get_storage", lambda: storage)
    living_room.image = "/uploads/categories/admin-upload-ab12.webp"

    product = _product(db, living_room)
    ProductImporter(db)._maybe_image_category(product)  # noqa: SLF001

    assert living_room.image == "/uploads/categories/admin-upload-ab12.webp"
