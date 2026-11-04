"""Pure parsing functions (no I/O) — covered by tests with saved HTML fixtures.

The source site is a Next.js App Router app: page data is streamed as React Server Component
"flight" chunks via `self.__next_f.push([1, "..."])`. Product pages embed a nopCommerce-style
`productDetails` object, a `productConfigs` list (material → color → size with MRP/SKU) and a
`productServiceInfoModel` list (Features / Care / Warranty). Long strings are emitted as text rows
(`2c:T<hex-length>,<text>`) and referenced as "$2c".
"""

import json
import re
from dataclasses import dataclass, field
from decimal import Decimal
from typing import Any
from urllib.parse import urlsplit

from selectolax.lexbor import LexborHTMLParser as HTMLParser

from app.core.text import sanitize_html, strip_tags

_PUSH = re.compile(r"self\.__next_f\.push\(\[1,\s*\"((?:[^\"\\]|\\.)*)\"\]\)", re.S)
_ROW_HEAD = re.compile(rb"([0-9a-f]+):(?:T([0-9a-f]+),)?")
_IMG_TAG = re.compile(r"<img\b[^>]*>", re.I)
_DECODER = json.JSONDecoder()
NEWLINE = bytes([10])


class ParseError(ValueError):
    pass


class SkipProduct(ParseError):  # noqa: N818 - signals "not importable", not a malfunction
    """The page is valid but has nothing to import (discontinued/404 page, call-for-price item)."""


NOT_FOUND_MARKERS = ("This page could not be found", "NEXT_NOT_FOUND", "NEXT_HTTP_ERROR_FALLBACK;404")


@dataclass
class ScrapedVariant:
    color: str | None
    size: str | None
    sku: str | None
    price: Decimal | None


@dataclass
class ScrapedProduct:
    source_url: str
    name: str
    sku: str
    slug: str
    price: Decimal
    sale_price: Decimal | None = None
    in_stock: bool = True
    category_path: list[str] = field(default_factory=list)
    short_desc: str | None = None
    description_html: str | None = None
    warranty: str | None = None
    dimensions: str | None = None
    specs: list[tuple[str, str]] = field(default_factory=list)
    colors: list[str] = field(default_factory=list)
    materials: list[str] = field(default_factory=list)
    variants: list[ScrapedVariant] = field(default_factory=list)
    images: list[str] = field(default_factory=list)
    dimension_images: list[str] = field(default_factory=list)
    meta_title: str | None = None
    meta_description: str | None = None
    meta_keywords: str | None = None

    def to_dict(self) -> dict[str, Any]:
        data = self.__dict__.copy()
        data["price"] = str(self.price)
        data["sale_price"] = str(self.sale_price) if self.sale_price is not None else None
        data["variants"] = [{**v.__dict__, "price": str(v.price) if v.price is not None else None} for v in self.variants]
        return data


# ---------- Flight payload ----------
def extract_flight(html: str) -> str:
    parts = []
    for raw in _PUSH.findall(html):
        try:
            parts.append(json.loads(f'"{raw}"'))
        except json.JSONDecodeError:
            continue
    return "".join(parts)


def text_rows(flight: str) -> dict[str, str]:
    """Map RSC text-row ids to their content.

    Rows are `<hex id>:<payload>`; text rows are `<id>:T<hex byte length>,<text>` and the next row starts
    right after those bytes (not necessarily on a new line), so rows are walked sequentially.
    """
    data = flight.encode("utf-8")
    rows: dict[str, str] = {}
    pos, size = 0, len(data)
    while pos < size:
        match = _ROW_HEAD.match(data, pos)
        length = match.group(2) if match else None
        if match is None or length is None:
            newline = data.find(NEWLINE, match.end() if match else pos)
            pos = size if newline == -1 else newline + 1
            continue
        row_id = match.group(1).decode()
        end = match.end() + int(length, 16)
        rows[row_id] = data[match.end():end].decode("utf-8", errors="ignore")
        pos = end
    return rows


