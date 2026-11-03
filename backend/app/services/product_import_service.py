"""Idempotent product upsert shared by the admin CSV/Excel importer and the scraper."""

import csv
import io
import logging
from collections.abc import Callable
from dataclasses import dataclass, field
from decimal import Decimal, InvalidOperation
from typing import Any

from openpyxl import Workbook, load_workbook
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.enums import StockStatus
from app.core.errors import ValidationAppError
from app.core.text import rebrand, sanitize_html, slugify
from app.models import Category, Color, Material, Product, ProductImage, ProductSpec, Room
from app.repositories.base import Repository
from app.schemas.catalog import ImportResult
from app.storage import get_storage
from app.storage.base import InvalidImageError

log = logging.getLogger("app.import")

ImageFetcher = Callable[[str], bytes]

EXPORT_COLUMNS = [
    "sku", "name", "slug", "category_path", "price", "sale_price", "stock_status", "short_desc",
    "description_html", "dimensions", "warranty", "colors", "materials", "rooms", "specs", "images",
    "is_featured", "is_best_seller", "is_published", "seo_title", "seo_description", "seo_keywords", "source_url",
]
LIST_SEP = "|"
MAX_IMPORT_ROWS = 20_000
_TRUE = {"1", "true", "yes", "y"}


@dataclass
class ProductImportData:
    sku: str
    name: str
    price: Decimal
    slug: str | None = None
    category_path: list[str] = field(default_factory=list)
    sale_price: Decimal | None = None
    stock_status: StockStatus = StockStatus.IN_STOCK
    short_desc: str | None = None
    description_html: str | None = None
    dimensions: str | None = None
    warranty: str | None = None
    colors: list[str] = field(default_factory=list)
    materials: list[str] = field(default_factory=list)
    rooms: list[str] = field(default_factory=list)
    specs: list[tuple[str, str]] = field(default_factory=list)
    images: list[str] = field(default_factory=list)
    is_featured: bool | None = None
    is_best_seller: bool | None = None
    is_published: bool | None = None
    seo_title: str | None = None
    seo_description: str | None = None
    seo_keywords: str | None = None
    source_url: str | None = None


