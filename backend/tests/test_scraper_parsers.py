import json
from decimal import Decimal
from pathlib import Path

import pytest

from scraper.config import ScraperConfig
from scraper.discovery import category_slug_of, classify_url, extract_product_links, next_page_url, parse_sitemap
from scraper.mapper import to_import
from scraper.parsers import ParseError, extract_flight, parse_product, text_rows

FIXTURES = Path(__file__).parent / "fixtures"
CONFIG = ScraperConfig()


def fixture(name: str) -> str:
    return (FIXTURES / name).read_text(encoding="utf-8")


def test_flight_text_rows_are_resolved() -> None:
    flight = extract_flight(fixture("product_flight.html"))
    rows = text_rows(flight)
    assert rows["2c"].startswith("<p>Testwood-101 is a single seater sofa")


def test_parse_product_from_flight_payload() -> None:
    p = parse_product(fixture("product_flight.html"), "https://shop.example.com/sofa/testwood-101")
    assert p.name == "Testwood-101"
    assert p.sku == "201-101-10-1-67"
    assert p.slug == "testwood-101"
    assert p.price == Decimal("40000.00") and p.sale_price == Decimal("34600.00")
    assert p.category_path == ["Living Room", "Sofa"]
    assert p.images == ["https://cdn.example.com/img/testwood-101-1.webp", "https://cdn.example.com/img/testwood-101-2.webp"]
    assert p.dimension_images == ["https://cdn.example.com/dim/testwood-101-d.jpg"]
    assert p.materials == ["Beech Wood"] and p.colors == ["Walnut", "Natural"]
    assert p.dimensions == "L800 x W850 x H900 mm"
    assert ("Seat height", "45 cm") in p.specs and ("Material", "Beech Wood") in p.specs
    assert p.warranty == "12 months warranty against manufacturing defects."
    assert "Solid beech frame" in p.description_html and "lacquered beech" in p.description_html
    assert "<img" not in p.description_html  # source-hosted images are stripped from rich text
    assert len(p.variants) == 2 and p.variants[1].price == Decimal("36600.00")


def test_mapper_builds_variants_with_price_deltas() -> None:
    p = parse_product(fixture("product_flight.html"), "https://shop.example.com/sofa/testwood-101")
    data = to_import(p, max_images=1)
    assert data.images == ["https://cdn.example.com/img/testwood-101-1.webp"]
    assert data.variants == [("Walnut", "L800 x W850 x H900 mm", Decimal("0.00")),
                             ("Natural", "L800 x W850 x H900 mm", Decimal("2000.00"))]
    assert data.stock_status.value == "in_stock"


def test_parse_product_falls_back_to_json_ld() -> None:
    p = parse_product(fixture("product_jsonld.html"), "https://shop.example.com/table/plain-table")
    assert p.name == "Plain Table" and p.sku == "PT-1"
    assert p.price == Decimal("12500.00")
    assert p.in_stock is False
    assert p.images == ["https://cdn.example.com/plain-table.jpg"]


def test_parse_product_without_data_raises() -> None:
    with pytest.raises(ParseError):
        parse_product("<html><body><p>nothing here</p></body></html>", "https://shop.example.com/x/y")


def test_parse_sitemap_and_index() -> None:
    pages, children = parse_sitemap(fixture("sitemap.xml"))
    assert len(pages) == 8 and children == []
    pages, children = parse_sitemap(fixture("sitemap_index.xml"))
    assert pages == [] and children == ["https://shop.example.com/sitemap-products.xml"]


@pytest.mark.parametrize(("url", "kind"), [
    ("https://shop.example.com/sofa/testwood-101", "product"),
    ("https://shop.example.com/content/testwood-102", "product"),
    ("https://shop.example.com/blog/how-to-clean", "blog"),
    ("https://shop.example.com/showrooms/gulshan", "showroom"),
    ("https://shop.example.com/sofa-price-in-bangladesh", "category"),
    ("https://shop.example.com/about-us", "other"),
    ("https://shop.example.com/", "other"),
    # Model pages live at a single segment (no category prefix); static/listing pages carry no model number.
    ("https://shop.example.com/adept-165", "product"),
    ("https://shop.example.com/arnica-137lobelia-131-director-table-side-table-set", "product"),
    ("https://shop.example.com/vie-225-and-outfit-225-6-chair-and-1-table-dining-set", "product"),
    ("https://shop.example.com/non-lacquer-2-door-wardrobe", "other"),
    ("https://shop.example.com/center-table-with-glass-top", "other"),
    ("https://shop.example.com/billing-terms-and-conditions", "other"),
    ("https://shop.example.com/book-shelves-price-in-bangladesh&", "other"),
    ("https://shop.example.com/dining-table-120-price-in-bangladesh", "category"),
])
def test_classify_url(url: str, kind: str) -> None:
    assert classify_url(url, CONFIG) == kind


