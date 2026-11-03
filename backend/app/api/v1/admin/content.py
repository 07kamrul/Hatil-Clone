from fastapi import APIRouter

from app.api.v1.admin.crud import build_crud_router
from app.models import Banner, BlogPost, Faq, Page, Showroom
from app.schemas.content import (
    BannerIn,
    BannerOut,
    BannerUpdate,
    BlogPostIn,
    BlogPostOut,
    BlogPostUpdate,
    FaqIn,
    FaqOut,
    FaqUpdate,
    PageIn,
    PageOut,
    PageUpdate,
    ShowroomIn,
    ShowroomOut,
    ShowroomUpdate,
)
from app.services.crud_service import CrudConfig

router = APIRouter()

router.include_router(build_crud_router(
    "/banners", "admin: banners", Banner,
    CrudConfig(label="Banner", search_fields=("title",), default_order=("placement", "sort_order")),
    BannerIn, BannerUpdate, BannerOut))
router.include_router(build_crud_router(
    "/showrooms", "admin: showrooms", Showroom,
    CrudConfig(label="Showroom", search_fields=("name", "city", "address"), slug_source="name",
               default_order=("sort_order", "name")),
    ShowroomIn, ShowroomUpdate, ShowroomOut))
router.include_router(build_crud_router(
    "/blog-posts", "admin: blog", BlogPost,
    CrudConfig(label="Blog post", search_fields=("title", "excerpt"), html_fields=("body_html",),
               slug_source="title", default_order=("-created_at",)),
    BlogPostIn, BlogPostUpdate, BlogPostOut))
router.include_router(build_crud_router(
    "/pages", "admin: pages", Page,
    CrudConfig(label="Page", search_fields=("title",), html_fields=("body_html",), slug_source="title",
               default_order=("title",)),
    PageIn, PageUpdate, PageOut))
router.include_router(build_crud_router(
    "/faqs", "admin: faqs", Faq,
    CrudConfig(label="FAQ", search_fields=("question",), html_fields=("answer_html",),
               default_order=("group", "sort_order")),
    FaqIn, FaqUpdate, FaqOut))
