"""Business details for Sahat Al Ramlah Furniture L.L.C, taken from the company's Facebook page (fb_page/)."""

from app.core.enums import BannerPlacement

SITE_NAME = "Sahat Al Ramlah Furniture"
WHATSAPP = "+971 55 890 7793"

# Files in the saved Facebook page's "_files" folder that are worth importing (the rest are thumbnails).
IMAGE_FILES = {
    "cover": "781005514_122126251041250485_2750745764493504741_n(1).png",
    "kitchen_1": "786303480_122127041199250485_6160965778606711757_n(1).jpg",
    "kitchen_2": "789749348_122126943609250485_4626187451086362818_n(1).jpg",
    "kitchen_3": "810321609_122127953397250485_5124587589580632266_n.jpg",
}

SETTINGS = {
    "site_name": SITE_NAME,
    "tagline": "Comfort Meets Elegance",
    "primary_color": "#7a4f2a",
    "accent_color": "#2b1d14",
    "whatsapp_number": "971558907793",
    "hotline": WHATSAPP,
    "contact_email": "sahatalramlhafurniture@gmail.com",
    "address": "Sharjah Industrial Area-2, Sharjah, United Arab Emirates",
    "currency": "AED",
    "currency_symbol": "AED ",
    "social_facebook": "https://www.facebook.com/sahatalramlahfurniture",
    "social_instagram": "https://www.instagram.com/sahatalramlahfurniture",
    "footer_text": "Your Space. Your Style. Our Craftsmanship.",
    "default_warranty": "Workmanship guarantee on all custom furniture",
    "meta_description": (
        "Sahat Al Ramlah Furniture, Sharjah: premium and custom-made furniture, modular kitchens, "
        "upholstery & repair and ready-made curtains. Order easily on WhatsApp."
    ),
}

SERVICES = [
    ("Premium Furniture", "Finest materials and superior craftsmanship."),
    ("Custom Designs", "Tailored furniture made to match your style, space and requirements."),
    ("Custom Kitchens", "Modern, elegant kitchens with smart storage and customized finishes."),
    ("Upholstery & Repair", "Give your favourite pieces a new life."),
    ("Ready-Made Curtains", "Finishing touches for every room."),
]

ABOUT_HTML = (
    "<h2>Who we are</h2>"
    "<p><strong>Sahat Al Ramlah Furniture L.L.C</strong> is a furniture workshop and store in Sharjah Industrial "
    "Area-2, serving homes and businesses across Sharjah and the UAE. Comfort meets elegance in everything we make: "
    "premium furniture, timeless designs, made for you.</p>"
    "<h2>What we do</h2><ul>"
    + "".join(f"<li><strong>{name}</strong>: {text}</li>" for name, text in SERVICES)
    + "</ul>"
    "<h2>Why choose us</h2><ul>"
    "<li><strong>Premium quality</strong>: finest materials and superior craftsmanship.</li>"
    "<li><strong>Modern designs</strong>: stylish and functional for every space.</li>"
    "<li><strong>Durable &amp; reliable</strong>: built to last, made for comfort.</li>"
    "<li><strong>Custom made</strong>: tailored solutions just for you.</li>"
    "</ul>"
    "<h2>Get in touch</h2>"
    f"<p>WhatsApp: {WHATSAPP}<br>Email: sahatalramlhafurniture@gmail.com<br>"
    "Sharjah Industrial Area-2, Sharjah, UAE. We are always open.<br>"
    "We speak English, Arabic, Hindi and Urdu.</p>"
    "<p><em>Your Space. Your Style. Our Craftsmanship.</em></p>"
)

SHOWROOM = {
    "slug": "sharjah-industrial-area-2",
    "name": "Sahat Al Ramlah Furniture, Sharjah",
    "city": "Sharjah",
    "address": "Sharjah Industrial Area-2, Sharjah, United Arab Emirates",
    "phone": WHATSAPP,
    "email": "sahatalramlhafurniture@gmail.com",
    "opening_hours": "Open 24 hours",
    "off_days": None,
    "image_key": "cover",
}

BLOG_POST = {
    "slug": "transform-your-kitchen-into-a-beautiful-modern-space",
    "title": "Transform Your Kitchen into a Beautiful, Modern Space",
    "excerpt": (
        "Looking for a modern, elegant and functional kitchen designed specifically for your home? "
        "We create customized kitchen furniture to match your style, space and requirements."
    ),
    "body_html": (
        "<p>Looking for a modern, elegant and functional kitchen designed specifically for your home?</p>"
        "<p>At Sahat Al Ramlah Furniture L.L.C, we create customized furniture solutions designed to match your "
        "style, space and requirements.</p><ul>"
        "<li>Custom kitchen furniture</li><li>Modern &amp; elegant designs</li><li>Designed to suit your space</li>"
        "<li>Smart storage solutions</li><li>Professional furniture work</li><li>Customized finishes &amp; designs</li>"
        "</ul><p>Whether you're building a new kitchen or upgrading your existing one, let's create a kitchen "
        "you'll love every day.</p>"
        f"<p>WhatsApp: {WHATSAPP}<br>Sharjah, UAE</p><p><em>Your Space. Your Style. Our Craftsmanship.</em></p>"
    ),
    "tags": "kitchen, custom furniture, modular kitchen, sharjah",
    "author": SITE_NAME,
    "image_key": "kitchen_1",
}

# (title, subtitle, link, button, placement, image key)
BANNERS = [
    ("Comfort Meets Elegance", "Premium furniture, timeless designs, made for you in Sharjah",
     "/products", "Shop now", BannerPlacement.HERO, "cover"),
    ("Custom Kitchens", "Modern kitchens designed to suit your space", f"/blog/{BLOG_POST['slug']}",
     "Learn more", BannerPlacement.OFFER, "kitchen_2"),
    ("Made to Measure", "Tailored furniture solutions just for you", "/contact",
     "Talk to us", BannerPlacement.OFFER, "kitchen_3"),
]

# (question, answer, show on home)
FAQS = [
    ("What do you offer?",
     "<p>Premium and custom-made furniture, custom kitchens, upholstery &amp; repair, and ready-made curtains.</p>",
     True),
    ("Can you make furniture to my measurements?",
     "<p>Yes. Every piece can be customized to your space, style and finish. Send us your size and idea on "
     "WhatsApp.</p>", True),
    ("Where are you located?",
     "<p>Sharjah Industrial Area-2, Sharjah, United Arab Emirates. We serve customers across Sharjah and the "
     "UAE.</p>", True),
    ("What are your opening hours?", "<p>We are always open. Message us on WhatsApp any time.</p>", False),
    ("How do I order?",
     f"<p>Add items to your cart and send the order on WhatsApp ({WHATSAPP}), or message us directly for a "
     "custom quote.</p>", True),
    ("Which languages do you speak?", "<p>English, Arabic, Hindi and Urdu.</p>", False),
]
