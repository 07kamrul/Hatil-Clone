"""Known site settings (stored in the `settings` key/value table) and their defaults."""

from typing import Any

DEFAULT_MESSAGE_TEMPLATE = (
    "Hello {site_name}! I would like to order:\n\n{items}\n\nTotal: {total}\n\n"
    "Name: {name}\nPhone: {phone}\nAddress: {address}\nNote: {note}"
)

DEFAULT_SETTINGS: dict[str, Any] = {
    "site_name": "Casa Furnish",
    "tagline": "Furniture for every room",
    "logo_url": None,
    "favicon_url": None,
    "primary_color": "#8a5a2b",
    "accent_color": "#1f2937",
    "whatsapp_number": "8801700000000",
    "hotline": "+880 1700-000000",
    "contact_email": "hello@example.com",
    "address": "House 1, Road 1, Gulshan, Dhaka",
    "currency": "BDT",
    "currency_symbol": "৳",
    "message_template": DEFAULT_MESSAGE_TEMPLATE,
    "social_facebook": "",
    "social_instagram": "",
    "social_youtube": "",
    "social_linkedin": "",
    "footer_text": "Quality furniture, crafted for living.",
    "default_warranty": "1 year manufacturing warranty",
    "meta_description": "Browse modern furniture for living room, bedroom, dining and office. Order easily on WhatsApp.",
    "log_inquiries": True,
}

# Everything except internal flags is safe to expose to the public site.
PRIVATE_KEYS: frozenset[str] = frozenset()
