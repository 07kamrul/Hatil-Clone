from decimal import ROUND_HALF_UP, Decimal
from typing import Any

from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.errors import ConflictError, NotFoundError, ValidationAppError
from app.core.text import sanitize_html, slugify
from app.mappers.catalog import product_card, product_detail
from app.models import (
    Color,
    Material,
    Product,
    ProductImage,
    ProductSpec,
    ProductVariant,
    Room,
    product_colors,
    product_materials,
    product_rooms,
)
from app.repositories.base import Repository
from app.repositories.category_repository import CategoryRepository
from app.repositories.product_repository import ProductRepository
from app.schemas.catalog import (
    BulkPrice,
    FacetOption,
    ProductCard,
    ProductDetail,
    ProductFacets,
    ProductFilters,
    ProductIn,
    ProductUpdate,
    SpecIn,
    VariantIn,
)
from app.schemas.common import Page, PageParams
from app.storage import get_storage

_RELATION_FIELDS = ("color_ids", "material_ids", "room_ids", "variants", "specs")


class ProductService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = ProductRepository(db)
        self.categories = CategoryRepository(db)

    # ---------- Queries ----------
    def search(self, filters: ProductFilters, params: PageParams) -> Page[ProductCard]:
        stmt = self.repo.filtered_query(filters, self._category_scope(filters.category))
        items, total = self.repo.page_cards(stmt, params.offset, params.page_size)
        return Page[ProductCard].build([product_card(p) for p in items], total, params)

    def facets(self, filters: ProductFilters) -> ProductFacets:
        base_filters = ProductFilters(category=filters.category, q=filters.q, published=filters.published)
        base = self.repo.filtered_query(base_filters, self._category_scope(filters.category))

        def options(table, fk, model) -> list[FacetOption]:  # noqa: ANN001
            return [FacetOption(slug=m.slug, name=m.name, count=n, hex_code=getattr(m, "hex_code", None))
                    for m, n in self.repo.facet_counts(base, table, fk, model)]

        low, high = self.repo.price_bounds(base)
        return ProductFacets(
            colors=options(product_colors, product_colors.c.color_id, Color),
            materials=options(product_materials, product_materials.c.material_id, Material),
            rooms=options(product_rooms, product_rooms.c.room_id, Room),
            availability=[FacetOption(slug=s.value, name=s.value.replace("_", " ").title(), count=n)
                          for s, n in self.repo.stock_counts(base)],
            min_price=low, max_price=high,
        )

    def get_detail(self, product_id: int) -> ProductDetail:
        return self._to_detail(self._get_full(id=product_id))

    def get_public_detail(self, slug: str) -> ProductDetail:
        product = self._get_full(slug=slug, is_published=True)
        self.repo.increment_views(product.id)
        self.db.commit()
        return self._to_detail(product)

    def related(self, slug: str, limit: int) -> list[ProductCard]:
        product = self.repo.get_by(slug=slug, is_published=True)
        if product is None:
            raise NotFoundError("Product not found")
        return [product_card(p) for p in self.repo.related(product, limit)]

    def details_by_ids(self, ids: list[int]) -> list[ProductDetail]:
        details = []
        for product_id in ids:
            product = self.repo.get_detail(id=product_id, is_published=True)
            if product is not None:
                details.append(self._to_detail(product))
        return details

    def by_ids(self, ids: list[int]) -> list[ProductCard]:
        return [product_card(p) for p in self.repo.by_ids_ordered(ids)]

    # ---------- Commands ----------
    def create(self, data: ProductIn) -> ProductDetail:
        values = data.model_dump(exclude=set(_RELATION_FIELDS))
        self._check_unique_sku(values["sku"], None)
        self._check_category(values.get("category_id"))
        values["slug"] = self.repo.unique_slug(slugify(values.get("slug") or values["name"]))
        values["description_html"] = sanitize_html(values.get("description_html"))
        product = Product(**values)
        self._apply_relations(product, data.model_dump(include=set(_RELATION_FIELDS)))
        self.repo.add(product)
        self.db.commit()
        return self.get_detail(product.id)

    def update(self, product_id: int, data: ProductUpdate) -> ProductDetail:
        product = self._get_full(id=product_id)
        values = data.model_dump(exclude_unset=True)
        relations = {k: values.pop(k) for k in _RELATION_FIELDS if k in values}
        if "sku" in values:
            self._check_unique_sku(values["sku"], product.id)
        if "category_id" in values:
            self._check_category(values["category_id"])
        if values.get("slug"):
            values["slug"] = self.repo.unique_slug(slugify(values["slug"]), product.id)
        else:
            values.pop("slug", None)
        if "description_html" in values:
            values["description_html"] = sanitize_html(values["description_html"])
        price = values.get("price", product.price)
        sale = values.get("sale_price", product.sale_price)
        if sale is not None and sale >= price:
            raise ValidationAppError("sale_price must be lower than price")
        self.repo.update(product, values)
        self._apply_relations(product, relations)
        self.db.commit()
        return self.get_detail(product.id)

    def delete(self, product_id: int) -> None:
        product = self._get_full(id=product_id)
        storage = get_storage()
        for image in product.images:
            storage.delete(image.path)
            if image.thumb_path:
                storage.delete(image.thumb_path)
        self.repo.delete(product)
        self.db.commit()

    def bulk_publish(self, ids: list[int], is_published: bool) -> int:
        result = self.db.execute(update(Product).where(Product.id.in_(ids)).values(is_published=is_published))
        self.db.commit()
        return result.rowcount or 0

    def bulk_delete(self, ids: list[int]) -> int:
        count = 0
        for product_id in ids:
            if self.repo.get(product_id):
                self.delete(product_id)
                count += 1
        return count

    def bulk_price(self, data: BulkPrice) -> int:
        products = self.repo.get_many(data.ids)
        for product in products:
            current = getattr(product, data.target)
            if data.target == "sale_price" and current is None and data.mode != "set":
                continue
            new_value = _apply_price_change(current, data)
            if data.target == "price" and product.sale_price is not None and product.sale_price >= new_value:
                product.sale_price = None
            if data.target == "sale_price" and new_value >= product.price:
                raise ValidationAppError(f"Sale price for {product.sku} would not be below its regular price")
            setattr(product, data.target, new_value)
        self.db.commit()
        return len(products)

    # ---------- Images ----------
    def add_images(self, product_id: int, files: list[tuple[bytes, str]]) -> ProductDetail:
        product = self._get_full(id=product_id)
        storage = get_storage()
        start = max((i.sort_order for i in product.images), default=-1) + 1
        for offset, (data, _filename) in enumerate(files):
            stored = storage.save_image(data, f"products/{product.id}", product.slug)
            product.images.append(ProductImage(path=stored.url, thumb_path=stored.thumb_url, alt=product.name,
                                               sort_order=start + offset))
        self.db.commit()
        return self.get_detail(product.id)

    def reorder_images(self, product_id: int, image_ids: list[int]) -> ProductDetail:
        product = self._get_full(id=product_id)
        by_id = {img.id: img for img in product.images}
        if set(image_ids) != set(by_id):
            raise ValidationAppError("image_ids must list every image of the product exactly once")
        for position, image_id in enumerate(image_ids):
            by_id[image_id].sort_order = position
        self.db.commit()
        self.db.expire(product, ["images"])
        return self.get_detail(product.id)

    def update_image(self, product_id: int, image_id: int, values: dict[str, Any]) -> ProductDetail:
        image = self._get_image(product_id, image_id)
        for key, value in values.items():
            setattr(image, key, value)
        self.db.commit()
        return self.get_detail(product_id)

    def delete_image(self, product_id: int, image_id: int) -> ProductDetail:
        image = self._get_image(product_id, image_id)
        storage = get_storage()
        storage.delete(image.path)
        if image.thumb_path:
            storage.delete(image.thumb_path)
        self.db.delete(image)
        self.db.commit()
        return self.get_detail(product_id)

    # ---------- Helpers ----------
    def _category_scope(self, slug: str | None) -> list[int] | None:
        if not slug:
            return None
        category = self.categories.get_by(slug=slug)
        if category is None:
            raise NotFoundError("Category not found")
        return self.categories.descendant_ids(category.id)

    def _get_full(self, **filters: Any) -> Product:
        product = self.repo.get_detail(**filters)
        if product is None:
            raise NotFoundError("Product not found")
        return product

    def _to_detail(self, product: Product) -> ProductDetail:
        crumbs = self.categories.ancestors(product.category) if product.category else []
        return product_detail(product, crumbs)

    def _get_image(self, product_id: int, image_id: int) -> ProductImage:
        image = self.db.get(ProductImage, image_id)
        if image is None or image.product_id != product_id:
            raise NotFoundError("Image not found")
        return image

    def _check_unique_sku(self, sku: str, exclude_id: int | None) -> None:
        stmt = select(Product.id).where(Product.sku == sku)
        if exclude_id is not None:
            stmt = stmt.where(Product.id != exclude_id)
        if self.db.scalar(stmt.limit(1)) is not None:
            raise ConflictError(f"SKU '{sku}' is already used by another product")

    def _check_category(self, category_id: int | None) -> None:
        if category_id is not None and self.categories.get(category_id) is None:
            raise ValidationAppError("Category does not exist")

    def _apply_relations(self, product: Product, relations: dict[str, Any]) -> None:
        if relations.get("color_ids") is not None:
            product.colors = Repository(self.db, Color).get_many(relations["color_ids"])
        if relations.get("material_ids") is not None:
            product.materials = Repository(self.db, Material).get_many(relations["material_ids"])
        if relations.get("room_ids") is not None:
            product.rooms = Repository(self.db, Room).get_many(relations["room_ids"])
        if relations.get("variants") is not None:
            product.variants = [ProductVariant(**VariantIn.model_validate(v).model_dump(exclude={"id"}))
                                for v in relations["variants"]]
        if relations.get("specs") is not None:
            product.specs = [ProductSpec(sort_order=i, **SpecIn.model_validate(s).model_dump())
                             for i, s in enumerate(relations["specs"])]


def _apply_price_change(current: Decimal | None, data: BulkPrice) -> Decimal:
    base = current or Decimal("0")
    if data.mode == "percent":
        value = base * (Decimal("1") + data.value / Decimal("100"))
    elif data.mode == "fixed":
        value = base + data.value
    else:
        value = data.value
    if data.round_to:
        step = Decimal(data.round_to)
        value = (value / step).quantize(Decimal("1"), rounding=ROUND_HALF_UP) * step
    value = value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    if value < 0:
        raise ValidationAppError("Price change would make a price negative")
    return value
