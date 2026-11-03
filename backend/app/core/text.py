import re
import unicodedata

import nh3

_SLUG_STRIP = re.compile(r"[^a-z0-9]+")

ALLOWED_TAGS = {
    "a", "b", "blockquote", "br", "em", "h2", "h3", "h4", "h5", "hr", "i", "img", "li",
    "ol", "p", "strong", "sub", "sup", "table", "tbody", "td", "th", "thead", "tr", "u", "ul",
    "figure", "figcaption",
}
ALLOWED_ATTRIBUTES = {
    "a": {"href", "title", "target"},
    "img": {"src", "alt", "title", "width", "height", "loading"},
    "td": {"colspan", "rowspan"},
    "th": {"colspan", "rowspan"},
}


def slugify(value: str, max_length: int = 200) -> str:
    normalized = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode("ascii")
    slug = _SLUG_STRIP.sub("-", normalized.lower()).strip("-")
    return slug[:max_length].rstrip("-") or "item"


def sanitize_html(html: str | None) -> str | None:
    """Strip scripts, event handlers, styles and unknown tags from admin/scraped rich text."""
    if html is None:
        return None
    return nh3.clean(
        html,
        tags=ALLOWED_TAGS,
        attributes=ALLOWED_ATTRIBUTES,
        url_schemes={"http", "https", "mailto", "tel"},
        link_rel="noopener noreferrer",
    ).strip()


def strip_tags(html: str | None) -> str:
    if not html:
        return ""
    text = nh3.clean(html, tags=set())
    return re.sub(r"\s+", " ", text).strip()


def rebrand(text: str | None, source_terms: list[str], replacement: str) -> str | None:
    """Replace source-brand mentions in imported content so the site never presents itself as that brand."""
    if not text:
        return text
    for term in sorted(source_terms, key=len, reverse=True):
        text = re.sub(rf"\b{re.escape(term)}\b", replacement, text)
    return text
