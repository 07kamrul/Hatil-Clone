"""Static seed content. Neutral, original copy — safe to ship."""

CATEGORY_TREE: list[tuple[str, list[tuple[str, list[str]]]]] = [
    ("Living Room", [
        ("Sofa Set", ["Fabric Sofa", "Wooden Sofa", "L-Shaped Sofa"]),
        ("Center Table", []),
        ("Divan", []),
        ("TV Cabinet", []),
        ("Shoe Rack", []),
        ("Accent Chair", []),
    ]),
    ("Bedroom", [
        ("Bed", ["King Size Bed", "Queen Size Bed"]),
        ("Wardrobe", []),
        ("Dressing Table", []),
        ("Bed-Side Table", []),
        ("Mattress", []),
    ]),
    ("Dining", [
        ("Dining Table Set", []),
        ("Dining Chair", []),
        ("Showcase", []),
    ]),
    ("Office", [
        ("Executive Table", []),
        ("Swivel Chair", []),
        ("Conference Table", []),
        ("File Cabinet", []),
    ]),
    ("Kids Room", [
        ("Bunk Bed", []),
        ("Study Table", []),
    ]),
]

ROOMS = ["Living Room", "Bedroom", "Dining Room", "Office", "Kids Room"]

COLORS = [
    ("Walnut", "#5d4037"), ("Natural Oak", "#c8a165"), ("Espresso", "#3e2723"), ("White", "#ffffff"),
    ("Grey", "#9e9e9e"), ("Black", "#111111"), ("Beige", "#d7c4a3"), ("Navy", "#1e3a5f"),
]

MATERIALS = ["Solid Wood", "Engineered Wood", "Fabric", "Leather", "Glass", "Metal", "Marble"]

_LOREM = (
    "<p>We design furniture that is built to last and made to be lived with. Every piece is checked by "
    "hand before it leaves our workshop.</p>"
)

PAGES: list[tuple[str, str, str]] = [
    ("About Us", "about", "<h2>Who we are</h2>" + _LOREM +
     "<p>From living rooms to offices, our collection covers every space of a modern home.</p>"),
    ("Contact", "contact", "<p>Reach us by phone, WhatsApp or the contact form. Our team replies within one working day.</p>"),
    ("Careers", "careers", "<h2>Work with us</h2><p>We are always looking for designers, craftspeople and sales "
     "associates. Send your CV through the contact form with the subject \"Careers\".</p>"),
    ("FAQ", "faq", "<p>Answers to the questions we hear most often.</p>"),
    ("Warranty", "warranty", "<h2>Warranty policy</h2><ul><li>1 year warranty against manufacturing defects.</li>"
     "<li>Warranty does not cover misuse, water damage or normal wear.</li>"
     "<li>Contact us with your order details to make a claim.</li></ul>"),
    ("Privacy Policy", "privacy", "<h2>Your privacy</h2><p>We do not require accounts. Your cart, wishlist and "
     "recently viewed items are stored only in your browser. Messages you send through the contact form are "
     "used only to reply to you.</p>"),
    ("Terms & Conditions", "terms", "<h2>Terms</h2><p>Prices and availability are subject to change. Orders are "
     "confirmed by our team on WhatsApp before delivery.</p>"),
]

FAQS: list[tuple[str, str, str, bool]] = [
    ("How do I place an order?", "<p>Add products to your cart and tap <strong>Checkout via WhatsApp</strong>. "
     "We confirm price, delivery date and payment with you in the chat.</p>", "Ordering", True),
    ("Do I need an account?", "<p>No. You can browse, save a wishlist and order without signing up.</p>", "Ordering", True),
    ("Do you deliver outside the city?", "<p>Yes, we deliver nationwide. Delivery charges depend on location.</p>", "Delivery", True),
    ("What payment methods do you accept?", "<p>Cash on delivery, bank transfer and mobile banking.</p>", "Payment", True),
    ("Can I see the furniture before buying?", "<p>Visit any of our showrooms — see the Showrooms page for addresses and hours.</p>", "General", False),
    ("What does the warranty cover?", "<p>Manufacturing defects for one year. See the Warranty page for details.</p>", "Warranty", False),
]

SHOWROOMS: list[dict[str, object]] = [
    {"name": "Gulshan Flagship", "city": "Dhaka", "address": "Road 45, Gulshan 2, Dhaka", "phone": "+8801700000001",
     "opening_hours": "10:00 AM – 8:00 PM", "off_days": "Friday", "latitude": 23.7937, "longitude": 90.4146},
    {"name": "Dhanmondi", "city": "Dhaka", "address": "Road 27, Dhanmondi, Dhaka", "phone": "+8801700000002",
     "opening_hours": "10:00 AM – 8:00 PM", "off_days": "Friday", "latitude": 23.7461, "longitude": 90.3742},
    {"name": "Agrabad", "city": "Chattogram", "address": "Agrabad C/A, Chattogram", "phone": "+8801700000003",
     "opening_hours": "10:30 AM – 8:00 PM", "off_days": "Friday", "latitude": 22.3294, "longitude": 91.8012},
    {"name": "Zindabazar", "city": "Sylhet", "address": "Zindabazar, Sylhet", "phone": "+8801700000004",
     "opening_hours": "10:00 AM – 7:30 PM", "off_days": "Friday", "latitude": 24.8949, "longitude": 91.8687},
    {"name": "Shaheb Bazar", "city": "Rajshahi", "address": "Shaheb Bazar, Rajshahi", "phone": "+8801700000005",
     "opening_hours": "10:00 AM – 7:30 PM", "off_days": "Friday", "latitude": 24.3636, "longitude": 88.6241},
]