class ProductImporter:
    def __init__(self, db: Session, image_fetcher: ImageFetcher | None = None) -> None:
        self.db = db
        self.image_fetcher = image_fetcher
        self.settings = get_settings()

    def upsert(self, data: ProductImportData, replace_images: bool = False) -> tuple[str, Product]:
        data = self._rebranded(data)
        product = self._find(data)
        action = "updated" if product else "created"
        if product is None:
            slug = Repository(self.db, Product).unique_slug(slugify(data.slug or data.name))
            product = Product(slug=slug, sku=data.sku, name=data.name, price=data.price)
            self.db.add(product)
        self._assign_fields(product, data)
        if data.images and (replace_images or not product.images):
            self._attach_images(product, data.images, replace=replace_images)
        self.db.flush()
        return action, product

    def import_file(self, content: bytes, filename: str) -> ImportResult:
        rows = parse_rows(content, filename)
        created = updated = failed = 0
        errors: list[str] = []
        for line, row in enumerate(rows, start=2):
            try:
                with self.db.begin_nested():
                    action, _ = self.upsert(row_to_import(row))
                created += action == "created"
                updated += action == "updated"
            except (ValueError, ValidationAppError) as exc:
                failed += 1
                errors.append(f"Row {line}: {exc}")
        self.db.commit()
        return ImportResult(created=created, updated=updated, failed=failed, errors=errors[:200])

    # ---------- internals ----------
    def _find(self, data: ProductImportData) -> Product | None:
        stmt = select(Product).options(selectinload(Product.images))
        product = self.db.scalar(stmt.where(Product.sku == data.sku))
        if product is None and data.slug:
            product = self.db.scalar(stmt.where(Product.slug == slugify(data.slug)))
        return product

    def _rebranded(self, data: ProductImportData) -> ProductImportData:
        if self.settings.brand_mode != "neutral":
            return data
        terms, name = self.settings.brand_source_terms, self._site_name()
        for attr in ("name", "short_desc", "description_html", "seo_title", "seo_description", "seo_keywords",
                     "warranty"):
            setattr(data, attr, rebrand(getattr(data, attr), terms, name))
        data.specs = [(k, rebrand(v, terms, name) or "") for k, v in data.specs]
        return data

    def _site_name(self) -> str:
        from app.services.settings_service import SettingsService

        return str(SettingsService(self.db).get("site_name") or self.settings.default_site_name)

    def _assign_fields(self, product: Product, data: ProductImportData) -> None:
        product.sku = data.sku
        product.name = data.name
        product.price = data.price
        product.sale_price = data.sale_price if data.sale_price and data.sale_price < data.price else None
        product.stock_status = data.stock_status
        for attr in ("short_desc", "dimensions", "warranty", "seo_title", "seo_description", "seo_keywords",
                     "source_url"):
            value = getattr(data, attr)
            if value is not None:
                setattr(product, attr, value)
        if data.description_html is not None:
            product.description_html = sanitize_html(data.description_html)
        for flag in ("is_featured", "is_best_seller", "is_published"):
            if getattr(data, flag) is not None:
                setattr(product, flag, getattr(data, flag))
        if data.category_path:
            product.category_id = self._ensure_category_path(data.category_path).id
        if data.colors:
            product.colors = [self._ensure(Color, n) for n in data.colors]
        if data.materials:
            product.materials = [self._ensure(Material, n) for n in data.materials]
        if data.rooms:
            product.rooms = [self._ensure(Room, n) for n in data.rooms]
        if data.specs:
            product.specs = [ProductSpec(key=k[:150], value=v[:1000], sort_order=i)
                             for i, (k, v) in enumerate(data.specs) if k and v]

    def _ensure(self, model: type, name: str) -> Any:
        slug = slugify(name)
        obj = self.db.scalar(select(model).where(model.slug == slug))
        if obj is None:
            obj = model(name=name.strip()[:100], slug=slug)
            self.db.add(obj)
            self.db.flush()
        return obj

    def _ensure_category_path(self, path: list[str]) -> Category:
        parent: Category | None = None
        for name in path:
            slug = slugify(name)
            category = self.db.scalar(select(Category).where(Category.slug == slug))
            if category is None:
                category = Category(name=name.strip()[:200], slug=slug, parent_id=parent.id if parent else None)
                self.db.add(category)
                self.db.flush()
            parent = category
        assert parent is not None
        return parent

    def _attach_images(self, product: Product, urls: list[str], replace: bool) -> None:
        storage = get_storage()
        if replace:
            for image in list(product.images):
                storage.delete(image.path)
                if image.thumb_path:
                    storage.delete(image.thumb_path)
            product.images.clear()
        for position, url in enumerate(urls):
            stored_url, thumb_url = url, None
            if self.image_fetcher and url.startswith(("http://", "https://")):
                try:
                    stored = storage.save_image(self.image_fetcher(url), "products", product.slug)
                    stored_url, thumb_url = stored.url, stored.thumb_url
                except (InvalidImageError, OSError, ValueError) as exc:
                    log.warning("Skipping image %s: %s", url, exc)
                    continue
            product.images.append(ProductImage(path=stored_url, thumb_path=thumb_url, alt=product.name,
                                               sort_order=position))


# ---------- File parsing / export ----------
def parse_rows(content: bytes, filename: str) -> list[dict[str, str]]:
    name = filename.lower()
    if name.endswith(".csv"):
        text = content.decode("utf-8-sig", errors="replace")
        rows = [{k.strip(): (v or "").strip() for k, v in r.items() if k} for r in csv.DictReader(io.StringIO(text))]
    elif name.endswith((".xlsx", ".xlsm")):
        wb = load_workbook(io.BytesIO(content), read_only=True, data_only=True)
        sheet = wb.active
        values = list(sheet.iter_rows(values_only=True))
        if not values:
            return []
        headers = [str(h or "").strip() for h in values[0]]
        rows = [{h: "" if v is None else str(v).strip() for h, v in zip(headers, r, strict=False) if h}
                for r in values[1:] if any(c not in (None, "") for c in r)]
    else:
        raise ValidationAppError("Upload a .csv or .xlsx file")
    if len(rows) > MAX_IMPORT_ROWS:
        raise ValidationAppError(f"Too many rows (max {MAX_IMPORT_ROWS})")
    return rows


def _split(value: str | None) -> list[str]:
    return [p.strip() for p in (value or "").split(LIST_SEP) if p.strip()]


def _decimal(value: str | None, field_name: str, required: bool = False) -> Decimal | None:
    if value in (None, ""):
        if required:
            raise ValueError(f"{field_name} is required")
        return None
    try:
        number = Decimal(str(value).replace(",", ""))
    except InvalidOperation as exc:
        raise ValueError(f"{field_name} '{value}' is not a number") from exc
    if number < 0:
        raise ValueError(f"{field_name} cannot be negative")
    return number


