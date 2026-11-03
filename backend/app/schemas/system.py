from datetime import datetime
from decimal import Decimal
from typing import Any

from pydantic import BaseModel, EmailStr, Field

from app.core.enums import InquirySource, InquiryStatus, StockStatus
from app.schemas.common import ORMModel


# ---------- Inquiries (anonymous WhatsApp order logs) ----------
class InquiryItem(BaseModel):
    product_id: int | None = None
    slug: str | None = Field(None, max_length=255)
    sku: str | None = Field(None, max_length=100)
    name: str = Field(min_length=1, max_length=255)
    variant: str | None = Field(None, max_length=200)
    quantity: int = Field(ge=1, le=999)
    unit_price: Decimal = Field(ge=0)


class InquiryCreate(BaseModel):
    items: list[InquiryItem] = Field(min_length=1, max_length=100)
    customer_name: str | None = Field(None, max_length=200)
    phone: str | None = Field(None, max_length=50)
    address: str | None = Field(None, max_length=500)
    note: str | None = Field(None, max_length=1000)
    source: InquirySource = InquirySource.CART


class InquiryOut(ORMModel):
    id: int
    items: list[dict[str, Any]]
    total: float
    currency: str
    customer_name: str | None
    phone: str | None
    address: str | None
    note: str | None
    source: InquirySource
    status: InquiryStatus
    created_at: datetime


class InquiryStatusUpdate(BaseModel):
    status: InquiryStatus


# ---------- Contact ----------
class ContactCreate(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    email: EmailStr | None = None
    phone: str | None = Field(None, max_length=50, pattern=r"^[0-9+\-() ]{6,50}$")
    subject: str | None = Field(None, max_length=255)
    message: str = Field(min_length=5, max_length=5000)
    website: str | None = Field(None, max_length=200, description="Honeypot — must stay empty")


class ContactOut(ORMModel):
    id: int
    name: str
    email: str | None
    phone: str | None
    subject: str | None
    message: str
    is_read: bool
    created_at: datetime


class ContactUpdate(BaseModel):
    is_read: bool


# ---------- Settings ----------
class SettingsUpdate(BaseModel):
    values: dict[str, Any]


# ---------- Dashboard ----------
class TopProduct(BaseModel):
    id: int
    name: str
    slug: str
    sku: str
    view_count: int
    stock_status: StockStatus


class DashboardStats(BaseModel):
    products_total: int
    products_published: int
    categories_total: int
    inquiries_total: int
    inquiries_new: int
    inquiries_last_30_days: int
    contact_unread: int
    showrooms_total: int
    blog_posts_total: int
    top_viewed: list[TopProduct]
    recent_contacts: list[ContactOut]
    recent_inquiries: list[InquiryOut]


class UploadOut(BaseModel):
    url: str
    thumb_url: str | None = None


class SearchSuggestion(BaseModel):
    type: str
    name: str
    slug: str
    image: str | None = None
    price: float | None = None
