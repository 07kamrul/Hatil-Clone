"""Content parsers and importer: synthetic flight/DOM payloads mirroring hatil.com (captured 2026-11-04)."""

import json
from datetime import UTC, datetime
from decimal import Decimal  # noqa: F401 - keeps linters happy about app imports order below
from urllib.parse import urljoin  # noqa: F401

import httpx
import pytest
from sqlalchemy import select

from app.models import Banner, BlogPost, Faq, Page, Showroom
from scraper.content import (
    ContentParseError,
    classify_content_url,
    parse_banners,
    parse_blog_post,
    parse_faqs,
    parse_page,
    parse_showroom,
)
from scraper.content_import import ContentImporter


def flight_page(payloads: dict) -> str:
    chunks = []
    for i, (key, value) in enumerate(payloads.items()):
        chunks.append(f"{2 + i * 7}:" + json.dumps({key: value}) + "\n")
    scripts = "".join(f"<script>self.__next_f.push([1,{json.dumps(c)}])</script>" for c in chunks)
    return f"<html><body>{scripts}</body></html>"


def dom_page(main_html: str, title: str = "Some page | HATIL", ld: str = "") -> str:
    ld_tag = f'<script type="application/ld+json">{ld}</script>' if ld else ""
    return (f"<html><head><title>{title}</title>{ld_tag}</head>"
            f"<body><header>nav</header><main>{main_html}</main><footer>foot</footer></body></html>")


# ---------- classify ----------
def test_classify_content_url_kinds() -> None:
    base = "https://hatil.com"
    assert classify_content_url(f"{base}/") == "home"
    assert classify_content_url(f"{base}/showrooms/hatil-furniture-agrabad") == "showroom"
    assert classify_content_url(f"{base}/blog/some-post") == "blog"
    assert classify_content_url(f"{base}/faq") == "page"
    assert classify_content_url(f"{base}/about-hatil") == "page"
    assert classify_content_url(f"{base}/sofa/nova-210") is None
    assert classify_content_url(f"{base}/blog") is None  # listing page, not a post


# ---------- showrooms ----------
def test_parse_showroom_reads_flight_info() -> None:
    info = {"Name": "HATIL Furniture Agrabad", "Latitude": 22.3294, "Longitude": 91.8012,
            "Address": "Access Road, Agrabad 601/722 Amin Tower", "Division": "Chattogram",
            "Mobile": "+8801713441011", "OffDays": "Friday", "VisitingHours": "10:30am to 8pm"}
    ld = json.dumps({"@type": "FurnitureStore", "address": {"addressLocality": "Chattogram"},
                     "telephone": "+8801713441011"})
    html = flight_page({"showroomInfo": info}).replace("</body>", f"{ld}</body>")

    showroom = parse_showroom(html, "https://hatil.com/showrooms/hatil-furniture-agrabad")

    assert showroom.slug == "hatil-furniture-agrabad"
    assert showroom.name == "HATIL Furniture Agrabad"
    assert showroom.city == "Chattogram"
    assert showroom.phone == "+8801713441011"
    assert showroom.latitude == 22.3294 and showroom.off_days == "Friday"


def test_parse_showroom_without_data_raises() -> None:
    with pytest.raises(ContentParseError):
        parse_showroom(dom_page("<main>empty</main>"), "https://hatil.com/showrooms/x")


