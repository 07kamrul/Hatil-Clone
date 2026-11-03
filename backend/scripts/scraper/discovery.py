"""URL discovery: sitemaps (incl. sitemap indexes) and category-page link extraction."""

import re
from urllib.parse import urljoin, urlsplit

from selectolax.lexbor import LexborHTMLParser as HTMLParser

from scraper.config import ScraperConfig

_LOC = re.compile(r"<(?:\w+:)?loc>\s*([^<\s]+)\s*</(?:\w+:)?loc>", re.I)
_SITEMAP_INDEX = re.compile(r"<(?:\w+:)?sitemapindex", re.I)
_SLUG_SEGMENT = re.compile(r"^[A-Za-z0-9][A-Za-z0-9\-_.%]*$")


def parse_sitemap(xml: str) -> tuple[list[str], list[str]]:
    """Returns (page_urls, child_sitemap_urls)."""
    locs = [loc.replace("&amp;", "&").strip() for loc in _LOC.findall(xml)]
    if _SITEMAP_INDEX.search(xml):
        return [], locs
    return locs, []


def classify_url(url: str, config: ScraperConfig) -> str:
    """product | category | blog | showroom | other — based on the source site's URL scheme."""
    path = urlsplit(url).path.strip("/")
    if not path:
        return "other"
    segments = path.split("/")
    first = segments[0].lower()
    if first == "blog":
        return "blog"
    if first in ("showrooms", "showroom"):
        return "showroom"
    if len(segments) == 2 and first not in config.non_product_prefixes and _SLUG_SEGMENT.match(segments[1]):
        return "product"
    if len(segments) == 1 and first.endswith("-price-in-bangladesh"):
        return "category"
    return "other"


def category_slug_of(url: str) -> str | None:
    """Category segment of a product URL (`/sofa/aria-1` → `sofa`); `content/...` products have none."""
    segments = urlsplit(url).path.strip("/").split("/")
    if len(segments) == 2 and segments[0].lower() != "content":
        return segments[0].lower()
    return None


def extract_product_links(html: str, page_url: str, config: ScraperConfig) -> list[str]:
    """Product links on a category page (used in addition to the sitemap)."""
    tree = HTMLParser(html)
    host = urlsplit(page_url).netloc
    found: dict[str, None] = {}
    for node in tree.css("a[href]"):
        href = (node.attributes.get("href") or "").strip()
        if not href or href.startswith(("#", "mailto:", "tel:", "javascript:")):
            continue
        absolute = urljoin(page_url, href).split("#")[0].split("?")[0]
        if urlsplit(absolute).netloc != host:
            continue
        if classify_url(absolute, config) == "product":
            found[absolute] = None
    return list(found)


def next_page_url(html: str, page_url: str) -> str | None:
    tree = HTMLParser(html)
    link = tree.css_first('a[rel="next"], link[rel="next"]')
    href = link.attributes.get("href") if link else None
    return urljoin(page_url, href) if href else None