def find_json(flight: str, key: str) -> Any:
    marker = f'"{key}":'
    index = flight.find(marker)
    while index != -1:
        try:
            start = index + len(marker)
            while start < len(flight) and flight[start].isspace():
                start += 1
            value, _ = _DECODER.raw_decode(flight, start)
            return value
        except json.JSONDecodeError:
            index = flight.find(marker, index + 1)
    return None


def _resolve(value: Any, refs: dict[str, str]) -> Any:
    if isinstance(value, str) and re.fullmatch(r"\$[0-9a-f]+", value):
        return refs.get(value[1:])
    return value


# ---------- Product ----------
def parse_product(html: str, url: str) -> ScrapedProduct:
    flight = extract_flight(html)
    details = find_json(flight, "productDetails") if flight else None
    # Next.js 404 pages keep stale product data in their not-found fallback segment, so the marker
    # check must win even when `details` parsed successfully.
    if any(marker in html for marker in NOT_FOUND_MARKERS):
        raise SkipProduct(f"Not found on source (discontinued): {url}")
    if isinstance(details, dict) and details.get("name"):
        refs = text_rows(flight)
        return _from_details(details, find_json(flight, "productConfigs") or [],
                             find_json(flight, "productServiceInfoModel") or [], refs, url)
    if isinstance(details, dict) and (details.get("SofaSetInfo") or details.get("SetType")):
        return _from_set_details(details, find_json(flight, "productServiceInfoModel") or [],
                                 text_rows(flight), url)
    return parse_product_dom(html, url)


def _compose_body(sections: dict[str, str | None], description: str | None, h1: str | None) -> str | None:
    """Features + (substantial) description + H1 block, then care instructions under a heading."""
    features = _clean_html(sections.get("features"))
    long_description = description if description and len(strip_tags(description)) > 40 else None
    body = "".join(part for part in (features, long_description, h1) if part) or description
    care = _clean_html(sections.get("furniture care information"))
    return (body or "") + "<h3>Care</h3>" + care if care else body


def _from_set_details(d: dict, info: list, refs: dict[str, str], url: str) -> ScrapedProduct:
    """Bundle pages (sofa sets, bedroom/divan sets): a flat PascalCase schema.

    Sofa sets nest the core fields under `SofaSetInfo` (price = `BasePrice`); bedroom/divan sets keep them
    at the top level (price = `TotalPrice`). A set has no SKU of its own, so one is derived from the source
    product id (stable across runs, which keeps the SKU upsert idempotent). Discounts are not applied: the
    samples seen carry none and it is unknown whether the price is pre- or post-discount.
    """
    core = d.get("SofaSetInfo") or d
    product_id = core.get("ProductId") or d.get("ProductId")
    if not product_id:
        raise ParseError(f"Set page has no product id: {url}")
    price = _money(core.get("BasePrice") or d.get("TotalPrice"))
    if price is None:
        raise SkipProduct(f"No price on source (call for price): {url}")

    sections = {str(s.get("Title") or "").strip().lower(): _resolve(s.get("Description"), refs)
                for s in info if isinstance(s, dict)}
    description = _clean_html(_resolve(core.get("FullDescription"), refs))
    h1 = _clean_html(_resolve((d.get("ProductH1TagsModel") or {}).get("h1_content"), refs))

    crumbs = [str(c.get("Name") or "").strip() for c in (d.get("Breadcrumb") or {}).get("CategoryBreadcrumb") or []]
    crumbs = [c for c in crumbs if c]
    leaf = str(core.get("BreadcrumbCategoryName") or d.get("SetType") or "").strip().title()
    if leaf and leaf.lower() not in (c.lower() for c in crumbs):
        crumbs.append(leaf)

    parts = [f"{item.get('Quantity') or 1} x {' '.join(str(item.get('ItemTitle') or item.get('SizeTag') or '').split())}"
             for item in d.get("ProductSetItemModel") or d.get("SofaItemsModel") or []
             if item.get("ItemTitle") or item.get("SizeTag")]
    return ScrapedProduct(
        source_url=url, name=str(core.get("ProductTitle") or "").strip(), sku=f"SRC-{product_id}",
        slug=urlsplit(url).path.rstrip("/").split("/")[-1].lower(), price=price,
        category_path=crumbs, short_desc=strip_tags(_resolve(core.get("ShortDescription"), refs)) or None,
        description_html=_compose_body(sections, description, h1),
        warranty=strip_tags(sections.get("warranty"))[:255] or None,
        specs=[("Set includes", ", ".join(parts))] if parts else [],
        images=_unique(p.get("ImageUrl") for p in d.get("PictureModel") or []),
        meta_title=core.get("MetaTitle"), meta_description=core.get("MetaDescription"),
        meta_keywords=core.get("MetaKeywords"),
    )


