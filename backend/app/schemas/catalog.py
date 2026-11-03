from datetime import datetime
from decimal import Decimal

from pydantic import BaseModel, Field, field_validator, model_validator

from app.core.enums import ProductSort, StockStatus
from app.schemas.common import ORMModel

SLUG_PATTERN = r"^[a-z0-9]+(?:-[a-z0-9]+)*$"
HEX_PATTERN = r"^#[0-9a-fA-F]{6}$"


# ---------- Taxonomy ----------
class ColorIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=120)
    hex_code: str | None = Field(None, pattern=HEX_PATTERN)


class ColorUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=120)
    hex_code: str | None = Field(None, pattern=HEX_PATTERN)


class ColorOut(ORMModel):
    id: int
    name: str
    slug: str
    hex_code: str | None


class MaterialIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=120)


class MaterialUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=120)


class MaterialOut(ORMModel):
    id: int
    name: str
    slug: str


class RoomIn(BaseModel):
    name: str = Field(min_length=1, max_length=100)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=120)
    image: str | None = Field(None, max_length=500)
    sort_order: int = 0


class RoomUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=100)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=120)
    image: str | None = Field(None, max_length=500)
    sort_order: int | None = None


class RoomOut(ORMModel):
    id: int
    name: str
    slug: str
    image: str | None
    sort_order: int


class _CategoryFields(BaseModel):
    description_html: str | None = None
    image: str | None = Field(None, max_length=500)
    banner_image: str | None = Field(None, max_length=500)
    seo_title: str | None = Field(None, max_length=255)
    seo_description: str | None = Field(None, max_length=500)
    seo_keywords: str | None = Field(None, max_length=500)


class CategoryIn(_CategoryFields):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=220)
    parent_id: int | None = None
    sort_order: int = 0
    is_active: bool = True
    show_in_menu: bool = True
    is_featured: bool = False


class CategoryUpdate(_CategoryFields):
    name: str | None = Field(None, min_length=1, max_length=200)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=220)
    parent_id: int | None = None
    sort_order: int | None = None
    is_active: bool | None = None
    show_in_menu: bool | None = None
    is_featured: bool | None = None


class CategoryRef(BaseModel):
    id: int
    name: str
    slug: str


class CategoryOut(ORMModel):
    id: int
    name: str
    slug: str
    parent_id: int | None
    description_html: str | None
    image: str | None
    banner_image: str | None
    sort_order: int
    is_active: bool
    show_in_menu: bool
    is_featured: bool
    seo_title: str | None
    seo_description: str | None
    seo_keywords: str | None


class CategoryNode(BaseModel):
    id: int
    name: str
    slug: str
    image: str | None
    sort_order: int
    is_active: bool = True
    product_count: int = 0
    children: list["CategoryNode"] = []


class CategoryDetail(CategoryOut):
    breadcrumbs: list[CategoryRef]
    children: list[CategoryRef]


# ---------- Products ----------
class VariantIn(BaseModel):
    id: int | None = None
    color_id: int | None = None
    size: str | None = Field(None, max_length=100)
    sku: str | None = Field(None, max_length=100)
    price_delta: Decimal = Decimal("0")
    stock_status: StockStatus = StockStatus.IN_STOCK


class SpecIn(BaseModel):
    key: str = Field(min_length=1, max_length=150)
    value: str = Field(min_length=1, max_length=1000)


class _ProductFields(BaseModel):
    short_desc: str | None = Field(None, max_length=2000)
    description_html: str | None = None
    dimensions: str | None = Field(None, max_length=255)
    warranty: str | None = Field(None, max_length=255)
    seo_title: str | None = Field(None, max_length=255)
    seo_description: str | None = Field(None, max_length=500)
    seo_keywords: str | None = Field(None, max_length=500)


class ProductIn(_ProductFields):
    name: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=255)
    sku: str = Field(min_length=1, max_length=100)
    price: Decimal = Field(ge=0, max_digits=12, decimal_places=2)
    sale_price: Decimal | None = Field(None, ge=0, max_digits=12, decimal_places=2)
    stock_status: StockStatus = StockStatus.IN_STOCK
    category_id: int | None = None
    is_featured: bool = False
    is_best_seller: bool = False
    is_published: bool = True
    color_ids: list[int] = []
    material_ids: list[int] = []
    room_ids: list[int] = []
    variants: list[VariantIn] = []
    specs: list[SpecIn] = []

    @model_validator(mode="after")
    def _check_sale(self) -> "ProductIn":
        if self.sale_price is not None and self.sale_price >= self.price:
            raise ValueError("sale_price must be lower than price")
        return self


