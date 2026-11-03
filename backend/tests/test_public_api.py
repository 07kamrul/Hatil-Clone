from datetime import UTC, datetime, timedelta

from fastapi.testclient import TestClient

P = "/api/v1"


def seed_catalog(client: TestClient, auth: dict, make_category, make_product) -> dict:
    living = make_category("Living Room")
    sofas = make_category("Sofa Set", living["id"])
    beds = make_category("Beds")
    walnut = client.post(f"{P}/admin/colors", json={"name": "Walnut"}, headers=auth).json()
    grey = client.post(f"{P}/admin/colors", json={"name": "Grey"}, headers=auth).json()
    wood = client.post(f"{P}/admin/materials", json={"name": "Solid Wood"}, headers=auth).json()
    room = client.post(f"{P}/admin/rooms", json={"name": "Living Room"}, headers=auth).json()
    a = make_product(name="Aria Sofa", sku="A1", price="50000", sale_price="45000", category_id=sofas["id"],
                     color_ids=[walnut["id"]], material_ids=[wood["id"]], room_ids=[room["id"]], is_featured=True)
    b = make_product(name="Boston Sofa", sku="B1", price="30000", category_id=sofas["id"], color_ids=[grey["id"]],
                     stock_status="out_of_stock")
    c = make_product(name="Cloud Bed", sku="C1", price="80000", category_id=beds["id"], is_best_seller=True)
    hidden = make_product(name="Hidden Item", sku="H1", price="10", is_published=False)
    return {"a": a, "b": b, "c": c, "hidden": hidden, "living": living, "sofas": sofas}


def test_unpublished_products_are_never_public(client, auth, make_category, make_product) -> None:
    d = seed_catalog(client, auth, make_category, make_product)
    names = [p["name"] for p in client.get(f"{P}/products").json()["items"]]
    assert "Hidden Item" not in names and len(names) == 3
    assert client.get(f"{P}/products/{d['hidden']['slug']}").status_code == 404


def test_filters_sort_and_pagination(client, auth, make_category, make_product) -> None:
    d = seed_catalog(client, auth, make_category, make_product)
    assert client.get(f"{P}/products?category=living-room").json()["total"] == 2  # includes subcategory products
    assert client.get(f"{P}/products?colors=walnut").json()["total"] == 1
    assert client.get(f"{P}/products?colors=walnut,grey").json()["total"] == 2
    assert client.get(f"{P}/products?materials=solid-wood&rooms=living-room").json()["total"] == 1
    assert client.get(f"{P}/products?min_price=40000&max_price=60000").json()["total"] == 1  # sale price counts
    assert client.get(f"{P}/products?availability=out_of_stock").json()["items"][0]["name"] == "Boston Sofa"
    assert client.get(f"{P}/products?featured=true").json()["total"] == 1
    assert client.get(f"{P}/products?on_sale=true").json()["items"][0]["discount_percent"] == 10

    asc = [p["final_price"] for p in client.get(f"{P}/products?sort=price_asc").json()["items"]]
    assert asc == sorted(asc)
    desc = [p["final_price"] for p in client.get(f"{P}/products?sort=price_desc").json()["items"]]
    assert desc == sorted(desc, reverse=True)

    page = client.get(f"{P}/products?page=2&page_size=2").json()
    assert page["total"] == 3 and page["pages"] == 2 and len(page["items"]) == 1
    assert client.get(f"{P}/products?page_size=1000").status_code == 422
    assert client.get(f"{P}/products?category=nope").status_code == 404
    assert d["a"]["id"]


def test_facets(client, auth, make_category, make_product) -> None:
    seed_catalog(client, auth, make_category, make_product)
    facets = client.get(f"{P}/products/facets?category=living-room").json()
    assert {c["slug"]: c["count"] for c in facets["colors"]} == {"walnut": 1, "grey": 1}
    assert facets["min_price"] == 30000 and facets["max_price"] == 45000
    assert {a["slug"] for a in facets["availability"]} == {"in_stock", "out_of_stock"}


