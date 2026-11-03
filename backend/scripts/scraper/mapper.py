"""ScrapedProduct → ProductImportData (the app's import contract)."""

from decimal import Decimal

from app.core.enums import StockStatus
from app.services.product_import_service import ProductImportData
from scraper.parsers import ScrapedProduct


def to_import(product: ScrapedProduct, max_images: int) -> ProductImportData:
    base = product.sale_price or product.price
    variants = []
    for v in product.variants:
        if v.color is None and v.size is None:
            continue
        delta = (v.price - base) if v.price is not None else Decimal("0")
        variants.append((v.color, v.size, max(delta, Decimal("0"))))
    return ProductImportData(
        sku=product.sku[:100],
        name=product.name[:255],
        slug=product.slug,
        price=product.price,
        sale_price=product.sale_price,
        stock_status=StockStatus.IN_STOCK if product.in_stock else StockStatus.OUT_OF_STOCK,
        category_path=product.category_path,
        short_desc=product.short_desc,
        description_html=product.description_html,
        dimensions=(product.dimensions or "")[:255] or None,
        warranty=product.warranty,
        colors=product.colors,
        materials=product.materials,
        specs=product.specs,
        variants=variants if len(variants) > 1 else [],
        images=product.images[:max_images],
        dimension_images=product.dimension_images[:2],
        seo_title=(product.meta_title or "")[:255] or None,
        seo_description=(product.meta_description or "")[:500] or None,
        seo_keywords=(product.meta_keywords or "")[:500] or None,
        source_url=product.source_url,
    )
