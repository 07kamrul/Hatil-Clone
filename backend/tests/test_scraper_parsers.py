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


def test_source_404_page_is_skipped_not_failed() -> None:
    from scraper.parsers import SkipProduct

    html = '<html><body><script>self.__next_f.push([1,"0:[\\"This page could not be found.\\"]\n"])</script></body></html>'
    with pytest.raises(SkipProduct):
        parse_product(html, "https://shop.example.com/sofa/gone-1")
