from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.enums import ProductSort
from app.models import Color, Material, Product, Room, product_colors, product_materials, product_rooms
from app.repositories.base import Repository
from app.schemas.catalog import ProductFilters

EFFECTIVE_PRICE = func.coalesce(Product.sale_price, Product.price)

CARD_LOADERS = (selectinload(Product.images), selectinload(Product.category), selectinload(Product.colors))
DETAIL_LOADERS = (
    *CARD_LOADERS,
    selectinload(Product.variants),
    selectinload(Product.specs),
    selectinload(Product.materials),
    selectinload(Product.rooms),
)

_SORTS = {
    ProductSort.NEWEST: (Product.created_at.desc(), Product.id.desc()),
    ProductSort.PRICE_ASC: (EFFECTIVE_PRICE.asc(), Product.id.asc()),
    ProductSort.PRICE_DESC: (EFFECTIVE_PRICE.desc(), Product.id.desc()),
    ProductSort.POPULAR: (Product.view_count.desc(), Product.id.desc()),
    ProductSort.NAME: (Product.name.asc(), Product.id.asc()),
}


class ProductRepository(Repository[Product]):
    def __init__(self, db: Session) -> None:
        super().__init__(db, Product)

    def get_detail(self, **filters: object) -> Product | None:
        return self.db.scalar(select(Product).filter_by(**filters).options(*DETAIL_LOADERS).limit(1))

    def filtered_query(self, f: ProductFilters, category_ids: list[int] | None) -> Select[tuple[Product]]:
        stmt = select(Product)
        if f.published is not None:
            stmt = stmt.where(Product.is_published.is_(f.published))
        if category_ids is not None:
            stmt = stmt.where(Product.category_id.in_(category_ids))
        if f.q:
            pattern = f"%{f.q.strip()}%"
            stmt = stmt.where(or_(Product.name.ilike(pattern), Product.sku.ilike(pattern),
                                  Product.short_desc.ilike(pattern)))
        if f.min_price is not None:
            stmt = stmt.where(EFFECTIVE_PRICE >= f.min_price)
        if f.max_price is not None:
            stmt = stmt.where(EFFECTIVE_PRICE <= f.max_price)
        if f.availability:
            stmt = stmt.where(Product.stock_status.in_(f.availability))
        if f.featured is not None:
            stmt = stmt.where(Product.is_featured.is_(f.featured))
        if f.best_seller is not None:
            stmt = stmt.where(Product.is_best_seller.is_(f.best_seller))
        if f.on_sale:
            stmt = stmt.where(Product.sale_price.is_not(None))
        stmt = self._m2m_filter(stmt, f.colors, product_colors, product_colors.c.color_id, Color)
        stmt = self._m2m_filter(stmt, f.materials, product_materials, product_materials.c.material_id, Material)
        stmt = self._m2m_filter(stmt, f.rooms, product_rooms, product_rooms.c.room_id, Room)
        return stmt.order_by(*_SORTS[f.sort])

    @staticmethod
    def _m2m_filter(stmt: Select, slugs: list[str], table, fk_col, model) -> Select:  # noqa: ANN001
        if not slugs:
            return stmt
        sub = (
            select(table.c.product_id)
            .join(model, model.id == fk_col)
            .where(model.slug.in_(slugs))
        )
        return stmt.where(Product.id.in_(sub))

    def page_cards(self, stmt: Select[tuple[Product]], offset: int, limit: int) -> tuple[list[Product], int]:
        return self.paginate(stmt.options(*CARD_LOADERS), offset, limit)

    def facet_counts(self, base: Select[tuple[Product]], table, fk_col, model) -> list[tuple]:  # noqa: ANN001
        ids = base.order_by(None).with_only_columns(Product.id).subquery()
        stmt = (
            select(model, func.count(table.c.product_id))
            .join(table, fk_col == model.id)
            .where(table.c.product_id.in_(select(ids.c.id)))
            .group_by(model.id)
            .order_by(model.name)
        )
        return list(self.db.execute(stmt))

    def stock_counts(self, base: Select[tuple[Product]]) -> list[tuple]:
        ids = base.order_by(None).with_only_columns(Product.id).subquery()
        stmt = (select(Product.stock_status, func.count(Product.id))
                .where(Product.id.in_(select(ids.c.id))).group_by(Product.stock_status))
        return list(self.db.execute(stmt))

    def price_bounds(self, base: Select[tuple[Product]]) -> tuple[float, float]:
        ids = base.order_by(None).with_only_columns(Product.id).subquery()
        row = self.db.execute(
            select(func.min(EFFECTIVE_PRICE), func.max(EFFECTIVE_PRICE)).where(Product.id.in_(select(ids.c.id)))
        ).one()
        return float(row[0] or 0), float(row[1] or 0)

    def related(self, product: Product, limit: int = 8) -> list[Product]:
        stmt = (
            select(Product)
            .where(Product.is_published.is_(True), Product.id != product.id)
            .options(*CARD_LOADERS)
            .order_by(Product.view_count.desc(), Product.id.desc())
            .limit(limit)
        )
        if product.category_id:
            stmt = stmt.where(Product.category_id == product.category_id)
        return list(self.db.scalars(stmt))

    def by_ids_ordered(self, ids: list[int]) -> list[Product]:
        if not ids:
            return []
        found = {p.id: p for p in self.db.scalars(
            select(Product).where(Product.id.in_(ids), Product.is_published.is_(True)).options(*CARD_LOADERS))}
        return [found[i] for i in ids if i in found]

    def increment_views(self, product_id: int) -> None:
        self.db.execute(
            Product.__table__.update().where(Product.id == product_id).values(view_count=Product.view_count + 1)
        )
