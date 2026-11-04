"""Pure parsers for the non-product content (showrooms, banners, static pages, FAQs, blog posts).

No I/O here: every function takes page HTML (plus its URL) and returns dataclasses. Images stay as
source URLs; `content_import.py` downloads them through the shared storage service. The homepage and
static pages are Next.js flight pages (see parsers.py); the blog is a separate WordPress site with a
Yoast JSON-LD graph and the body rendered in the DOM.
"""

import json
import re
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlsplit

from selectolax.lexbor import LexborHTMLParser as HTMLParser

from scraper.parsers import extract_flight, find_json

# Static pages worth importing, taken from the sitemap's "other" URLs (docs/HANDOFF.md).
PAGE_SLUGS = (
    "about-hatil", "company-profile", "contact-us", "faq", "help-center", "hatil-policies",
    "privacy-policy", "return-policy", "billing-terms-and-conditions", "our-team",
    "license-certificates", "become-franchise-partner",
)
BANNER_PROMO_TYPES = ("ImageGallery",)  # Type prefix for promo tiles; "MenuSlider" means hero slides


class ContentParseError(ValueError):
    pass


@dataclass
class ScrapedShowroom:
    slug: str
    name: str
    address: str
    city: str
    phone: str | None = None
    latitude: float | None = None
    longitude: float | None = None
    off_days: str | None = None
    opening_hours: str | None = None
    image: str | None = None


@dataclass
class ScrapedBanner:
    placement: str  # "hero" or "promo" (BannerPlacement values)
    title: str
    subtitle: str | None = None
    link_url: str | None = None
    image: str = ""
    sort_order: int = 0


@dataclass
class ScrapedPage:
    slug: str
    title: str
    body_html: str
    meta_title: str | None = None
    meta_description: str | None = None


@dataclass
class ScrapedFaq:
    question: str
    answer_html: str


@dataclass
class ScrapedBlogPost:
    slug: str
    title: str
    body_html: str
    excerpt: str | None = None
    cover_image: str | None = None
    author: str | None = None
    tags: list[str] = field(default_factory=list)
    published_at: datetime | None = None
    meta_title: str | None = None
    meta_description: str | None = None


def classify_content_url(url: str) -> str | None:
    """Map a sitemap URL to a content kind: showroom, page, blog, home (banners) — or None."""
    path = urlsplit(url).path.rstrip("/")
    segments = [s for s in path.split("/") if s]
    if not segments:
        return "home"
    if segments[0] in ("showrooms", "showroom") and len(segments) >= 2:
        return "showroom"
    if segments[0] == "blog" and len(segments) >= 2:
        return "blog"
    if len(segments) == 1 and segments[0] in PAGE_SLUGS:
        return "page"
    return None


def find_json_all(flight: str, key: str) -> list[Any]:
    """Every JSON value whose key matches, in order — unlike parsers.find_json, which returns one."""
    marker = f'"{key}":'
    values: list[Any] = []
    index = flight.find(marker)
    decoder = json.JSONDecoder()
    while index != -1:
        start = index + len(marker)
        while start < len(flight) and flight[start].isspace():
            start += 1
        try:
            value, end = decoder.raw_decode(flight, start)
        except json.JSONDecodeError:
            end = start
        else:
            values.append(value)
        index = flight.find(marker, max(end, start))
    return values


def _slug_of(url: str) -> str:
    path = urlsplit(url).path.rstrip("/")
    return [s for s in path.split("/") if s][-1].lower()


def _inner_html(node: Any) -> str:
    html = getattr(node, "inner_html", None) or node.html or ""
    match = re.match(rf"<{node.tag}[^>]*>(.*)</{node.tag}\s*>$", html, re.S)
    return match.group(1) if match else html


# ---------- showrooms ----------
def parse_showroom(html: str, url: str) -> ScrapedShowroom:
    flight = extract_flight(html)
    info = (find_json(flight, "showroomInfo") or {}) if flight else {}
    name = info.get("Name") or _dom_text(html, "h1")
    if not name:
        raise ContentParseError(f"No showroom data found at {url}")
    address = " ".join(str(part) for part in (info.get("Address"), info.get("Division")) if part) or "-"
    locality = _json_ld_locality(html)
    return ScrapedShowroom(
        slug=_slug_of(url), name=str(name).strip(), address=address,
        city=locality or info.get("Division") or "Dhaka",
        phone=info.get("Mobile") or _json_ld_phone(html),
        latitude=info.get("Latitude"), longitude=info.get("Longitude"),
        off_days=info.get("OffDays"), opening_hours=info.get("VisitingHours"),
    )


def _json_ld_locality(html: str) -> str | None:
    for node in _json_ld_nodes(html):
        address = node.get("address") or {}
        if isinstance(address, dict) and address.get("addressLocality"):
            return str(address["addressLocality"])
    return None