# ---------- banners ----------
def test_parse_banners_reads_menu_slider_and_gallery_cards() -> None:
    slider = {"Title": "Home page first slider", "Type": "MenuSlider", "UrlLink": "/product-list/1064",
              "HomePageCardImages": [{"Title": "Compliments your lifestyle", "Description": "The best",
                                      "ImageUrl": "https://hatil-image.s3.amazonaws.com/hero.jpg",
                                      "UrlLink": "/product-list/1064", "DisplayOrder": 1}]}
    gallery = {"Title": "Living", "Type": "ImageGalleryLiving",
               "HomePageCardImages": [{"Title": None, "ImageUrl": "https://hatil-image.s3.amazonaws.com/liv.jpg",
                                       "UrlLink": "living-room-furniture-price-in-bangladesh", "DisplayOrder": 1}]}
    other = {"Title": "Skip me", "Type": "SomethingElse", "HomePageCardImages": []}
    html = flight_page({"homePageCard": slider})
    html2 = flight_page({"homePageCard": gallery})
    html3 = flight_page({"homePageCard": other})

    banners = parse_banners(html) + parse_banners(html2) + parse_banners(html3)

    assert [(b.placement, b.title) for b in banners] == [("hero", "Compliments your lifestyle"),
                                                         ("promo", "Living")]
    assert banners[0].link_url == "/product-list/1064"
    assert banners[1].image.endswith("liv.jpg")


# ---------- static pages + faqs ----------
def test_parse_page_reads_main_dom_and_title() -> None:
    html = dom_page("<h2>About Us</h2><p>HATIL is a fast-growing furniture brand.</p>",
                    title="About HATIL | HATIL", ld="")

    page = parse_page(html, "https://hatil.com/about-hatil")

    assert page.slug == "about-hatil"
    assert page.title == "About Us"
    assert "fast-growing furniture brand" in page.body_html
    assert "nav" not in page.body_html and "foot" not in page.body_html


def test_parse_faqs_reads_accordion_items() -> None:
    html = dom_page(
        '<div class="accordion-item"><h5>Do you have an environment policy?</h5>'
        '<div class="accordion-content"><p>Yes, always.</p><p>And more.</p></div></div>'
        '<div class="accordion-item"><h5>Second question</h5><div class="accordion-content"><p>Answer.</p>'
        "</div></div>")

    faqs = parse_faqs(html)

    assert [f.question for f in faqs] == ["Do you have an environment policy?", "Second question"]
    assert "Yes, always." in faqs[0].answer_html and "And more." in faqs[0].answer_html


# ---------- blog ----------
def test_parse_blog_post_reads_yoast_json_ld_and_entry_content() -> None:
    posting = {"@type": "BlogPosting", "headline": "Interior design mistakes",
               "datePublished": "2021-10-24T11:36:26+06:00", "author": {"name": "Ashna Binte Ali"},
               "image": {"@id": "https://hatil.com/blog/wp-content/uploads/2021/10/cover.png"}}
    html = (dom_page('<h1>ignored h1</h1><div class="entry-content"><p>Body text with an image '
                     '<img src="https://hatil.com/blog/wp-content/uploads/2021/10/inline.png"></p></div>'
                     '<div class="post-categories"><a>Interior</a></div>', title="t")
            .replace("</head>", "</head>"))
    html = html.replace("</body>", '<script type="application/ld+json">'
                        + json.dumps({"@graph": [{"@type": "WebPage"}, posting]}) + "</script></body>")

    post = parse_blog_post(html, "https://hatil.com/blog/5-common-interior-mistakes/")

    assert post.slug == "5-common-interior-mistakes"
    assert post.title == "Interior design mistakes"
    assert post.author == "Ashna Binte Ali"
    assert post.tags == ["Interior"]
    assert post.published_at == datetime(2021, 10, 24, 5, 36, 26, tzinfo=UTC)
    assert post.cover_image.endswith("cover.png")
    assert "Body text" in post.body_html
    assert 'src="https://hatil.com/blog/wp-content/uploads/2021/10/inline.png"' in post.body_html