def test_product_detail_counts_views_and_related(client, auth, make_category, make_product) -> None:
    d = seed_catalog(client, auth, make_category, make_product)
    slug = d["a"]["slug"]
    first = client.get(f"{P}/products/{slug}").json()
    client.get(f"{P}/products/{slug}")
    assert first["sku"] == "A1" and first["breadcrumbs"][0]["slug"] == "living-room"
    assert client.get(f"{P}/admin/products/{d['a']['id']}", headers=auth).json()["view_count"] == 2
    related = client.get(f"{P}/products/{slug}/related").json()
    assert [p["name"] for p in related] == ["Boston Sofa"]


def test_by_ids_keeps_order_and_skips_unpublished(client, auth, make_category, make_product) -> None:
    d = seed_catalog(client, auth, make_category, make_product)
    ids = f"{d['c']['id']},{d['hidden']['id']},{d['a']['id']}"
    assert [p["name"] for p in client.get(f"{P}/products/by-ids?ids={ids}").json()] == ["Cloud Bed", "Aria Sofa"]
    assert client.get(f"{P}/products/by-ids?ids=x").status_code == 422


def test_category_tree_counts_and_detail(client, auth, make_category, make_product) -> None:
    seed_catalog(client, auth, make_category, make_product)
    tree = client.get(f"{P}/categories/tree").json()
    living = next(n for n in tree if n["slug"] == "living-room")
    assert living["product_count"] == 2 and living["children"][0]["slug"] == "sofa-set"
    detail = client.get(f"{P}/categories/sofa-set").json()
    assert [b["slug"] for b in detail["breadcrumbs"]] == ["living-room", "sofa-set"]


def test_search_suggestions(client, auth, make_category, make_product) -> None:
    seed_catalog(client, auth, make_category, make_product)
    results = client.get(f"{P}/search?q=sofa").json()
    types = {(r["type"], r["name"]) for r in results}
    assert ("product", "Aria Sofa") in types and ("category", "Sofa Set") in types
    assert client.get(f"{P}/search?q=a").json() == []
    assert not any(r["name"] == "Hidden Item" for r in client.get(f"{P}/search?q=hidden").json())


def test_banners_respect_schedule(client, auth) -> None:
    now = datetime.now(UTC)
    base = {"image": "/uploads/x.webp", "placement": "hero"}
    client.post(f"{P}/admin/banners", json={**base, "title": "Live"}, headers=auth)
    client.post(f"{P}/admin/banners", json={**base, "title": "Future", "starts_at": (now + timedelta(days=1)).isoformat()}, headers=auth)
    client.post(f"{P}/admin/banners", json={**base, "title": "Off", "is_active": False}, headers=auth)
    assert [b["title"] for b in client.get(f"{P}/banners?placement=hero").json()] == ["Live"]


def test_showrooms_blog_pages_faqs(client, auth) -> None:
    for name, city in (("Gulshan", "Dhaka"), ("Agrabad", "Chattogram")):
        client.post(f"{P}/admin/showrooms", json={"name": name, "city": city, "address": "x"}, headers=auth)
    assert client.get(f"{P}/showrooms/cities").json() == ["Chattogram", "Dhaka"]
    assert [s["name"] for s in client.get(f"{P}/showrooms?city=dhaka").json()] == ["Gulshan"]
    assert client.get(f"{P}/showrooms/gulshan").status_code == 200

    now = datetime.now(UTC)
    client.post(f"{P}/admin/blog-posts", headers=auth, json={"title": "Live Post", "is_published": True, "published_at": now.isoformat()})
    client.post(f"{P}/admin/blog-posts", headers=auth, json={"title": "Draft", "is_published": False})
    listing = client.get(f"{P}/blog").json()
    assert [p["title"] for p in listing["items"]] == ["Live Post"]
    assert client.get(f"{P}/blog/live-post").json()["post"]["title"] == "Live Post"
    assert client.get(f"{P}/blog/draft").status_code == 404

    client.post(f"{P}/admin/pages", json={"title": "About Us", "body_html": "<p>Hi</p>"}, headers=auth)
    client.post(f"{P}/admin/pages", json={"title": "Secret", "is_published": False}, headers=auth)
    assert client.get(f"{P}/pages/about-us").json()["title"] == "About Us"
    assert client.get(f"{P}/pages/secret").status_code == 404
    assert client.get(f"{P}/pages").json() == [{"title": "About Us", "slug": "about-us"}]

    client.post(f"{P}/admin/faqs", json={"question": "Q?", "answer_html": "<p>A</p>", "show_on_home": True}, headers=auth)
    assert len(client.get(f"{P}/faqs?home=true").json()) == 1