def _json_ld_phone(html: str) -> str | None:
    for node in _json_ld_nodes(html):
        if node.get("telephone"):
            return str(node["telephone"])
    return None


# ---------- banners (homepage) ----------
def parse_banners(html: str) -> list[ScrapedBanner]:
    flight = extract_flight(html)
    banners: list[ScrapedBanner] = []
    for card in find_json_all(flight, "homePageCard"):
        if not isinstance(card, dict):
            continue
        card_type = str(card.get("Type") or "")
        if not any(card_type.startswith(prefix) for prefix in (*BANNER_PROMO_TYPES, "MenuSlider")):
            continue
        placement = "hero" if card_type == "MenuSlider" else "promo"
        for image in card.get("HomePageCardImages") or []:
            if not image.get("ImageUrl"):
                continue
            banners.append(ScrapedBanner(
                placement=placement, title=image.get("Title") or card.get("Title") or "Banner",
                subtitle=image.get("Description"), link_url=image.get("UrlLink"),
                image=image["ImageUrl"], sort_order=image.get("DisplayOrder") or len(banners),
            ))
    return banners


# ---------- static pages ----------
def parse_page(html: str, url: str) -> ScrapedPage:
    tree = HTMLParser(html)
    main = tree.css_first("main")
    body = _inner_html(main) if main else ""
    title = (_dom_text(html, "main h1") or _dom_text(html, "main h2") or _dom_text(html, "h1"))
    if not body.strip() and not title:
        raise ContentParseError(f"No page content found at {url}")
    raw_title = tree.css_first("title").text(strip=True) if tree.css_first("title") else None
    return ScrapedPage(
        slug=_slug_of(url), title=title or (raw_title or "Page").split("|")[0].strip(),
        body_html=body.strip(), meta_title=raw_title, meta_description=_meta(tree, "description"),
    )


def parse_faqs(html: str) -> list[ScrapedFaq]:
    faqs: list[ScrapedFaq] = []
    for item in HTMLParser(html).css(".accordion-item"):
        question = _first_text(item, "h5, .accordion-header")
        if not question:
            continue
        content = item.css_first(".accordion-content") or item
        answer = "".join(_inner_html(p) for p in content.css("p"))
        faqs.append(ScrapedFaq(question=question.strip(), answer_html=answer))
    return faqs


# ---------- blog (WordPress) ----------
def parse_blog_post(html: str, url: str) -> ScrapedBlogPost:
    tree = HTMLParser(html)
    posting = _json_ld_of_type(_json_ld_nodes(html), "BlogPosting")
    headline = (posting or {}).get("headline") or _dom_text(html, "h1")
    entry = tree.css_first(".entry-content")
    if not headline or entry is None:
        raise ContentParseError(f"No blog post data found at {url}")
    published = (posting or {}).get("datePublished")
    image = (posting or {}).get("image")
    if isinstance(image, dict):
        image = image.get("url") or image.get("@id")  # Yoast emits {"@id": url} for the featured image
    elif isinstance(image, list):
        image = next((str(i.get("url") or i.get("@id") if isinstance(i, dict) else i) for i in image if i), None)
    return ScrapedBlogPost(
        slug=_slug_of(url), title=headline.strip(), body_html=_inner_html(entry).strip(),
        excerpt=_meta(tree, "og:description"), cover_image=image or _meta(tree, "og:image"),
        author=(posting or {}).get("author", {}).get("name"),
        tags=[a.text(strip=True) for a in tree.css(".post-categories a") if a.text(strip=True)],
        published_at=_parse_dt(published), meta_title=_meta(tree, "og:title"),
        meta_description=_meta(tree, "og:description"),
    )


def _parse_dt(value: Any) -> datetime | None:
    if not value:
        return None
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except ValueError:
        return None
    return parsed.astimezone(UTC) if parsed.tzinfo else parsed.replace(tzinfo=UTC)


# ---------- DOM / JSON-LD helpers ----------
def _json_ld_nodes(html: str) -> list[dict]:
    nodes: list[dict] = []
    for script in HTMLParser(html).css('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.text() or "")
        except json.JSONDecodeError:
            continue
        for item in data if isinstance(data, list) else data.get("@graph", [data]):
            if isinstance(item, dict):
                nodes.append(item)
    return nodes


def _json_ld_of_type(nodes: list[dict], wanted: str) -> dict | None:
    return next((n for n in nodes if wanted in (n.get("@type") if isinstance(n.get("@type"), str)
                                                 else (n.get("@type") or [""])[0:1])), None)


def _dom_text(html: str, selector: str) -> str | None:
    node = HTMLParser(html).css_first(selector)
    return node.text(strip=True) or None if node else None


def _first_text(tree: Any, selector: str) -> str | None:
    node = tree.css_first(selector)
    return node.text(strip=True) or None if node else None


def _meta(tree: Any, name: str) -> str | None:
    node = tree.css_first(f'meta[name="{name}"], meta[property="{name}"]')
    return node.attributes.get("content") if node else None
