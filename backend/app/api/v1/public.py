from typing import Annotated, Any

from fastapi import APIRouter, BackgroundTasks, Depends, Query, Request, Response, status

from app.api.v1.filters import product_filters
from app.core.deps import DbSession
from app.core.errors import ValidationAppError
from app.core.rate_limit import PUBLIC_POST_LIMIT, limiter
from app.schemas.catalog import (
    CategoryDetail,
    CategoryNode,
    ColorOut,
    MaterialOut,
    ProductCard,
    ProductDetail,
    ProductFacets,
    ProductFilters,
    RoomOut,
)
from app.schemas.common import Message, Page, PageParams
from app.schemas.content import BannerOut, BlogPostOut, BlogPostSummary, FaqOut, PageOut, ShowroomOut
from app.schemas.system import ContactCreate, InquiryCreate, SearchSuggestion
from app.services.category_service import CategoryService
from app.services.inbox_service import ContactService, InquiryService
from app.services.notification_service import notify_admin_of_contact
from app.services.product_service import ProductService
from app.services.public_service import PublicService
from app.services.seo_service import SeoService
from app.services.settings_service import SettingsService

router = APIRouter()
Filters = Annotated[ProductFilters, Depends(product_filters)]
Paging = Annotated[PageParams, Depends()]
MAX_BY_IDS = 24
MAX_COMPARE = 4


def _client_ip(request: Request) -> str | None:
    forwarded = request.headers.get("x-forwarded-for")
    return forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else None)


# ---------- Catalog ----------
@router.get("/products", response_model=Page[ProductCard], tags=["catalog"])
def list_products(db: DbSession, filters: Filters, params: Paging) -> Page[ProductCard]:
    return ProductService(db).search(filters, params)


@router.get("/products/facets", response_model=ProductFacets, tags=["catalog"])
def product_facets(db: DbSession, filters: Filters) -> ProductFacets:
    return ProductService(db).facets(filters)


@router.get("/products/by-ids", response_model=list[ProductCard], tags=["catalog"])
def products_by_ids(db: DbSession, ids: str = Query(..., description="Comma-separated product ids")) -> list[ProductCard]:
    try:
        parsed = [int(i) for i in ids.split(",") if i.strip()]
    except ValueError as exc:
        raise ValidationAppError("ids must be integers") from exc
    return ProductService(db).by_ids(parsed[:MAX_BY_IDS])


@router.get("/products/compare", response_model=list[ProductDetail], tags=["catalog"])
def compare_products(db: DbSession, ids: str = Query(..., description="Comma-separated product ids (max 4)")) -> list[ProductDetail]:
    """Full details for the compare table; does not count as a product view."""
    try:
        parsed = [int(i) for i in ids.split(",") if i.strip()]
    except ValueError as exc:
        raise ValidationAppError("ids must be integers") from exc
    return ProductService(db).details_by_ids(parsed[:MAX_COMPARE])


@router.get("/products/{slug}", response_model=ProductDetail, tags=["catalog"])
def product_detail(slug: str, db: DbSession) -> ProductDetail:
    return ProductService(db).get_public_detail(slug)


@router.get("/products/{slug}/related", response_model=list[ProductCard], tags=["catalog"])
def related_products(slug: str, db: DbSession, limit: int = Query(8, ge=1, le=24)) -> list[ProductCard]:
    return ProductService(db).related(slug, limit)


@router.get("/categories/tree", response_model=list[CategoryNode], tags=["catalog"])
def category_tree(db: DbSession) -> list[CategoryNode]:
    return CategoryService(db).tree(active_only=True)


@router.get("/categories/featured", response_model=list[dict[str, Any]], tags=["catalog"])
def featured_categories(db: DbSession, limit: int = Query(8, ge=1, le=24)) -> list[dict[str, Any]]:
    return [{"id": c.id, "name": c.name, "slug": c.slug, "image": c.image}
            for c in PublicService(db).featured_categories(limit)]


@router.get("/categories/{slug}", response_model=CategoryDetail, tags=["catalog"])
def category_detail(slug: str, db: DbSession) -> CategoryDetail:
    return CategoryService(db).get_public(slug)


@router.get("/rooms", response_model=list[RoomOut], tags=["catalog"])
def rooms(db: DbSession) -> list[RoomOut]:
    return PublicService(db).rooms()


@router.get("/colors", response_model=list[ColorOut], tags=["catalog"])
def colors(db: DbSession) -> list[ColorOut]:
    return PublicService(db).colors()


@router.get("/materials", response_model=list[MaterialOut], tags=["catalog"])
def materials(db: DbSession) -> list[MaterialOut]:
    return PublicService(db).materials()


