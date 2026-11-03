from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.enums import InquiryStatus
from app.models import BlogPost, Category, ContactMessage, Inquiry, Product, Showroom
from app.schemas.system import ContactOut, DashboardStats, InquiryOut, TopProduct
from app.services.inbox_service import InquiryService

TOP_VIEWED_LIMIT = 10
RECENT_LIMIT = 5


class DashboardService:
    def __init__(self, db: Session) -> None:
        self.db = db

    def _count(self, model: type, *where: object) -> int:
        return self.db.scalar(select(func.count(model.id)).where(*where)) or 0

    def stats(self) -> DashboardStats:
        top = self.db.scalars(select(Product).order_by(Product.view_count.desc()).limit(TOP_VIEWED_LIMIT))
        contacts = self.db.scalars(select(ContactMessage).order_by(ContactMessage.created_at.desc()).limit(RECENT_LIMIT))
        inquiries = self.db.scalars(select(Inquiry).order_by(Inquiry.created_at.desc()).limit(RECENT_LIMIT))
        return DashboardStats(
            products_total=self._count(Product),
            products_published=self._count(Product, Product.is_published.is_(True)),
            categories_total=self._count(Category),
            inquiries_total=self._count(Inquiry),
            inquiries_new=self._count(Inquiry, Inquiry.status == InquiryStatus.NEW),
            inquiries_last_30_days=InquiryService(self.db).count_since(30),
            contact_unread=self._count(ContactMessage, ContactMessage.is_read.is_(False)),
            showrooms_total=self._count(Showroom),
            blog_posts_total=self._count(BlogPost),
            top_viewed=[TopProduct(id=p.id, name=p.name, slug=p.slug, sku=p.sku, view_count=p.view_count,
                                   stock_status=p.stock_status) for p in top],
            recent_contacts=[ContactOut.model_validate(c) for c in contacts],
            recent_inquiries=[InquiryOut.model_validate(i) for i in inquiries],
        )