def test_category_slug_of() -> None:
    assert category_slug_of("https://shop.example.com/sofa/testwood-101") == "sofa"
    assert category_slug_of("https://shop.example.com/content/testwood-102") is None


def test_extract_product_links_dedupes_and_stays_on_host() -> None:
    html = fixture("category.html")
    links = extract_product_links(html, "https://shop.example.com/sofa-price-in-bangladesh", CONFIG)
    assert links == ["https://shop.example.com/sofa/testwood-101", "https://shop.example.com/content/testwood-102"]
    assert next_page_url(html, "https://shop.example.com/sofa-price-in-bangladesh") == \
        "https://shop.example.com/sofa-price-in-bangladesh?page=2"


SOFT_404_FLIGHT = (
    # Rendered not-found boundary as seen on hatil.com dead product pages (e.g. /sofa/andaman-184-122-seat,
    # verified 2026-11-04): HTTP 200, no <title>, flight carries nav categories + the boundary, no productDetails.
    '2:[["$","h2",null,{"className":"mb-3","children":"404"}],'
    '["$","h4",null,{"children":"Page Not Found"}],'
    '["$","p",null,{"className":"my-3 text-center","children":"Could not find requested resource"}]]\n'
)
CATEGORY_FLIGHT = (
    # Listing pages (e.g. /office-furniture-price-in-bangladesh) have a title and product links in the
    # flight payload but no productDetails and no JSON-LD.
    '1b:[["$","$L27",null,{"page":"others","categories":[{"name":"Living Room","se_name":"sofa"}]}]\n'
)


def _next_page(title: str | None, flight: str) -> str:
    head = f"<head><title>{title}</title></head>" if title is not None else "<head></head>"
    return (f"<html>{head}<body>"
            f"<script>self.__next_f.push([1,{json.dumps(flight)}])</script></body></html>")


def test_source_404_page_is_skipped_not_failed() -> None:
    from scraper.parsers import SkipProduct

    html = "<html><head><title>404: This page could not be found.</title></head><body></body></html>"
    with pytest.raises(SkipProduct):
        parse_product(html, "https://shop.example.com/sofa/gone-1")


def test_rendered_404_page_with_stale_product_data_is_still_skipped() -> None:
    """A rendered not-found page (title says so) can carry stale productDetails; the title check must win."""
    from scraper.parsers import SkipProduct

    stale = json.dumps({"productDetails": {"ProductId": 10999, "ProductTitle": "Capsicum-127", "TotalPrice": 1}})
    html = ("<html><head><title>404: This page could not be found.</title></head><body>"
            f"<script>self.__next_f.push([1,{json.dumps('10:' + stale + chr(10))}])</script></body></html>")
    with pytest.raises(SkipProduct):
        parse_product(html, "https://shop.example.com/Folding-Bed/capsicum-127")


def test_soft404_page_without_title_is_skipped_not_failed() -> None:
    """Dead hatil.com product URLs return HTTP 200 with a rendered 404 boundary and no <title>."""
    from scraper.parsers import SkipProduct

    html = _next_page(None, SOFT_404_FLIGHT)
    with pytest.raises(SkipProduct, match="soft 404"):
        parse_product(html, "https://hatil.com/sofa/andaman-184-122-seat")


def test_listing_page_without_product_data_is_skipped_not_failed() -> None:
    """A category listing reached via redirect has a title but no product data: skip, don't fail forever."""
    from scraper.parsers import SkipProduct

    html = _next_page("Office Furniture Price in Bangladesh 2026 | HATIL", CATEGORY_FLIGHT)
    with pytest.raises(SkipProduct, match="Not a product page"):
        parse_product(html, "https://hatil.com/interior-furniture/office")


def test_live_page_with_embedded_not_found_boundary_is_not_skipped() -> None:
    """Regression: every live hatil.com page embeds the notFound boundary text in its flight payload
    (verified 2026-11-04 on /Bar-Stool/virgo-103, HTTP 200); that must not mark the product discontinued."""
    boundary = '9:[["$","title",null,{"children":"404: This page could not be found."}]]\n'
    details = json.dumps({"productDetails": {"name": "Virgo-103", "sku": "V-103", "se_name": "virgo-103",
                                             "product_price": {"price_value": 12500}}})
    html = ("<html><head><title>Virgo-103 Bar Stool Price in Bangladesh | HATIL</title></head><body>"
            f"<script>self.__next_f.push([1,{json.dumps(boundary)}])</script>"
            f"<script>self.__next_f.push([1,{json.dumps('10:' + details + chr(10))}])</script></body></html>")
    p = parse_product(html, "https://shop.example.com/Bar-Stool/virgo-103")
    assert p.name == "Virgo-103"
