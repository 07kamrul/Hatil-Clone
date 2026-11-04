from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import BannerPlacement
from app.db.base import Base, IdMixin, SeoMixin, TimestampMixin
from app.models.catalog import _enum


class Banner(IdMixin, TimestampMixin, Base):
    __tablename__ = "banners"

    title: Mapped[str] = mapped_column(String(200))
    subtitle: Mapped[str | None] = mapped_column(String(300), default=None)
    image: Mapped[str] = mapped_column(String(500))
    mobile_image: Mapped[str | None] = mapped_column(String(500), default=None)
    link_url: Mapped[str | None] = mapped_column(String(500), default=None)
    button_text: Mapped[str | None] = mapped_column(String(60), default=None)
    placement: Mapped[BannerPlacement] = mapped_column(
        _enum(BannerPlacement), default=BannerPlacement.HERO, index=True
    )
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    starts_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
    ends_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class Showroom(IdMixin, TimestampMixin, Base):
    __tablename__ = "showrooms"

    name: Mapped[str] = mapped_column(String(200))
    slug: Mapped[str] = mapped_column(String(220), unique=True, index=True)
    city: Mapped[str] = mapped_column(String(100), index=True)
    address: Mapped[str] = mapped_column(String(500))
    phone: Mapped[str | None] = mapped_column(String(50), default=None)
    email: Mapped[str | None] = mapped_column(String(200), default=None)
    opening_hours: Mapped[str | None] = mapped_column(String(200), default=None)
    off_days: Mapped[str | None] = mapped_column(String(100), default=None)
    latitude: Mapped[float | None] = mapped_column(Float, default=None)
    longitude: Mapped[float | None] = mapped_column(Float, default=None)
    image: Mapped[str | None] = mapped_column(String(500), default=None)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)


class BlogPost(IdMixin, TimestampMixin, SeoMixin, Base):
    __tablename__ = "blog_posts"

    title: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    excerpt: Mapped[str | None] = mapped_column(String(600), default=None)
    body_html: Mapped[str] = mapped_column(Text, default="")
    gallery: Mapped[list[str]] = mapped_column(JSON, default=list)
    cover_image: Mapped[str | None] = mapped_column(String(500), default=None)
    author: Mapped[str | None] = mapped_column(String(120), default=None)
    tags: Mapped[str | None] = mapped_column(String(300), default=None)
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None, index=True)


class Page(IdMixin, TimestampMixin, SeoMixin, Base):
    __tablename__ = "pages"

    title: Mapped[str] = mapped_column(String(255))
    slug: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    body_html: Mapped[str] = mapped_column(Text, default="")
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    show_in_footer: Mapped[bool] = mapped_column(Boolean, default=True)


class Faq(IdMixin, TimestampMixin, Base):
    __tablename__ = "faqs"

    question: Mapped[str] = mapped_column(String(500))
    answer_html: Mapped[str] = mapped_column(Text)
    group: Mapped[str] = mapped_column(String(100), default="General")
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    show_on_home: Mapped[bool] = mapped_column(Boolean, default=False)