def _clean_html(html: str | None) -> str | None:
    if not html or not strip_tags(html):
        return None
    return sanitize_html(_IMG_TAG.sub("", html))


def _money(value: Any) -> Decimal | None:
    if value in (None, "", 0):
        return None
    try:
        return Decimal(str(value)).quantize(Decimal("0.01"))
    except ArithmeticError:
        return None


def _from_details(d: dict, configs: list, info: list, refs: dict[str, str], url: str) -> ScrapedProduct:
    price_model = d.get("product_price") or {}
    current = _money(price_model.get("price_with_discount_value")) or _money(price_model.get("price_value"))
    old = _money(price_model.get("old_price_value"))
    variants, materials, colors, sizes = _parse_configs(configs)
    if current is None:
        current = min((v.price for v in variants if v.price), default=None)
    if current is None:
        raise SkipProduct(f"No price on source (call for price): {url}")
    regular, sale = (old, current) if old and old > current else (current, None)

    sections = {str(s.get("Title") or "").strip().lower(): _resolve(s.get("Description"), refs) for s in info
                if isinstance(s, dict)}
    description = _clean_html(_resolve(d.get("full_description"), refs))
    h1 = _clean_html((d.get("product_h1_tags_model") or {}).get("h1_content"))
    body = _compose_body(sections, description, h1)

    crumbs =[c.get("name", "").strip() for c in (d.get("breadcrumb") or {}).get("category_breadcrumb") or []]
    crumbs = [c for c in crumbs if c]
    if d.get("breadcrumb_category_name"):
        leaf = str(d["breadcrumb_category_name"]).strip().title()
        if leaf and leaf.lower() not in (c.lower() for c in crumbs):
            crumbs.append(leaf)

    specs: list[tuple[str, str]] = []
    for group in (d.get("product_specification_model") or {}).get("groups") or []:
        for attr in group.get("attributes") or []:
            name = str(attr.get("name") or "").strip()
            values = ", ".join(strip_tags(str(v.get("value_raw") or v.get("name") or "")) for v in attr.get("values") or [])
            if name and values:
                specs.append((name, values))
    if materials:
        specs.append(("Material", ", ".join(materials)))
    if sizes:
        specs.append(("Dimensions", " / ".join(sizes)))
    if colors:
        specs.append(("Available colors", ", ".join(colors)))

    pictures = sorted(d.get("picture_models") or [], key=lambda p: p.get("display_order") or 0)
    images = _unique(p.get("full_size_image_url") or p.get("image_url") for p in pictures)
    dims = _unique(p.get("image_url") for p in sorted(d.get("dimension_picture_models") or [],
                                                      key=lambda p: p.get("display_order") or 0))
    slug = str(d.get("se_name") or "").rstrip("/").split("/")[-1] or urlsplit(url).path.rstrip("/").split("/")[-1]
    warranty = strip_tags(sections.get("warranty"))[:255] or None
    return ScrapedProduct(
        source_url=url, name=str(d["name"]).strip(), sku=str(d.get("sku") or f"SRC-{d.get('id')}").strip(),
        slug=slug.lower(), price=regular, sale_price=sale,
        in_stock=bool(d.get("in_stock", True)) and not d.get("display_discontinued_message"),
        category_path=crumbs, short_desc=strip_tags(_resolve(d.get("short_description"), refs)) or None,
        description_html=body, warranty=warranty, dimensions=sizes[0] if sizes else None, specs=specs,
        colors=colors, materials=materials, variants=variants, images=images, dimension_images=dims,
        meta_title=d.get("meta_title"), meta_description=d.get("meta_description"),
        meta_keywords=d.get("meta_keywords"),
    )