def _bool(value: str | None) -> bool | None:
    return None if value in (None, "") else str(value).strip().lower() in _TRUE


def row_to_import(row: dict[str, str]) -> ProductImportData:
    sku, name = (row.get("sku") or "").strip(), (row.get("name") or "").strip()
    if not sku or not name:
        raise ValueError("sku and name are required")
    status_raw = (row.get("stock_status") or StockStatus.IN_STOCK.value).strip().lower()
    try:
        stock = StockStatus(status_raw)
    except ValueError as exc:
        raise ValueError(f"stock_status must be one of {[s.value for s in StockStatus]}") from exc
    specs = []
    for part in _split(row.get("specs")):
        key, _, value = part.partition(":")
        if key.strip() and value.strip():
            specs.append((key.strip(), value.strip()))
    return ProductImportData(
        sku=sku[:100], name=name[:255], slug=row.get("slug") or None,
        price=_decimal(row.get("price"), "price", required=True),  # type: ignore[arg-type]
        sale_price=_decimal(row.get("sale_price"), "sale_price"),
        category_path=[p.strip() for p in (row.get("category_path") or "").split(">") if p.strip()],
        stock_status=stock, short_desc=row.get("short_desc") or None,
        description_html=row.get("description_html") or None, dimensions=row.get("dimensions") or None,
        warranty=row.get("warranty") or None, colors=_split(row.get("colors")),
        materials=_split(row.get("materials")), rooms=_split(row.get("rooms")), specs=specs,
        images=_split(row.get("images")), is_featured=_bool(row.get("is_featured")),
        is_best_seller=_bool(row.get("is_best_seller")), is_published=_bool(row.get("is_published")),
        seo_title=row.get("seo_title") or None, seo_description=row.get("seo_description") or None,
        seo_keywords=row.get("seo_keywords") or None, source_url=row.get("source_url") or None,
    )


def product_to_row(product: Product, category_path: list[str]) -> dict[str, Any]:
    return {
        "sku": product.sku, "name": product.name, "slug": product.slug,
        "category_path": " > ".join(category_path), "price": str(product.price),
        "sale_price": "" if product.sale_price is None else str(product.sale_price),
        "stock_status": product.stock_status.value, "short_desc": product.short_desc or "",
        "description_html": product.description_html or "", "dimensions": product.dimensions or "",
        "warranty": product.warranty or "", "colors": LIST_SEP.join(c.name for c in product.colors),
        "materials": LIST_SEP.join(m.name for m in product.materials),
        "rooms": LIST_SEP.join(r.name for r in product.rooms),
        "specs": LIST_SEP.join(f"{s.key}: {s.value}" for s in product.specs),
        "images": LIST_SEP.join(i.path for i in product.images),
        "is_featured": str(product.is_featured).lower(), "is_best_seller": str(product.is_best_seller).lower(),
        "is_published": str(product.is_published).lower(), "seo_title": product.seo_title or "",
        "seo_description": product.seo_description or "", "seo_keywords": product.seo_keywords or "",
        "source_url": product.source_url or "",
    }


def export_products(db: Session, fmt: str) -> bytes:
    from app.repositories.category_repository import CategoryRepository

    categories = CategoryRepository(db)
    products = db.scalars(select(Product).order_by(Product.id).options(
        selectinload(Product.images), selectinload(Product.colors), selectinload(Product.materials),
        selectinload(Product.rooms), selectinload(Product.specs), selectinload(Product.category)))
    rows = [product_to_row(p, [c.name for c in categories.ancestors(p.category)] if p.category else [])
            for p in products]
    if fmt == "xlsx":
        wb = Workbook()
        ws = wb.active
        ws.title = "products"
        ws.append(EXPORT_COLUMNS)
        for row in rows:
            ws.append([_excel_safe(row[c]) for c in EXPORT_COLUMNS])
        out = io.BytesIO()
        wb.save(out)
        return out.getvalue()
    buffer = io.StringIO()
    writer = csv.DictWriter(buffer, fieldnames=EXPORT_COLUMNS)
    writer.writeheader()
    writer.writerows({k: _excel_safe(v) for k, v in row.items()} for row in rows)
    return buffer.getvalue().encode("utf-8-sig")


def _excel_safe(value: Any) -> Any:
    """Neutralise spreadsheet formula injection in exported text cells."""
    if isinstance(value, str) and value[:1] in ("=", "+", "-", "@") and not _looks_numeric(value):
        return "'" + value
    return value


def _looks_numeric(value: str) -> bool:
    try:
        Decimal(value)
        return True
    except InvalidOperation:
        return False
