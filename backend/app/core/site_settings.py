"""Known site settings (stored in the `settings` key/value table) and their defaults."""

from typing import Any

DEFAULT_MESSAGE_TEMPLATE = (
    "Hello {site_name}! I would like to order:\n\n{items}\n\nTotal: {total}\n\n"
    "Name: {name}\nPhone: {phone}\nAddress: {address}\nNote: {note}"
)

DEFAULT_SETTINGS: dict[str, Any] = {
    "site_name": "Sahat Al Ramlah Furniture",
    "tagline": "Comfort Meets Elegance",
    "logo_url": None,
    "favicon_url": None,
    "primary_color": "#8a5a2b",
    "accent_color": "#1f2937",
    "whatsapp_number": "971558907793",
    "hotline": "+971 55 890 7793",
    "contact_email": "sahatalramlhafurniture@gmail.com",
    "address": "Sharjah Industrial Area-2, Sharjah, United Arab Emirates",
    "map_lat": 25.3216,
    "map_lng": 55.4018,
    "map_zoom": 15,
    "map_link": "",
    "currency": "AED",
    "currency_symbol": "AED ",
    "message_template": DEFAULT_MESSAGE_TEMPLATE,
    "social_facebook": "https://www.facebook.com/sahatalramlahfurniture",
    "social_instagram": "",
    "social_youtube": "",
    "social_linkedin": "",
    "footer_text": "Your Space. Your Style. Our Craftsmanship.",
    "default_warranty": "1 year manufacturing warranty",
    "meta_description": "Browse modern furniture for living room, bedroom, dining and office. Order easily on WhatsApp.",
    "log_inquiries": True,
}

# Everything except internal flags is safe to expose to the public site.
PRIVATE_KEYS: frozenset[str] = frozenset()
