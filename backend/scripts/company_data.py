"""Business details for Sahat Al Ramlah Furniture L.L.C, taken from the company's Facebook page (facebook/)."""

from app.core.enums import BannerPlacement

SITE_NAME = "Sahat Al Ramlah Furniture"
WHATSAPP = "+971 55 890 7793"

# Files in the saved Facebook page's "Facebook_files" folder that are imported into the app.
IMAGE_FILES = {
    "logo": "629186609_122099387583250485_6411131285055198811_n.jpg",
    "cover": "781005514_122126251041250485_2750745764493504741_n(1).png",
    "offer": "788822264_122126635119250485_3449045889436085817_n.jpg",
    "kitchen_u_cream": "810321609_122127953397250485_5124587589580632266_n.jpg",
    "kitchen_l_glass": "786303480_122127041199250485_6160965778606711757_n.jpg",
    "kitchen_l_taupe": "789749348_122126943609250485_4626187451086362818_n.jpg",
    "kitchen_u_shelves": "786139591_122126715183250485_6911232816870511498_n.jpg",
    "kitchen_island": "782345230_122126514585250485_6665951978642650874_n.jpg",
    "kitchen_bar": "784240296_122126461665250485_8648184235059131264_n.jpg",
    "tv_collage": "784197759_122126514309250485_1005561084675385942_n.jpg",
    "tv_mirror": "629664509_2967887166753749_4803646788316152915_n.jpg",
    "office_executive": "779996035_122126639865250485_6918875746603807789_n.jpg",
    "office_reception": "626977396_122099311203250485_6155251942523290368_n.jpg",
}

# Images cut out of a larger source image: key -> (source key, (left, top, right, bottom) as fractions).
IMAGE_CROPS = {
    "tv_1": ("tv_collage", (0.0, 0.0, 0.5, 0.5)),
    "tv_2": ("tv_collage", (0.5, 0.0, 1.0, 0.5)),
    "tv_3": ("tv_collage", (0.0, 0.5, 0.5, 1.0)),
    "tv_4": ("tv_collage", (0.5, 0.5, 1.0, 1.0)),
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
    "image_key": "kitchen_island",
    "gallery_keys": ["kitchen_u_cream", "kitchen_l_glass", "kitchen_l_taupe", "kitchen_u_shelves",
                     "kitchen_island", "kitchen_bar"],
}