class ProductUpdate(_ProductFields):
    name: str | None = Field(None, min_length=1, max_length=255)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=255)
    sku: str | None = Field(None, min_length=1, max_length=100)
    price: Decimal | None = Field(None, ge=0, max_digits=12, decimal_places=2)
    sale_price: Decimal | None = Field(None, ge=0, max_digits=12, decimal_places=2)
    stock_status: StockStatus | None = None
    category_id: int | None = None
    is_featured: bool | None = None
    is_best_seller: bool | None = None
    is_published: bool | None = None
    color_ids: list[int] | None = None
    material_ids: list[int] | None = None
    room_ids: list[int] | None = None
    variants: list[VariantIn] | None = None
    specs: list[SpecIn] | None = None


class ImageOut(BaseModel):
    id: int
    url: str
    thumb_url: str | None
    alt: str | None
    sort_order: int
    is_dimension: bool


class VariantOut(BaseModel):
    id: int
    color: ColorOut | None
    size: str | None
    sku: str | None
    price_delta: float
    stock_status: StockStatus


class SpecOut(BaseModel):
    key: str
    value: str


class ProductCard(BaseModel):
    id: int
    slug: str
    sku: str
    name: str
    price: float
    sale_price: float | None
    final_price: float
    discount_percent: int
    stock_status: StockStatus
    image: str | None
    image_hover: str | None
    category: CategoryRef | None
    colors: list[ColorOut]
    is_featured: bool
    is_best_seller: bool
    is_published: bool
    view_count: int
    created_at: datetime


class ProductDetail(ProductCard):
    short_desc: str | None
    description_html: str | None
    dimensions: str | None
    warranty: str | None
    seo_title: str | None
    seo_description: str | None
    seo_keywords: str | None
    images: list[ImageOut]
    variants: list[VariantOut]
    specs: list[SpecOut]
    materials: list[MaterialOut]
    rooms: list[RoomOut]
    breadcrumbs: list[CategoryRef]
    updated_at: datetime


class ProductFilters(BaseModel):
    q: str | None = Field(None, max_length=100)
    category: str | None = Field(None, max_length=220)
    min_price: Decimal | None = Field(None, ge=0)
    max_price: Decimal | None = Field(None, ge=0)
    colors: list[str] = []
    materials: list[str] = []
    rooms: list[str] = []
    availability: list[StockStatus] = []
    featured: bool | None = None
    best_seller: bool | None = None
    on_sale: bool | None = None
    published: bool | None = True
    sort: ProductSort = ProductSort.NEWEST

    @field_validator("colors", "materials", "rooms", mode="before")
    @classmethod
    def _split(cls, value: object) -> object:
        if isinstance(value, str):
            return [v for v in value.split(",") if v]
        if isinstance(value, list):
            return [p for v in value for p in str(v).split(",") if p]
        return value


class FacetOption(BaseModel):
    slug: str
    name: str
    count: int
    hex_code: str | None = None


class ProductFacets(BaseModel):
    colors: list[FacetOption]
    materials: list[FacetOption]
    rooms: list[FacetOption]
    availability: list[FacetOption]
    min_price: float
    max_price: float


class ImageReorder(BaseModel):
    image_ids: list[int] = Field(min_length=1)


class ImageUpdate(BaseModel):
    alt: str | None = Field(None, max_length=255)
    is_dimension: bool | None = None


class BulkPublish(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=1000)
    is_published: bool


class BulkPrice(BaseModel):
    ids: list[int] = Field(min_length=1, max_length=5000)
    mode: str = Field(pattern="^(percent|fixed|set)$")
    value: Decimal
    target: str = Field("price", pattern="^(price|sale_price)$")
    round_to: int = Field(0, ge=0, le=1000)


class ImportResult(BaseModel):
    created: int
    updated: int
    failed: int
    errors: list[str]


CategoryNode.model_rebuild()
