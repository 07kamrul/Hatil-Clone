"""Anonymous order inquiries and contact messages."""

from datetime import UTC, datetime, timedelta
from decimal import Decimal

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import InquiryStatus
from app.core.errors import NotFoundError
from app.core.security import hash_ip
from app.core.text import strip_tags
from app.models import ContactMessage, Inquiry, Product
from app.repositories.base import Repository
from app.schemas.common import PageParams
from app.schemas.system import ContactCreate, InquiryCreate
from app.services.settings_service import SettingsService

_INQUIRY_DUPLICATE_WINDOW = timedelta(seconds=30)


class InquiryService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = Repository(db, Inquiry)

    def create(self, data: InquiryCreate, ip: str | None, user_agent: str | None) -> Inquiry | None:
        settings = SettingsService(self.db)
        if not settings.get("log_inquiries"):
            return None
        items = self._trusted_items(data)
        total = sum((Decimal(str(i["unit_price"])) * i["quantity"] for i in items), Decimal("0"))
        ip_hash = hash_ip(ip)
        recent = self.db.scalar(
            select(Inquiry).where(Inquiry.ip_hash == ip_hash,
                                  Inquiry.created_at >= datetime.now(UTC) - _INQUIRY_DUPLICATE_WINDOW).limit(1)
        )
        if recent is not None and recent.items == items:
            return recent  # double-click / retry: don't log twice
        inquiry = self.repo.add(Inquiry(
            items=items, total=total, currency=str(settings.get("currency")),
            customer_name=_clean(data.customer_name), phone=_clean(data.phone), address=_clean(data.address),
            note=_clean(data.note), source=data.source, ip_hash=ip_hash, user_agent=(user_agent or "")[:300],
        ))
        self.db.commit()
        return inquiry

    def _trusted_items(self, data: InquiryCreate) -> list[dict]:
        """Prefer server-side product names/prices over client-supplied values when the product is known."""
        ids = [i.product_id for i in data.items if i.product_id]
        known = {p.id: p for p in self.db.scalars(select(Product).where(Product.id.in_(ids)))} if ids else {}
        items = []
        for item in data.items:
            product = known.get(item.product_id) if item.product_id else None
            unit_price = item.unit_price
            if product is not None:
                # Variants can only add to the base price, so never log less than the catalogue price.
                unit_price = max(product.effective_price, item.unit_price)
            items.append({
                "product_id": product.id if product else None,
                "slug": product.slug if product else item.slug,
                "sku": product.sku if product else item.sku,
                "name": product.name if product else strip_tags(item.name),
                "variant": strip_tags(item.variant) if item.variant else None,
                "quantity": item.quantity,
                "unit_price": float(unit_price),
            })
        return items

    def list(self, params: PageParams, status: InquiryStatus | None, q: str | None) -> tuple[list[Inquiry], int]:
        stmt = self.repo.search_query(q, ("customer_name", "phone", "address"), status=status)
        return self.repo.paginate(stmt.order_by(Inquiry.created_at.desc()), params.offset, params.page_size)

    def get(self, inquiry_id: int) -> Inquiry:
        inquiry = self.repo.get(inquiry_id)
        if inquiry is None:
            raise NotFoundError("Inquiry not found")
        return inquiry

    def set_status(self, inquiry_id: int, status: InquiryStatus) -> Inquiry:
        inquiry = self.get(inquiry_id)
        inquiry.status = status
        self.db.commit()
        return inquiry

    def delete(self, inquiry_id: int) -> None:
        self.repo.delete(self.get(inquiry_id))
        self.db.commit()

    def count_since(self, days: int) -> int:
        since = datetime.now(UTC) - timedelta(days=days)
        return self.db.scalar(select(func.count(Inquiry.id)).where(Inquiry.created_at >= since)) or 0


class ContactService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.repo = Repository(db, ContactMessage)

    def create(self, data: ContactCreate, ip: str | None) -> ContactMessage:
        message = self.repo.add(ContactMessage(
            name=strip_tags(data.name), email=data.email, phone=_clean(data.phone),
            subject=_clean(data.subject), message=strip_tags(data.message), ip_hash=hash_ip(ip),
        ))
        self.db.commit()
        return message

    def list(self, params: PageParams, is_read: bool | None, q: str | None) -> tuple[list[ContactMessage], int]:
        stmt = self.repo.search_query(q, ("name", "email", "subject", "message"), is_read=is_read)
        return self.repo.paginate(stmt.order_by(ContactMessage.created_at.desc()), params.offset, params.page_size)

    def get(self, message_id: int) -> ContactMessage:
        message = self.repo.get(message_id)
        if message is None:
            raise NotFoundError("Message not found")
        return message

    def mark(self, message_id: int, is_read: bool) -> ContactMessage:
        message = self.get(message_id)
        message.is_read = is_read
        self.db.commit()
        return message

    def delete(self, message_id: int) -> None:
        self.repo.delete(self.get(message_id))
        self.db.commit()


def _clean(value: str | None) -> str | None:
    if value is None:
        return None
    text = strip_tags(value)
    return text or None
