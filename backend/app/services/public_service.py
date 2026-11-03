"""Read-only queries for the public site (banners, showrooms, blog, pages, FAQs, search, taxonomy)."""

from datetime import UTC, datetime

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.core.errors import NotFoundError
from app.mappers.catalog import color_out, material_out, product_card, room_out
from app.models import Banner, BlogPost, Category, Color, Faq, Material, Page, Product, Room, Showroom
from app.repositories.product_repository import CARD_LOADERS
from app.schemas.catalog import ColorOut, MaterialOut, RoomOut
from app.schemas.common import PageParams
from app.schemas.system import SearchSuggestion

SUGGESTION_LIMIT = 6


class PublicService:
    def __init__(self, db: Session) -> None:
        self.db = db

    # ---------- banners / taxonomy ----------
    def banners(self, placement: str | None) -> list[Banner]:
        now = datetime.now(UTC)
        stmt = select(Banner).where(Banner.is_active.is_(True)).order_by(Banner.sort_order, Banner.id)
        if placement:
            stmt = stmt.where(Banner.placement == placement)
        return [b for b in self.db.scalars(stmt)
                if (b.starts_at is None or _aware(b.starts_at) <= now) and (b.ends_at is None or _aware(b.ends_at) >= now)]

    def rooms(self) -> list[RoomOut]:
        return [room_out(r) for r in self.db.scalars(select(Room).order_by(Room.sort_order, Room.name))]

    def colors(self) -> list[ColorOut]:
        return [color_out(c) for c in self.db.scalars(select(Color).order_by(Color.name))]

    def materials(self) -> list[MaterialOut]:
        return [material_out(m) for m in self.db.scalars(select(Material).order_by(Material.name))]

    def featured_categories(self, limit: int) -> list[Category]:
        stmt = (select(Category).where(Category.is_active.is_(True), Category.is_featured.is_(True))
                .order_by(Category.sort_order, Category.name).limit(limit))
        return list(self.db.scalars(stmt))

    # ---------- showrooms ----------
    def showrooms(self, city: str | None) -> list[Showroom]:
        stmt = select(Showroom).where(Showroom.is_active.is_(True)).order_by(Showroom.sort_order, Showroom.name)
        if city:
            stmt = stmt.where(Showroom.city.ilike(city))
        return list(self.db.scalars(stmt))

    def showroom_cities(self) -> list[str]:
        return sorted(set(self.db.scalars(select(Showroom.city).where(Showroom.is_active.is_(True)))))

    def showroom(self, slug: str) -> Showroom:
        item = self.db.scalar(select(Showroom).where(Showroom.slug == slug, Showroom.is_active.is_(True)))
        if item is None:
            raise NotFoundError("Showroom not found")
        return item

    # ---------- blog / pages / faqs ----------
    def blog_posts(self, params: PageParams, q: str | None) -> tuple[list[BlogPost], int]:
        stmt = select(BlogPost).where(BlogPost.is_published.is_(True), _published_now())
        if q:
            stmt = stmt.where(or_(BlogPost.title.ilike(f"%{q}%"), BlogPost.excerpt.ilike(f"%{q}%")))
        stmt = stmt.order_by(BlogPost.published_at.desc(), BlogPost.id.desc())
        total_stmt = stmt.order_by(None)
        total = len(list(self.db.scalars(total_stmt.with_only_columns(BlogPost.id))))
        return list(self.db.scalars(stmt.offset(params.offset).limit(params.page_size))), total

    def blog_post(self, slug: str) -> BlogPost:
        post = self.db.scalar(select(BlogPost).where(BlogPost.slug == slug, BlogPost.is_published.is_(True),
                                                     _published_now()))
        if post is None:
            raise NotFoundError("Post not found")
        return post

    def related_posts(self, post: BlogPost, limit: int = 3) -> list[BlogPost]:
        stmt = (select(BlogPost).where(BlogPost.is_published.is_(True), _published_now(), BlogPost.id != post.id)
                .order_by(BlogPost.published_at.desc()).limit(limit))
        return list(self.db.scalars(stmt))

    def page(self, slug: str) -> Page:
        page = self.db.scalar(select(Page).where(Page.slug == slug, Page.is_published.is_(True)))
        if page is None:
            raise NotFoundError("Page not found")
        return page

    def footer_pages(self) -> list[Page]:
        return list(self.db.scalars(select(Page).where(Page.is_published.is_(True), Page.show_in_footer.is_(True))
                                    .order_by(Page.title)))

    def faqs(self, home_only: bool) -> list[Faq]:
        stmt = select(Faq).where(Faq.is_active.is_(True)).order_by(Faq.group, Faq.sort_order, Faq.id)
        if home_only:
            stmt = stmt.where(Faq.show_on_home.is_(True))
        return list(self.db.scalars(stmt))

    # ---------- search ----------
    def suggestions(self, q: str) -> list[SearchSuggestion]:
        term = q.strip()
        if len(term) < 2:
            return []
        pattern = f"%{term}%"
        prefix = f"{term}%"
        products = self.db.scalars(
            select(Product).where(Product.is_published.is_(True), or_(Product.name.ilike(pattern), Product.sku.ilike(prefix)))
            .options(*CARD_LOADERS).order_by(Product.name.ilike(prefix).desc(), Product.view_count.desc())
            .limit(SUGGESTION_LIMIT))
        categories = self.db.scalars(
            select(Category).where(Category.is_active.is_(True), Category.name.ilike(pattern)).limit(4))
        results = [SearchSuggestion(type="category", name=c.name, slug=c.slug, image=c.image) for c in categories]
        for p in products:
            card = product_card(p)
            results.append(SearchSuggestion(type="product", name=p.name, slug=p.slug, image=card.image,
                                            price=card.final_price))
        return results


def _published_now():  # noqa: ANN202
    return or_(BlogPost.published_at.is_(None), BlogPost.published_at <= datetime.now(UTC))


def _aware(value: datetime) -> datetime:
    return value if value.tzinfo else value.replace(tzinfo=UTC)
