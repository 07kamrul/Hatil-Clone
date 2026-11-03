"""Hand-written ORM → schema mappers for catalog entities."""

from decimal import Decimal

from app.models import Category, Color, Material, Product, ProductImage, ProductVariant, Room
from app.schemas.catalog import (
    CategoryNode,
    CategoryRef,
    ColorOut,
    ImageOut,
    MaterialOut,
    ProductCard,
    ProductDetail,
    RoomOut,
    SpecOut,
    VariantOut,
)


def category_ref(category: Category | None) -> CategoryRef | None:
    if category is None:
        return None
    return CategoryRef(id=category.id, name=category.name, slug=category.slug)


def color_out(color: Color) -> ColorOut:
    return ColorOut(id=color.id, name=color.name, slug=color.slug, hex_code=color.hex_code)


def material_out(material: Material) -> MaterialOut:
    return MaterialOut(id=material.id, name=material.name, slug=material.slug)


def room_out(room: Room) -> RoomOut:
    return RoomOut(id=room.id, name=room.name, slug=room.slug, image=room.image, sort_order=room.sort_order)


def image_out(image: ProductImage) -> ImageOut:
    return ImageOut(id=image.id, url=image.path, thumb_url=image.thumb_path, alt=image.alt,
                    sort_order=image.sort_order, is_dimension=image.is_dimension)


def variant_out(variant: ProductVariant) -> VariantOut:
    return VariantOut(id=variant.id, color=color_out(variant.color) if variant.color else None, size=variant.size,
                      sku=variant.sku, price_delta=float(variant.price_delta or 0), stock_status=variant.stock_status)


def discount_percent(price: Decimal, sale_price: Decimal | None) -> int:
    if sale_price is None or not price or sale_price >= price:
        return 0
    return int(round((1 - sale_price / price) * 100))


def _gallery(product: Product) -> list[ProductImage]:
    return [img for img in product.images if not img.is_dimension] or list(product.images)


def product_card(product: Product) -> ProductCard:
    gallery = _gallery(product)
    first = gallery[0] if gallery else None
    second = gallery[1] if len(gallery) > 1 else None
    return ProductCard(
        id=product.id,
        slug=product.slug,
        sku=product.sku,
        name=product.name,
        price=float(product.price),
        sale_price=float(product.sale_price) if product.sale_price is not None else None,
        final_price=float(product.effective_price),
        discount_percent=discount_percent(product.price, product.sale_price),
        stock_status=product.stock_status,
        image=(first.thumb_path or first.path) if first else None,
        image_hover=(second.thumb_path or second.path) if second else None,
        category=category_ref(product.category),
        colors=[color_out(c) for c in product.colors],
        is_featured=product.is_featured,
        is_best_seller=product.is_best_seller,
        is_published=product.is_published,
        view_count=product.view_count,
        created_at=product.created_at,
    )


def product_detail(product: Product, breadcrumbs: list[Category]) -> ProductDetail:
    card = product_card(product)
    return ProductDetail(
        **card.model_dump(),
        short_desc=product.short_desc,
        description_html=product.description_html,
        dimensions=product.dimensions,
        warranty=product.warranty,
        seo_title=product.seo_title,
        seo_description=product.seo_description,
        seo_keywords=product.seo_keywords,
        images=[image_out(i) for i in product.images],
        variants=[variant_out(v) for v in product.variants],
        specs=[SpecOut(key=s.key, value=s.value) for s in product.specs],
        materials=[material_out(m) for m in product.materials],
        rooms=[room_out(r) for r in product.rooms],
        breadcrumbs=[category_ref(c) for c in breadcrumbs],
        updated_at=product.updated_at,
    )


def build_category_tree(categories: list[Category], counts: dict[int, int] | None = None) -> list[CategoryNode]:
    """Build a nested tree from a flat, pre-sorted category list. Counts roll up to ancestors."""
    counts = counts or {}
    nodes = {
        c.id: CategoryNode(id=c.id, name=c.name, slug=c.slug, image=c.image, sort_order=c.sort_order,
                           is_active=c.is_active, product_count=counts.get(c.id, 0))
        for c in categories
    }
    roots: list[CategoryNode] = []
    for c in categories:
        node = nodes[c.id]
        parent = nodes.get(c.parent_id) if c.parent_id else None
        (parent.children if parent else roots).append(node)

    def roll_up(node: CategoryNode) -> int:
        node.product_count += sum(roll_up(child) for child in node.children)
        return node.product_count

    for root in roots:
        roll_up(root)
    return roots
