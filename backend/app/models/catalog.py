from decimal import Decimal

from sqlalchemy import Boolean, Column, Enum, ForeignKey, Index, Integer, Numeric, String, Table, Text
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.core.enums import StockStatus
from app.db.base import Base, IdMixin, SeoMixin, TimestampMixin

product_colors = Table(
    "product_colors",
    Base.metadata,
    Column("product_id", ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
    Column("color_id", ForeignKey("colors.id", ondelete="CASCADE"), primary_key=True),
)
product_materials = Table(
    "product_materials",
    Base.metadata,
    Column("product_id", ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
    Column("material_id", ForeignKey("materials.id", ondelete="CASCADE"), primary_key=True),
)
product_rooms = Table(
    "product_rooms",
    Base.metadata,
    Column("product_id", ForeignKey("products.id", ondelete="CASCADE"), primary_key=True),
    Column("room_id", ForeignKey("rooms.id", ondelete="CASCADE"), primary_key=True),
)


def _enum(enum_cls: type) -> Enum:
    return Enum(enum_cls, native_enum=False, length=32, values_callable=lambda e: [m.value for m in e])


class Category(IdMixin, TimestampMixin, SeoMixin, Base):
    __tablename__ = "categories"

    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    parent_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True, default=None
    )
    description_html: Mapped[str | None] = mapped_column(Text, default=None)
    image: Mapped[str | None] = mapped_column(String(500), default=None)
    banner_image: Mapped[str | None] = mapped_column(String(500), default=None)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    show_in_menu: Mapped[bool] = mapped_column(Boolean, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False)

    parent: Mapped["Category | None"] = relationship(remote_side="Category.id", back_populates="children")
    children: Mapped[list["Category"]] = relationship(back_populates="parent", order_by="Category.sort_order")


class Color(IdMixin, Base):
    __tablename__ = "colors"

    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    hex_code: Mapped[str | None] = mapped_column(String(9), default=None)


class Material(IdMixin, Base):
    __tablename__ = "materials"

    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)


class Room(IdMixin, Base):
    __tablename__ = "rooms"

    name: Mapped[str] = mapped_column(String(100))
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    image: Mapped[str | None] = mapped_column(String(500), default=None)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)


class Product(IdMixin, TimestampMixin, SeoMixin, Base):
    __tablename__ = "products"
    __table_args__ = (Index("ix_products_published_category", "is_published", "category_id"),)

    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    sku: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255), index=True)
    short_desc: Mapped[str | None] = mapped_column(Text, default=None)
    description_html: Mapped[str | None] = mapped_column(Text, default=None)
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2), index=True)
    sale_price: Mapped[Decimal | None] = mapped_column(Numeric(12, 2), default=None)
    stock_status: Mapped[StockStatus] = mapped_column(_enum(StockStatus), default=StockStatus.IN_STOCK, index=True)
    category_id: Mapped[int | None] = mapped_column(
        ForeignKey("categories.id", ondelete="SET NULL"), index=True, default=None
    )
    dimensions: Mapped[str | None] = mapped_column(String(255), default=None)
    warranty: Mapped[str | None] = mapped_column(String(255), default=None)
    is_featured: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    is_best_seller: Mapped[bool] = mapped_column(Boolean, default=False)
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    source_url: Mapped[str | None] = mapped_column(String(500), default=None)

    category: Mapped[Category | None] = relationship()
    images: Mapped[list["ProductImage"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductImage.sort_order"
    )
    variants: Mapped[list["ProductVariant"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductVariant.id"
    )
    specs: Mapped[list["ProductSpec"]] = relationship(
        back_populates="product", cascade="all, delete-orphan", order_by="ProductSpec.sort_order"
    )
    colors: Mapped[list[Color]] = relationship(secondary=product_colors)
    materials: Mapped[list[Material]] = relationship(secondary=product_materials)
    rooms: Mapped[list[Room]] = relationship(secondary=product_rooms)

    @property
    def effective_price(self) -> Decimal:
        return self.sale_price if self.sale_price is not None else self.price


class ProductImage(IdMixin, Base):
    __tablename__ = "product_images"

    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    path: Mapped[str] = mapped_column(String(500))
    thumb_path: Mapped[str | None] = mapped_column(String(500), default=None)
    alt: Mapped[str | None] = mapped_column(String(255), default=None)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_dimension: Mapped[bool] = mapped_column(Boolean, default=False)

    product: Mapped[Product] = relationship(back_populates="images")


class ProductVariant(IdMixin, Base):
    __tablename__ = "product_variants"

    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    color_id: Mapped[int | None] = mapped_column(ForeignKey("colors.id", ondelete="SET NULL"), default=None)
    size: Mapped[str | None] = mapped_column(String(100), default=None)
    sku: Mapped[str | None] = mapped_column(String(100), default=None)
    price_delta: Mapped[Decimal] = mapped_column(Numeric(12, 2), default=Decimal("0"))
    stock_status: Mapped[StockStatus] = mapped_column(_enum(StockStatus), default=StockStatus.IN_STOCK)

    product: Mapped[Product] = relationship(back_populates="variants")
    color: Mapped[Color | None] = relationship()


class ProductSpec(IdMixin, Base):
    __tablename__ = "product_specs"

    product_id: Mapped[int] = mapped_column(ForeignKey("products.id", ondelete="CASCADE"), index=True)
    key: Mapped[str] = mapped_column(String(150))
    value: Mapped[str] = mapped_column(String(1000))
    sort_order: Mapped[int] = mapped_column(Integer, default=0)

    product: Mapped[Product] = relationship(back_populates="specs")
