from datetime import datetime
from decimal import Decimal
from typing import Any

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.enums import AdminRole, InquirySource, InquiryStatus, ScrapeStatus
from app.db.base import Base, IdMixin, TimestampMixin
from app.models.catalog import _enum


class AdminUser(IdMixin, TimestampMixin, Base):
    __tablename__ = "users"

    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    full_name: Mapped[str] = mapped_column(String(200), default="")
    password_hash: Mapped[str] = mapped_column(String(255))
    role: Mapped[AdminRole] = mapped_column(_enum(AdminRole), default=AdminRole.ADMIN)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    last_login_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)


class RefreshToken(IdMixin, TimestampMixin, Base):
    __tablename__ = "refresh_tokens"

    jti: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked: Mapped[bool] = mapped_column(Boolean, default=False)


class Inquiry(IdMixin, TimestampMixin, Base):
    __tablename__ = "inquiries"

    items: Mapped[list[dict[str, Any]]] = mapped_column(JSON, default=list)
    total: Mapped[Decimal] = mapped_column(Numeric(14, 2), default=Decimal("0"))
    currency: Mapped[str] = mapped_column(String(10), default="BDT")
    customer_name: Mapped[str | None] = mapped_column(String(200), default=None)
    phone: Mapped[str | None] = mapped_column(String(50), default=None)
    address: Mapped[str | None] = mapped_column(String(500), default=None)
    note: Mapped[str | None] = mapped_column(String(1000), default=None)
    source: Mapped[InquirySource] = mapped_column(_enum(InquirySource), default=InquirySource.CART)
    status: Mapped[InquiryStatus] = mapped_column(_enum(InquiryStatus), default=InquiryStatus.NEW, index=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), default=None)
    user_agent: Mapped[str | None] = mapped_column(String(300), default=None)


class ContactMessage(IdMixin, TimestampMixin, Base):
    __tablename__ = "contact_messages"

    name: Mapped[str] = mapped_column(String(200))
    email: Mapped[str | None] = mapped_column(String(255), default=None)
    phone: Mapped[str | None] = mapped_column(String(50), default=None)
    subject: Mapped[str | None] = mapped_column(String(255), default=None)
    message: Mapped[str] = mapped_column(Text)
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
    ip_hash: Mapped[str | None] = mapped_column(String(64), default=None)


class Setting(IdMixin, TimestampMixin, Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    value: Mapped[Any] = mapped_column(JSON, nullable=True)


class ScrapeLog(IdMixin, TimestampMixin, Base):
    __tablename__ = "scrape_log"

    url: Mapped[str] = mapped_column(String(700), unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(30), default="product")
    status: Mapped[ScrapeStatus] = mapped_column(_enum(ScrapeStatus), default=ScrapeStatus.PENDING, index=True)
    attempts: Mapped[int] = mapped_column(Integer, default=0)
    error: Mapped[str | None] = mapped_column(Text, default=None)
    sku: Mapped[str | None] = mapped_column(String(100), default=None)
    category_slug: Mapped[str | None] = mapped_column(String(220), default=None, index=True)
    run_id: Mapped[str | None] = mapped_column(String(40), default=None)
    last_attempt_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), default=None)