BLOG_POSTS: list[tuple[str, str, str]] = [
    ("5 Ways to Make a Small Living Room Feel Bigger",
     "Light colours, multi-purpose furniture and smart storage go a long way.",
     "<p>Small rooms can feel open and calm with a few simple choices.</p><h2>1. Choose light tones</h2>"
     "<p>Light upholstery and natural oak finishes reflect light.</p><h2>2. Raise furniture off the floor</h2>"
     "<p>Sofas and cabinets with legs show more floor and feel lighter.</p><h2>3. Use storage that doubles up</h2>"
     "<p>A center table with drawers or a divan with storage keeps clutter away.</p>"
     "<h2>4. Mirror the light</h2><p>A large mirror opposite a window doubles daylight.</p>"
     "<h2>5. Keep pathways clear</h2><p>Leave at least 75 cm between pieces for easy movement.</p>"),
    ("How to Care for Solid Wood Furniture",
     "Simple habits that keep wooden furniture looking new for years.",
     "<p>Solid wood ages beautifully with the right care.</p><ul><li>Dust weekly with a soft dry cloth.</li>"
     "<li>Wipe spills immediately.</li><li>Keep pieces out of direct sunlight.</li>"
     "<li>Polish twice a year with a wax made for lacquered finishes.</li></ul>"),
    ("Choosing the Right Dining Table Size",
     "Measure your room and count your guests before you buy.",
     "<p>Allow about 60 cm of table edge per person and 90 cm of clearance around the table.</p>"
     "<p>A 4-seater fits rooms from 2.7 m × 2.7 m; a 6-seater needs roughly 3 m × 3.6 m.</p>"),
]

# (name, category name, price, sale price or None, colors, materials, rooms, featured, best seller)
DEMO_PRODUCTS: list[tuple[str, str, int, int | None, list[str], list[str], list[str], bool, bool]] = [
    ("Aria 3-Seater Fabric Sofa", "Fabric Sofa", 68500, 61900, ["Grey", "Beige", "Navy"], ["Fabric", "Solid Wood"], ["Living Room"], True, True),
    ("Oslo Wooden Sofa Set", "Wooden Sofa", 92000, None, ["Walnut", "Natural Oak"], ["Solid Wood", "Fabric"], ["Living Room"], True, False),
    ("Corner L-Shaped Sofa", "L-Shaped Sofa", 115000, 104000, ["Grey", "Black"], ["Fabric", "Engineered Wood"], ["Living Room"], False, True),
    ("Nesta Glass Center Table", "Center Table", 18500, None, ["Walnut", "Black"], ["Glass", "Solid Wood"], ["Living Room"], True, False),
    ("Linea TV Cabinet", "TV Cabinet", 24900, 22500, ["Espresso", "White"], ["Engineered Wood"], ["Living Room"], False, True),
    ("Haven King Size Bed", "King Size Bed", 78000, None, ["Walnut", "Espresso"], ["Solid Wood"], ["Bedroom"], True, True),
    ("Luna Queen Bed with Storage", "Queen Size Bed", 64000, 59500, ["Natural Oak", "White"], ["Engineered Wood"], ["Bedroom"], False, False),
    ("Stella 3-Door Wardrobe", "Wardrobe", 55000, None, ["Walnut", "White"], ["Solid Wood", "Glass"], ["Bedroom"], True, False),
    ("Mira Dressing Table", "Dressing Table", 29500, 26900, ["White", "Natural Oak"], ["Engineered Wood", "Glass"], ["Bedroom"], False, True),
    ("Terra 6-Seater Dining Set", "Dining Table Set", 98000, 89000, ["Walnut", "Natural Oak"], ["Solid Wood", "Marble"], ["Dining Room"], True, True),
    ("Cleo Dining Chair", "Dining Chair", 7900, None, ["Beige", "Grey"], ["Solid Wood", "Fabric"], ["Dining Room"], False, False),
    ("Atlas Executive Table", "Executive Table", 45000, None, ["Espresso", "Black"], ["Engineered Wood", "Metal"], ["Office"], False, True),
    ("Ergo Swivel Chair", "Swivel Chair", 16500, 14900, ["Black", "Grey"], ["Leather", "Metal"], ["Office"], True, False),
    ("Junior Bunk Bed", "Bunk Bed", 52000, None, ["White", "Natural Oak"], ["Solid Wood"], ["Kids Room"], False, False),
]

HERO_BANNERS: list[tuple[str, str, str, str]] = [
    ("Living, refined", "New season sofas and center tables", "/category/living-room", "Shop living room"),
    ("Sleep better", "Beds and wardrobes built to last", "/category/bedroom", "Explore bedroom"),
    ("Gather around", "Dining sets for every family size", "/category/dining", "View dining"),
]
OFFER_BANNERS: list[tuple[str, str, str, str]] = [
    ("Up to 15% off sofas", "Limited time offer", "/category/sofa-set", "Shop now"),
    ("Office essentials", "Desks and chairs for productive days", "/category/office", "Browse office"),
]