def _parse_configs(configs: list) -> tuple[list[ScrapedVariant], list[str], list[str], list[str]]:
    variants: list[ScrapedVariant] = []
    materials: list[str] = []
    colors: list[str] = []
    sizes: list[str] = []
    for material in configs if isinstance(configs, list) else []:
        if material.get("MaterialName"):
            materials.append(str(material["MaterialName"]).strip())
        for color in material.get("ColorModel") or []:
            color_name = (str(color.get("ColorName") or "").strip()) or None
            if color_name:
                colors.append(color_name)
            for size in color.get("SizeModels") or []:
                size_name = _size_label(size)
                if size_name:
                    sizes.append(size_name)
                mrp = _money(size.get("MRP"))
                if mrp is not None and size.get("DiscountPercentage"):
                    mrp = (mrp * (Decimal(100) - Decimal(str(size["DiscountPercentage"]))) / 100).quantize(Decimal("0.01"))
                variants.append(ScrapedVariant(color=color_name, size=size_name, sku=size.get("Sku"), price=mrp))
    return variants, _unique(materials), _unique(colors), _unique(sizes)


def _size_label(size: dict) -> str | None:
    name = str(size.get("SizeName") or "").strip()
    unit = str(size.get("UnitType") or "").strip()
    if not name and size.get("Length"):
        name = f"L{size.get('Length')} x W{size.get('Width')} x H{size.get('Height')}"
    if unit and name.lower().endswith(unit.lower()):
        unit = ""
    return f"{name} {unit}".strip() if name else None


def _unique(values: Any) -> list[str]:
    seen: dict[str, None] = {}
    for value in values:
        if value:
            seen[str(value).strip()] = None
    return list(seen)


# ---------- Fallback: plain HTML / JSON-LD ----------
def parse_product_dom(html: str, url: str) -> ScrapedProduct:
    tree = HTMLParser(html)
    ld = _json_ld_product(tree)
    name = (ld or {}).get("name") or _text(tree, "h1")
    if not name:
        raise ParseError(f"No product data found at {url}")
    offers = (ld or {}).get("offers") or {}
    if isinstance(offers, list):
        offers = offers[0] if offers else {}
    price = _money(offers.get("price")) or _money(_meta(tree, "product:price:amount"))
    if price is None:
        raise ParseError(f"No price found for {url}")
    images = ld.get("image") if ld else None
    images = [images] if isinstance(images, str) else list(images or [])
    if not images and _meta(tree, "og:image"):
        images = [_meta(tree, "og:image")]
    availability = str(offers.get("availability") or "InStock")
    slug = urlsplit(url).path.rstrip("/").split("/")[-1].lower()
    return ScrapedProduct(
        source_url=url, name=str(name).strip(), sku=str((ld or {}).get("sku") or f"SRC-{slug}"), slug=slug,
        price=price, in_stock="OutOfStock" not in availability,
        description_html=_clean_html((ld or {}).get("description") or _meta(tree, "og:description")),
        images=[str(i) for i in images], meta_title=_text(tree, "title"),
        meta_description=_meta(tree, "description"),
    )


def _json_ld_product(tree: HTMLParser) -> dict | None:
    for node in tree.css('script[type="application/ld+json"]'):
        try:
            data = json.loads(node.text() or "")
        except json.JSONDecodeError:
            continue
        for item in data if isinstance(data, list) else data.get("@graph", [data]):
            if isinstance(item, dict) and item.get("@type") in ("Product", ["Product"]):
                return item
    return None


def _text(tree: HTMLParser, selector: str) -> str | None:
    node = tree.css_first(selector)
    return node.text(strip=True) if node else None


def _meta(tree: HTMLParser, name: str) -> str | None:
    node = tree.css_first(f'meta[name="{name}"], meta[property="{name}"]')
    return node.attributes.get("content") if node else None
