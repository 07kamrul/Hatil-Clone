from decimal import Decimal

from fastapi import Query

from app.core.enums import ProductSort, StockStatus
from app.schemas.catalog import ProductFilters


def product_filters(
    q: str | None = Query(None, max_length=100),
    category: str | None = Query(None, max_length=220),
    min_price: Decimal | None = Query(None, ge=0),
    max_price: Decimal | None = Query(None, ge=0),
    colors: list[str] = Query(default=[]),
    materials: list[str] = Query(default=[]),
    rooms: list[str] = Query(default=[]),
    availability: list[StockStatus] = Query(default=[]),
    featured: bool | None = None,
    best_seller: bool | None = None,
    on_sale: bool | None = None,
    sort: ProductSort = ProductSort.NEWEST,
) -> ProductFilters:
    return ProductFilters(q=q, category=category, min_price=min_price, max_price=max_price, colors=colors,
                          materials=materials, rooms=rooms, availability=availability, featured=featured,
                          best_seller=best_seller, on_sale=on_sale, sort=sort, published=True)