def test_public_settings_expose_whatsapp_number(client, auth) -> None:
    client.put(f"{P}/admin/settings", json={"values": {"whatsapp_number": "8801711000000"}}, headers=auth)
    assert client.get(f"{P}/settings/public").json()["whatsapp_number"] == "8801711000000"


def test_inquiry_logging_uses_server_prices_and_dedupes(client, auth, make_product) -> None:
    product = make_product(name="Real Name", price="1000", sale_price="900")
    body = {"items": [{"product_id": product["id"], "name": "<b>Hacked</b>", "quantity": 2, "unit_price": "1"}],
            "customer_name": "Rahim <script>x</script>", "phone": "0171"}
    assert client.post(f"{P}/inquiries", json=body).status_code == 201
    client.post(f"{P}/inquiries", json=body)  # immediate duplicate is ignored
    rows = client.get(f"{P}/admin/inquiries", headers=auth).json()
    assert rows["total"] == 1
    item = rows["items"][0]
    assert item["items"][0]["name"] == "Real Name" and item["total"] == 1800
    assert "<script>" not in item["customer_name"]
    assert client.post(f"{P}/inquiries", json={"items": []}).status_code == 422


def test_inquiry_logging_can_be_disabled(client, auth, make_product) -> None:
    product = make_product()
    client.put(f"{P}/admin/settings", json={"values": {"log_inquiries": False}}, headers=auth)
    client.post(f"{P}/inquiries", json={"items": [{"product_id": product["id"], "name": "x", "quantity": 1, "unit_price": "1000"}]})
    assert client.get(f"{P}/admin/inquiries", headers=auth).json()["total"] == 0


def test_contact_form_stores_message_and_blocks_bots(client, auth) -> None:
    ok = client.post(f"{P}/contact", json={"name": "Karim", "email": "k@example.com", "message": "Hello there"})
    assert ok.status_code == 201
    bot = client.post(f"{P}/contact", json={"name": "Bot", "email": "b@example.com", "message": "spam!!", "website": "http://x"})
    assert bot.status_code == 201
    no_way = client.post(f"{P}/contact", json={"name": "Nobody", "message": "reach me how?"})
    assert no_way.status_code == 422
    messages = client.get(f"{P}/admin/contact-messages", headers=auth).json()
    assert messages["total"] == 1 and messages["items"][0]["is_read"] is False
    assert client.get(f"{P}/admin/dashboard", headers=auth).json()["contact_unread"] == 1


def test_sitemap_and_robots(client, auth, make_product) -> None:
    make_product(name="Sitemap Chair")
    xml = client.get(f"{P}/seo/sitemap.xml")
    assert xml.headers["content-type"].startswith("application/xml")
    assert "/product/sitemap-chair" in xml.text
    assert "Sitemap:" in client.get(f"{P}/seo/robots.txt").text


def test_security_headers_present(client) -> None:
    res = client.get(f"{P}/health")
    assert res.headers["x-content-type-options"] == "nosniff"
    assert res.headers["x-frame-options"] == "DENY"


def test_public_posts_are_rate_limited(client) -> None:
    from app.core.rate_limit import limiter

    limiter.enabled = True
    limiter.reset()
    try:
        body = {"name": "Karim", "email": "k@example.com", "message": "Hello there"}
        codes = [client.post(f"{P}/contact", json=body).status_code for _ in range(7)]
    finally:
        limiter.enabled = False
    assert codes[:5] == [201] * 5 and 429 in codes[5:]


def test_compare_returns_details_without_counting_views(client, auth, make_category, make_product) -> None:
    d = seed_catalog(client, auth, make_category, make_product)
    res = client.get(f"{P}/products/compare?ids={d['a']['id']},{d['hidden']['id']},{d['b']['id']}").json()
    assert [p["name"] for p in res] == ["Aria Sofa", "Boston Sofa"]
    assert res[0]["materials"][0]["slug"] == "solid-wood"
    assert client.get(f"{P}/admin/products/{d['a']['id']}", headers=auth).json()["view_count"] == 0
