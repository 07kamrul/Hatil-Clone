"""Bundle pages (sofa sets, bedroom/divan sets) use a flat PascalCase `productDetails` schema, not the
lowercase one standard product pages use. Payloads below mirror shapes captured from the live site."""

import json
from decimal import Decimal

import pytest

from scraper.parsers import ParseError, SkipProduct, parse_product

SOFA_SET_URL = "https://shop.example.com/sofa/anderson-279-122-seat-set"
BED_SET_URL = "https://shop.example.com/bedroom/bed-room-set-1-bed-118"
LONG_TEXT = "<p>Built from kiln-dried beech wood and finished in antique lacquer for years of daily use.</p>"
SERVICE_INFO = [
    {"Title": "Features", "Description": "<ul><li>Beech frame</li></ul>"},
    {"Title": "Warranty", "Description": "12 months warranty."},
]
PICTURES = [{"ImageUrl": "https://cdn.example.com/a.jpg"}, {"ImageUrl": "https://cdn.example.com/b.png"},
            {"ImageUrl": "https://cdn.example.com/a.jpg"}]


def flight_page(details: dict, rows: dict[str, str] | None = None, service_info: list | None = None) -> str:
    """Render `details` the way the source streams it: text rows first, then the JSON rows."""
    chunks = [f"{row_id}:T{len(text.encode()):x},{text}" for row_id, text in (rows or {}).items()]
    chunks.append('23:[["$","$L28",null,' + json.dumps({"productDetails": details}) + "]]\n")
    if service_info is not None:
        chunks.append("24:" + json.dumps({"productServiceInfoModel": service_info}) + "\n")
    scripts = "".join(f"<script>self.__next_f.push([1,{json.dumps(c)}])</script>" for c in chunks)
    return f"<html><body>{scripts}</body></html>"


def sofa_set(**overrides: object) -> dict:
    info = {"ProductId": 11890, "ProductTitle": "Anderson-279 (1+2+2 Seat) Set", "BreadcrumbCategoryName": "SOFA SET",
            "Sku": "HCL-1, HCL-2", "BasePrice": 165200, "FullDescription": None, "ShortDescription": None,
            "MetaTitle": "Wooden Sofa Set | Anderson-279 | HATIL", "MetaDescription": "Wooden sofas.",
            "MetaKeywords": "Wooden Sofa Set"}
    return {"SofaSetInfo": {**info, **overrides},
            "SofaItemsModel": [{"SizeTag": "Single Seater ", "Quantity": 1}, {"SizeTag": "Double Seater", "Quantity": 2}],
            "ProductH1TagsModel": {"h1_content": "$2c"}, "PictureModel": PICTURES,
            "Breadcrumb": {"CategoryBreadcrumb": [{"Name": "Living Room"}]}}


def bed_set(**overrides: object) -> dict:
    return {"ProductId": 12249, "ProductTitle": "Bed Room Set-1 (Bed-118+Wardrobe-113)",
            "BreadcrumbCategoryName": "Bed Room Set", "TotalPrice": 184200, "SetType": "Bed Room Set",
            "FullDescription": None, "ShortDescription": None, "MetaTitle": "Bed Room Set-1",
            "MetaDescription": "Bedroom set.", "MetaKeywords": None,
            "ProductSetItemModel": [{"ItemTitle": "Galaxy-118", "Quantity": 1}, {"ItemTitle": "Cosmos-110", "Quantity": 2}],
            "ProductH1TagsModel": {"h1_content": "$2c"}, "PictureModel": PICTURES[:1],
            "Breadcrumb": {"CategoryBreadcrumb": [{"Name": "Bed Room"}]}, **overrides}


def test_sofa_set_page_is_parsed_instead_of_failing() -> None:
    html = flight_page(sofa_set(), {"2c": LONG_TEXT}, SERVICE_INFO)

    p = parse_product(html, SOFA_SET_URL)

    assert p.name == "Anderson-279 (1+2+2 Seat) Set"
    assert p.sku == "SRC-11890"
    assert p.slug == "anderson-279-122-seat-set"
    assert p.price == Decimal("165200.00") and p.sale_price is None
    assert p.category_path == ["Living Room", "Sofa Set"]
    assert p.images == ["https://cdn.example.com/a.jpg", "https://cdn.example.com/b.png"]  # de-duplicated, ordered
    assert ("Set includes", "1 x Single Seater, 2 x Double Seater") in p.specs
    assert p.meta_title == "Wooden Sofa Set | Anderson-279 | HATIL"
    assert "Beech frame" in p.description_html and "kiln-dried" in p.description_html
    assert p.warranty == "12 months warranty."


def test_bed_set_page_uses_total_price_and_item_titles() -> None:
    html = flight_page(bed_set(), {"2c": LONG_TEXT}, SERVICE_INFO)

    p = parse_product(html, BED_SET_URL)

    assert p.price == Decimal("184200.00")
    assert p.sku == "SRC-12249" and p.slug == "bed-room-set-1-bed-118"
    assert p.category_path == ["Bed Room", "Bed Room Set"]
    assert ("Set includes", "1 x Galaxy-118, 2 x Cosmos-110") in p.specs


def test_set_page_without_price_is_skipped_not_failed() -> None:
    with pytest.raises(SkipProduct):
        parse_product(flight_page(bed_set(TotalPrice=0), {"2c": LONG_TEXT}), BED_SET_URL)


def test_set_page_without_product_id_is_a_parse_error() -> None:
    with pytest.raises(ParseError):
        parse_product(flight_page(bed_set(ProductId=None), {"2c": LONG_TEXT}), BED_SET_URL)
