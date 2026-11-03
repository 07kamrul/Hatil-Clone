# Source Site Analysis — hatil.com

Captured 2026-11-03 from `robots.txt`, `sitemap.xml` (2,027 URLs) and sampled home, category,
product and showroom pages. This document is the UI source of truth for the clone. **Only the
structure/UX is reproduced; all content is replaceable and the shipped brand is neutral.**

## Technology observed
- Next.js App Router front end (RSC flight payload in `self.__next_f.push`), backed by a nopCommerce API.
  Product data is fully embedded in product pages as JSON (`productDetails`).
- Category product grids are hydrated client-side (server payload `catalog_products_model.products` is empty),
  so product discovery relies on the sitemap, with category-page links as a fallback.
- Images on S3, mostly `.webp`. Currency: BDT. Sale price = `old_price` + `price`.

## robots.txt
```
Allow: /
Disallow: /?orderBy=  /view-cart  /checkout  /search-result/  /?s=  /?utm_source=
```
The scraper obeys these (product, category, showroom and blog pages are allowed).

## URL / page types (sitemap breakdown)
| Pattern | Count | Page type |
|---|---|---|
| `/` | 1 | Home |
| `/{slug}-price-in-bangladesh`, `/{slug}` (1 segment) | ~340 | Category/subcategory landing, static pages |
| `/{category}/{product-slug}` e.g. `/sofa/andaman-184` | ~800 | Product detail |
| `/content/{product-slug}` | 84 | Product detail (canonical `se_name`) |
| `/blog/{slug}` | 378 | Blog post |
| `/showrooms/{slug}` | 70 | Showroom detail |
| `/about-hatil`, `/company-profile`, `/careers`, `/contact-us`, `/catalogues`, `/become-franchise-partner`, `/billing-terms-and-conditions` | — | Static/CMS pages |

## Global layout
- **Top bar**: hotline, showroom locator link, social links.
- **Sticky header**: logo, search with autocomplete, wishlist, compare, cart count.
- **Mega-menu** (room → category → subcategory):
  - *Living Room*: Sofa Set (Fabric, Wooden, L-Shaped, Leather, Sofa-Bed, 3/2/1-Seater, Modular), Cushion, Center Table (Glass/Wooden Top, Storage, Corner, Nested), Divan, Shoe Rack, TV Cabinet, Open Shelves, Chair (Rocking, Easy, Accent, Bar Stool, Recliner), Lobby
  - *Bedroom*: Bed Room Set, Bed (King, Queen, Semi Double, Storage, Folding, Bunk), Wardrobe, Chest of Drawers, Dressing Table, Bed-Side Table, Almirah, Reading Table, Mattress
  - *Dining*: Dining sets (8/6/4/2-seater, wooden/glass/granite top), Dining Chair, Dinner Wagon, Cafeteria, Showcase, Bar Cabinet, Tea Trolley
  - *Kitchen*, *Kid's Room*, *SmartFit*, *Institutional*, *Door*, *Interior*
  - *Office*: Director/Executive/Conference/Computer tables, Swivel & Fixed chairs, Side Rack, Shelves, Drawer Unit, File Cabinet, Work Station
- **Footer**: The Company (About, Profile, Careers), Need Help (Contact, FAQ, Showrooms, Warranty), More Information (Terms, Privacy, Blog), newsletter, social icons.
- Floating WhatsApp chat button.

## Home page sections
1. Hero banner slider
2. Popular categories grid (image cards)
3. Room-themed promo cards
4. New products carousel
5. Trending / best sellers carousel
6. Offer banners
7. Showroom teaser
8. Blog / inspiration teaser
9. Home FAQ accordion (FAQPage JSON-LD)
10. Newsletter / contact CTA

## Category / listing page
- Banner + H1 + rich SEO description + breadcrumb (BreadcrumbList JSON-LD)
- Subcategory chips
- Filters: price range, specification attributes (color, material), availability
- Sort: position, price asc/desc, newest; pagination
- Product card: image (hover 2nd image), name, price, old price + discount badge, wishlist/compare

## Product detail page
- Breadcrumb; gallery (main pictures, dimension drawings) with zoom
- Name, SKU, price/old price, stock, color/fabric attribute options
- Short + full description, rich H1 content block
- Specification groups (dimensions, materials, finish), care/warranty text
- Meta title/description/keywords; compare & wishlist; related products

## Showroom pages
70 showrooms by division/city: name, address, phone, off-days, visiting hours, lat/lng (map), photos, LocalBusiness JSON-LD.

## Blog
Listing with cover, title, date, excerpt; detail with rich HTML body and related posts.

## Static / CMS pages
About, Company Profile, Careers, Contact (form + hotline + map), FAQ, Warranty, Privacy, Terms.

## Feature mapping to the clone
| Hatil feature | Clone implementation |
|---|---|
| Cart / checkout | localStorage cart → **WhatsApp checkout** (no server orders) |
| Customer login | Not implemented by design |
| Wishlist / compare | localStorage |
| Search autocomplete | `GET /api/v1/search?q=` |
| Mega-menu | `GET /api/v1/categories/tree` + rooms |
| Spec filters | color / material / room M2M + price range + availability |
| Showroom map | Leaflet + OpenStreetMap, city filter |
| JSON-LD | Product, BreadcrumbList, FAQPage, LocalBusiness, Organization |
