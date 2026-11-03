from xml.sax.saxutils import escape

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.models import BlogPost, Category, Page, Product, Showroom

STATIC_PATHS = ("/", "/products", "/showrooms", "/blog", "/contact", "/faq")


class SeoService:
    def __init__(self, db: Session) -> None:
        self.db = db
        self.base = get_settings().public_base_url.rstrip("/")

    def sitemap_xml(self) -> str:
        entries: list[tuple[str, str | None]] = [(p, None) for p in STATIC_PATHS]
        entries += [(f"/category/{slug}", None) for slug in self.db.scalars(
            select(Category.slug).where(Category.is_active.is_(True)))]
        entries += [(f"/product/{slug}", ts) for slug, ts in self.db.execute(
            select(Product.slug, Product.updated_at).where(Product.is_published.is_(True)))]
        entries += [(f"/blog/{slug}", None) for slug in self.db.scalars(
            select(BlogPost.slug).where(BlogPost.is_published.is_(True)))]
        entries += [(f"/page/{slug}", None) for slug in self.db.scalars(
            select(Page.slug).where(Page.is_published.is_(True)))]
        entries += [(f"/showrooms/{slug}", None) for slug in self.db.scalars(
            select(Showroom.slug).where(Showroom.is_active.is_(True)))]
        rows = "".join(
            f"<url><loc>{escape(self.base + path)}</loc>"
            + (f"<lastmod>{ts.date().isoformat()}</lastmod>" if ts else "") + "</url>"
            for path, ts in entries
        )
        return ('<?xml version="1.0" encoding="UTF-8"?>'
                f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{rows}</urlset>')

    def robots_txt(self) -> str:
        return (f"User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /cart\nDisallow: /api/\n\n"
                f"Sitemap: {self.base}/sitemap.xml\n")