# ---------- importer (DB + storage, HTTP mocked) ----------
@pytest.fixture
def importer(db, monkeypatch, tmp_path):
    from dataclasses import replace as dc_replace

    from app.storage.local import LocalStorage
    from scraper.config import ScraperConfig
    from scraper.http import PoliteClient

    config = dc_replace(ScraperConfig(), base_url="https://shop.example.com",
                        sitemap_urls=("https://shop.example.com/sitemap.xml",), requests_per_second=1000,
                        backoff_base=0.0, max_retries=1, use_playwright=False)
    upload_dir = tmp_path / "uploads"

    def handler(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url.endswith("/robots.txt"):
            return httpx.Response(200, text="User-Agent: *\nAllow: /\n")
        if url.endswith("/sitemap.xml"):
            return httpx.Response(200, text=SITEMAP)
        if url.endswith("/"):
            return httpx.Response(200, text=flight_page({"homePageCard": {"Type": "MenuSlider",
                                                                        "HomePageCardImages": [
                                                                            {"Title": "Hero", "ImageUrl":
                                                                             "https://cdn.example.com/h.jpg",
                                                                             "DisplayOrder": 1}]}}))
        if "/showrooms/" in url:
            info = {"Name": "HATIL Agrabad", "Address": "Amin Tower", "Division": "Chattogram"}
            return httpx.Response(200, text=flight_page({"showroomInfo": info}))
        if "/blog/" in url:
            posting = {"@type": "BlogPosting", "headline": "Post", "datePublished": "2021-10-24T11:36:26+06:00",
                       "image": {"url": "https://cdn.example.com/cover.png"}}
            body = (dom_page('<div class="entry-content"><p>Body <img src="https://cdn.example.com/p.png"></p>'
                             "</div>").replace("</body>", '<script type="application/ld+json">'
                                              + json.dumps({"@graph": [posting]}) + "</script></body>"))
            return httpx.Response(200, text=body)
        if "/faq" in url:
            return httpx.Response(200, text=dom_page('<div class="accordion-item"><h5>Q?</h5>'
                                                     '<div class="accordion-content"><p>A.</p></div></div>'))
        if "cdn.example.com" in url:
            from tests.conftest import png_bytes

            return httpx.Response(200, content=png_bytes("blue"))
        return httpx.Response(200, text=dom_page("<h2>Page</h2><p>Content.</p>"))

    client = PoliteClient(config, client=httpx.Client(transport=httpx.MockTransport(handler)),
                          sleep=lambda _s: None)
    storage = LocalStorage(str(upload_dir), "/uploads")
    # conftest sets UPLOAD_DIR to a temp dir; point get_storage at our LocalStorage
    monkeypatch.setattr("scraper.content_import.get_storage", lambda: storage)
    importer = ContentImporter(config, lambda: db, client=client, storage=storage)
    yield importer
    importer.close()


SITEMAP = """<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://shop.example.com/</loc></url>
<url><loc>https://shop.example.com/showrooms/hatil-furniture-agrabad</loc></url>
<url><loc>https://shop.example.com/about-hatil</loc></url>
<url><loc>https://shop.example.com/faq</loc></url>
<url><loc>https://shop.example.com/blog/some-post</loc></url>
<url><loc>https://shop.example.com/sofa/nova-210</loc></url>
</urlset>"""


def test_content_run_upserts_every_kind(db, importer) -> None:
    report = importer.run(["showrooms", "banners", "pages", "blog"])

    assert report.failed == 0, report.failures
    showroom = db.scalars(select(Showroom)).all()
    assert [s.slug for s in showroom] == ["hatil-furniture-agrabad"]
    assert showroom[0].city == "Chattogram"

    banners = db.scalars(select(Banner)).all()
    assert [b.title for b in banners] == ["Hero"]
    assert banners[0].placement.value == "hero"
    assert banners[0].image.startswith("/uploads/banners/")
    assert banners[0].image.endswith(".webp")

    pages = {p.slug: p for p in db.scalars(select(Page)).all()}
    assert set(pages) == {"about-hatil", "faq"}
    assert pages["about-hatil"].is_published
    faqs = db.scalars(select(Faq)).all()
    assert [f.question for f in faqs] == ["Q?"]

    post = db.scalars(select(BlogPost)).one()
    assert post.slug == "some-post" and post.title == "Post"
    assert post.is_published and post.cover_image and post.cover_image.startswith("/uploads/blog/")
    # inline blog image was localized to /uploads, not hotlinked
    assert "cdn.example.com" not in post.body_html
    assert "/uploads/blog/" in post.body_html
    assert report.images_stored >= 0


def test_content_run_is_idempotent(db, importer) -> None:
    first = importer.run(["showrooms", "banners", "pages", "blog"])
    banners_before = db.scalars(select(Banner)).all()
    second = importer.run(["showrooms", "banners", "pages", "blog"])

    # banners are create-only: the re-run adds no rows and keeps the originals
    assert [b.title for b in db.scalars(select(Banner)).all()] == [b.title for b in banners_before]
    assert len(db.scalars(select(Banner)).all()) == len(banners_before)
    assert second.created == 0
    assert first.created >= 4


# ---------- seed placeholder cleanup ----------
def _seed_rows(db) -> None:
    """Insert demo rows the way scripts.seed --demo would (seed- image marker)."""
    from app.core.enums import BannerPlacement

    db.add(Showroom(slug="gulshan-flagship", name="Gulshan Flagship", city="Dhaka", address="Road 45",
                    image="/uploads/showrooms/seed-gulshan-flagship-ab12.webp", sort_order=0))
    db.add(BlogPost(slug="5-ways-to-make-a-small-living-room-feel-bigger", title="Small living room",
                    body_html="<p>x</p>", cover_image="/uploads/blog/seed-small-room-cd34.webp",
                    is_published=True))
    db.add(Banner(title="Sleep better", image="/uploads/banners/seed-sleep-better-ef56.webp",
                  placement=BannerPlacement.HERO, sort_order=0, is_active=True))
    db.add(Banner(title="Admin pick", image="/uploads/banners/real-photo-aa11.webp",
                  placement=BannerPlacement.PROMO, sort_order=1, is_active=True))
    db.commit()


def test_successful_scrape_removes_seed_rows_but_keeps_admin_rows(db, importer) -> None:
    _seed_rows(db)

    report = importer.run(["showrooms", "banners", "blog"])

    assert report.failed == 0, report.failures
    slugs = {s.slug for s in db.scalars(select(Showroom)).all()}
    assert "gulshan-flagship" not in slugs  # seed placeholder removed
    assert "hatil-furniture-agrabad" in slugs  # real scraped row stays
    posts = {p.slug for p in db.scalars(select(BlogPost)).all()}
    assert "5-ways-to-make-a-small-living-room-feel-bigger" not in posts
    assert "some-post" in posts
    banners = {b.title for b in db.scalars(select(Banner)).all()}
    assert "Sleep better" not in banners  # seed banner removed once real banners arrived
    assert "Admin pick" in banners  # non-seed image untouched
    assert "Hero" in banners  # scraped banner created
    assert report.images_purged == 3


def test_failed_scrape_keeps_seed_rows(db, monkeypatch, importer) -> None:
    _seed_rows(db)
    from scraper.http import FetchError

    def boom(url: str) -> str:
        if url.endswith("/sitemap.xml"):
            return SITEMAP
        raise FetchError("source down")

    monkeypatch.setattr(importer.client, "get_text", boom)
    report = importer.run(["showrooms"])

    assert report.failed == 1
    assert {s.slug for s in db.scalars(select(Showroom)).all()} == {"gulshan-flagship"}
    assert report.images_purged == 0


def test_is_seed_image_detection() -> None:
    from scraper.demo_cleanup import is_seed_image

    assert is_seed_image("/uploads/banners/seed-sleep-better-ab12.webp")
    assert not is_seed_image("/uploads/banners/real-photo-ab12.webp")
    assert not is_seed_image(None)
    assert not is_seed_image("https://hatil.com/x/seeded.webp")  # marker must be its own segment
