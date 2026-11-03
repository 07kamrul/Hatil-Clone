from datetime import datetime

from pydantic import BaseModel, Field

from app.core.enums import BannerPlacement
from app.schemas.catalog import SLUG_PATTERN
from app.schemas.common import ORMModel


class _Seo(BaseModel):
    seo_title: str | None = Field(None, max_length=255)
    seo_description: str | None = Field(None, max_length=500)
    seo_keywords: str | None = Field(None, max_length=500)


# ---------- Banners ----------
class BannerIn(BaseModel):
    title: str = Field(min_length=1, max_length=200)
    subtitle: str | None = Field(None, max_length=300)
    image: str = Field(min_length=1, max_length=500)
    mobile_image: str | None = Field(None, max_length=500)
    link_url: str | None = Field(None, max_length=500)
    button_text: str | None = Field(None, max_length=60)
    placement: BannerPlacement = BannerPlacement.HERO
    sort_order: int = 0
    is_active: bool = True
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class BannerUpdate(BaseModel):
    title: str | None = Field(None, min_length=1, max_length=200)
    subtitle: str | None = Field(None, max_length=300)
    image: str | None = Field(None, min_length=1, max_length=500)
    mobile_image: str | None = Field(None, max_length=500)
    link_url: str | None = Field(None, max_length=500)
    button_text: str | None = Field(None, max_length=60)
    placement: BannerPlacement | None = None
    sort_order: int | None = None
    is_active: bool | None = None
    starts_at: datetime | None = None
    ends_at: datetime | None = None


class BannerOut(ORMModel):
    id: int
    title: str
    subtitle: str | None
    image: str
    mobile_image: str | None
    link_url: str | None
    button_text: str | None
    placement: BannerPlacement
    sort_order: int
    is_active: bool
    starts_at: datetime | None
    ends_at: datetime | None


# ---------- Showrooms ----------
class ShowroomIn(BaseModel):
    name: str = Field(min_length=1, max_length=200)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=220)
    city: str = Field(min_length=1, max_length=100)
    address: str = Field(min_length=1, max_length=500)
    phone: str | None = Field(None, max_length=50)
    email: str | None = Field(None, max_length=200)
    opening_hours: str | None = Field(None, max_length=200)
    off_days: str | None = Field(None, max_length=100)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    image: str | None = Field(None, max_length=500)
    sort_order: int = 0
    is_active: bool = True


class ShowroomUpdate(BaseModel):
    name: str | None = Field(None, min_length=1, max_length=200)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=220)
    city: str | None = Field(None, min_length=1, max_length=100)
    address: str | None = Field(None, min_length=1, max_length=500)
    phone: str | None = Field(None, max_length=50)
    email: str | None = Field(None, max_length=200)
    opening_hours: str | None = Field(None, max_length=200)
    off_days: str | None = Field(None, max_length=100)
    latitude: float | None = Field(None, ge=-90, le=90)
    longitude: float | None = Field(None, ge=-180, le=180)
    image: str | None = Field(None, max_length=500)
    sort_order: int | None = None
    is_active: bool | None = None


class ShowroomOut(ORMModel):
    id: int
    name: str
    slug: str
    city: str
    address: str
    phone: str | None
    email: str | None
    opening_hours: str | None
    off_days: str | None
    latitude: float | None
    longitude: float | None
    image: str | None
    sort_order: int
    is_active: bool


# ---------- Blog ----------
class BlogPostIn(_Seo):
    title: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=255)
    excerpt: str | None = Field(None, max_length=600)
    body_html: str = ""
    cover_image: str | None = Field(None, max_length=500)
    author: str | None = Field(None, max_length=120)
    tags: str | None = Field(None, max_length=300)
    is_published: bool = False
    published_at: datetime | None = None


class BlogPostUpdate(_Seo):
    title: str | None = Field(None, min_length=1, max_length=255)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=255)
    excerpt: str | None = Field(None, max_length=600)
    body_html: str | None = None
    cover_image: str | None = Field(None, max_length=500)
    author: str | None = Field(None, max_length=120)
    tags: str | None = Field(None, max_length=300)
    is_published: bool | None = None
    published_at: datetime | None = None


class BlogPostSummary(ORMModel):
    id: int
    title: str
    slug: str
    excerpt: str | None
    cover_image: str | None
    author: str | None
    tags: str | None
    is_published: bool
    published_at: datetime | None
    created_at: datetime


class BlogPostOut(BlogPostSummary):
    body_html: str
    seo_title: str | None
    seo_description: str | None
    seo_keywords: str | None


# ---------- Pages ----------
class PageIn(_Seo):
    title: str = Field(min_length=1, max_length=255)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=255)
    body_html: str = ""
    is_published: bool = True
    show_in_footer: bool = True


class PageUpdate(_Seo):
    title: str | None = Field(None, min_length=1, max_length=255)
    slug: str | None = Field(None, pattern=SLUG_PATTERN, max_length=255)
    body_html: str | None = None
    is_published: bool | None = None
    show_in_footer: bool | None = None


class PageOut(ORMModel):
    id: int
    title: str
    slug: str
    body_html: str
    is_published: bool
    show_in_footer: bool
    seo_title: str | None
    seo_description: str | None
    seo_keywords: str | None
    updated_at: datetime


# ---------- FAQs ----------
class FaqIn(BaseModel):
    question: str = Field(min_length=1, max_length=500)
    answer_html: str = Field(min_length=1)
    group: str = Field("General", max_length=100)
    sort_order: int = 0
    is_active: bool = True
    show_on_home: bool = False


class FaqUpdate(BaseModel):
    question: str | None = Field(None, min_length=1, max_length=500)
    answer_html: str | None = Field(None, min_length=1)
    group: str | None = Field(None, max_length=100)
    sort_order: int | None = None
    is_active: bool | None = None
    show_on_home: bool | None = None


class FaqOut(ORMModel):
    id: int
    question: str
    answer_html: str
    group: str
    sort_order: int
    is_active: bool
    show_on_home: bool