# (title, subtitle, link, button, placement, image key)
BANNERS = [
    # The cover photo is finished artwork with its own text, so the hero banner has no overlay title.
    ("", None, "/products", "Shop now", BannerPlacement.HERO, "cover"),
    ("Custom Kitchens", "Modern kitchens designed to suit your space", f"/blog/{BLOG_POST['slug']}",
     "Learn more", BannerPlacement.OFFER, "kitchen_u_shelves"),
    ("Made to Measure", "Tailored furniture solutions just for you", "/contact",
     "Talk to us", BannerPlacement.OFFER, "tv_mirror"),
    ("10% Off on All Orders", "Special offer: quality you can see, comfort you can feel",
     "/products", "Shop now", BannerPlacement.OFFER, "offer"),
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

# (slug, name, description, image key)
CATEGORIES = [
    ("kitchen-cabinets", "Kitchen Cabinets",
     "Custom modular kitchens in L-shape, U-shape and island layouts, with smart storage, glass display units "
     "and finishes made to suit your space.", "kitchen_u_cream"),
    ("tv-units-wall-panels", "TV Units & Wall Panels",
     "Floating TV units, marble-look feature walls and slatted wood panels with integrated lighting and shelving.",
     "tv_1"),
    ("office-furniture", "Office Furniture",
     "Executive office suites and reception counters, tailored to your premises.", "office_executive"),
]

MADE_TO_ORDER = (
    "Made to order in our Sharjah workshop and tailored to your measurements, finish and colour. "
    f"Message us on WhatsApp ({WHATSAPP}) for a quote."
)

# (sku, name, category slug, image key, short description)
PRODUCTS = [
    ("SAR-KIT-001", "Cream U-Shaped Kitchen with Glass Display", "kitchen-cabinets", "kitchen_u_cream",
     "Glossy cream U-shaped kitchen with a glass display column, built-in oven and a window-facing sink."),
    ("SAR-KIT-002", "Beige L-Shaped Kitchen with Glass Display Tower", "kitchen-cabinets", "kitchen_l_glass",
     "L-shaped kitchen in glossy beige with a lit glass display tower, built-in oven and marble backsplash."),
    ("SAR-KIT-003", "Taupe L-Shaped Kitchen with Pull-Out Baskets", "kitchen-cabinets", "kitchen_l_taupe",
     "Taupe L-shaped kitchen with lit display shelves, pull-out basket storage and under-cabinet lighting."),
    ("SAR-KIT-004", "Modern U-Shaped Kitchen with Open Shelves", "kitchen-cabinets", "kitchen_u_shelves",
     "Cream and oak U-shaped kitchen with lit open shelves, marble backsplash and a tall fridge bay."),
    ("SAR-KIT-005", "Marble Island Kitchen", "kitchen-cabinets", "kitchen_island",
     "Open kitchen in taupe with a marble-topped island, bar seating and warm LED lighting."),
    ("SAR-KIT-006", "Kitchen with Wood-Slat Bar Counter", "kitchen-cabinets", "kitchen_bar",
     "Cream kitchen with lit display cabinets and a marble bar counter fronted with wood slats."),
    ("SAR-TV-001", "Floating TV Unit with Marble Panel and Glass Display", "tv-units-wall-panels", "tv_1",
     "Wall-mounted TV unit on a marble panel with slatted wood, shelving and a glass display cabinet."),
    ("SAR-TV-002", "Marble-Look Feature Wall TV Unit", "tv-units-wall-panels", "tv_2",
     "Large marble-look feature wall with a floating white console and integrated display shelving."),
    ("SAR-TV-003", "Slatted Wood TV Wall with Marble Panel", "tv-units-wall-panels", "tv_3",
     "Wood-slat TV wall with a marble backdrop, warm lighting and a floating shelf."),
    ("SAR-TV-004", "TV Wall with Marble Backdrop and Shelving", "tv-units-wall-panels", "tv_4",
     "Wood-framed TV wall with a marble-look backdrop and built-in display shelves."),
    ("SAR-TV-005", "Slatted TV Wall with Backlit Mirror", "tv-units-wall-panels", "tv_mirror",
     "Dark slatted TV wall with floating shelves, a stone-look console and an organic backlit mirror."),
    ("SAR-OFF-001", "Executive Office Suite", "office-furniture", "office_executive",
     "Executive desk, wall-length credenza, wood-panelled backdrop and leather lounge seating."),
    ("SAR-OFF-002", "Reception Counter with Slatted Front", "office-furniture", "office_reception",
     "Curved reception counter with a wood-slat front, laminate top and a decorative 3D wall panel."),
]

# Facebook posts: (slug, title, excerpt, tags, published at, cover key, image keys shown in the post)
POSTS = [
    ("special-offer-10-percent-off-on-all-orders", "Special Offer: 10% Off on All Orders",
     "Quality you can see, comfort you can feel. Custom furniture, kitchen cabinets, wardrobes, office furniture "
     "and interior design solutions.", "offer, special offer, furniture", "2026-02-08T10:00:00+00:00",
     "offer", ["offer"]),
    ("our-kitchen-designs", "Our Kitchen Designs",
     "Modern L-shaped, U-shaped and island kitchens built to measure in Sharjah.",
     "kitchen, kitchen cabinets, custom furniture", "2026-02-08T09:00:00+00:00", "kitchen_l_glass",
     ["kitchen_u_cream", "kitchen_l_glass", "kitchen_l_taupe", "kitchen_u_shelves", "kitchen_island",
      "kitchen_bar"]),
    ("tv-units-and-wall-panels", "TV Units and Feature Wall Panels",
     "Marble-look and slatted wood TV walls with lighting and shelving.",
     "tv unit, wall panel, interior", "2026-02-07T10:00:00+00:00", "tv_mirror",
     ["tv_1", "tv_2", "tv_3", "tv_4", "tv_mirror"]),
    ("office-and-reception-furniture", "Office and Reception Furniture",
     "Executive offices and reception counters made to fit your premises.",
     "office furniture, reception", "2026-02-07T09:00:00+00:00", "office_executive",
     ["office_executive", "office_reception"]),
]