@router.get("/search", response_model=list[SearchSuggestion], tags=["catalog"])
def search(db: DbSession, q: str = Query(..., min_length=1, max_length=100)) -> list[SearchSuggestion]:
    return PublicService(db).suggestions(q)


# ---------- Content ----------
@router.get("/banners", response_model=list[BannerOut], tags=["content"])
def banners(db: DbSession, placement: str | None = Query(None, pattern="^(hero|offer|promo)$")) -> list[BannerOut]:
    return [BannerOut.model_validate(b) for b in PublicService(db).banners(placement)]


@router.get("/showrooms", response_model=list[ShowroomOut], tags=["content"])
def showrooms(db: DbSession, city: str | None = Query(None, max_length=100)) -> list[ShowroomOut]:
    return [ShowroomOut.model_validate(s) for s in PublicService(db).showrooms(city)]


@router.get("/showrooms/cities", response_model=list[str], tags=["content"])
def showroom_cities(db: DbSession) -> list[str]:
    return PublicService(db).showroom_cities()


@router.get("/showrooms/{slug}", response_model=ShowroomOut, tags=["content"])
def showroom(slug: str, db: DbSession) -> ShowroomOut:
    return ShowroomOut.model_validate(PublicService(db).showroom(slug))


@router.get("/blog", response_model=Page[BlogPostSummary], tags=["content"])
def blog(db: DbSession, params: Paging, q: str | None = Query(None, max_length=100)) -> Page[BlogPostSummary]:
    items, total = PublicService(db).blog_posts(params, q)
    return Page[BlogPostSummary].build([BlogPostSummary.model_validate(p) for p in items], total, params)


@router.get("/blog/{slug}", response_model=dict[str, Any], tags=["content"])
def blog_post(slug: str, db: DbSession) -> dict[str, Any]:
    service = PublicService(db)
    post = service.blog_post(slug)
    return {"post": BlogPostOut.model_validate(post).model_dump(mode="json"),
            "related": [BlogPostSummary.model_validate(p).model_dump(mode="json") for p in service.related_posts(post)]}


@router.get("/pages", response_model=list[dict[str, str]], tags=["content"])
def footer_pages(db: DbSession) -> list[dict[str, str]]:
    return [{"title": p.title, "slug": p.slug} for p in PublicService(db).footer_pages()]


@router.get("/pages/{slug}", response_model=PageOut, tags=["content"])
def page(slug: str, db: DbSession) -> PageOut:
    return PageOut.model_validate(PublicService(db).page(slug))


@router.get("/faqs", response_model=list[FaqOut], tags=["content"])
def faqs(db: DbSession, home: bool = False) -> list[FaqOut]:
    return [FaqOut.model_validate(f) for f in PublicService(db).faqs(home)]


@router.get("/settings/public", response_model=dict[str, Any], tags=["content"])
def public_settings(db: DbSession, response: Response) -> dict[str, Any]:
    response.headers["Cache-Control"] = "public, max-age=60"
    return SettingsService(db).public()


# ---------- Anonymous submissions ----------
@router.post("/inquiries", response_model=Message, status_code=status.HTTP_201_CREATED, tags=["inquiries"])
@limiter.limit(PUBLIC_POST_LIMIT)
def create_inquiry(request: Request, body: InquiryCreate, db: DbSession) -> Message:
    """Optional, anonymous log of a WhatsApp order for admin analytics. Nothing here is an order."""
    InquiryService(db).create(body, _client_ip(request), request.headers.get("user-agent"))
    return Message(detail="Logged")


@router.post("/contact", response_model=Message, status_code=status.HTTP_201_CREATED, tags=["contact"])
@limiter.limit(PUBLIC_POST_LIMIT)
def create_contact(request: Request, body: ContactCreate, db: DbSession, background: BackgroundTasks) -> Message:
    if body.website:  # honeypot field filled in → silently drop bot submissions
        return Message(detail="Thank you! We will get back to you shortly.")
    if not (body.email or body.phone):
        raise ValidationAppError("Provide an email address or phone number so we can reply")
    message = ContactService(db).create(body, _client_ip(request))
    background.add_task(notify_admin_of_contact, message.name, message.email, message.phone, message.subject,
                        message.message)
    return Message(detail="Thank you! We will get back to you shortly.")


# ---------- SEO ----------
@router.get("/seo/sitemap.xml", include_in_schema=False)
def sitemap(db: DbSession) -> Response:
    return Response(SeoService(db).sitemap_xml(), media_type="application/xml",
                    headers={"Cache-Control": "public, max-age=3600"})


@router.get("/seo/robots.txt", include_in_schema=False)
def robots(db: DbSession) -> Response:
    return Response(SeoService(db).robots_txt(), media_type="text/plain")
