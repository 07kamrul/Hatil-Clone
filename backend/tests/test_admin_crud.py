from fastapi.testclient import TestClient

from tests.conftest import png_bytes


def test_category_tree_and_cycle_protection(client: TestClient, auth: dict, make_category) -> None:
    root = make_category("Living Room")
    child = make_category("Sofa Set", root["id"])
    grandchild = make_category("Fabric Sofa", child["id"])

    tree = client.get("/api/v1/admin/categories/tree", headers=auth).json()
    assert tree[0]["slug"] == "living-room"
    assert tree[0]["children"][0]["children"][0]["id"] == grandchild["id"]

    res = client.patch(f"/api/v1/admin/categories/{root['id']}", json={"parent_id": grandchild["id"]}, headers=auth)
    assert res.status_code == 422


def test_deleting_category_reparents_children(client: TestClient, auth: dict, make_category) -> None:
    root = make_category("Office")
    mid = make_category("Desks", root["id"])
    leaf = make_category("Standing Desks", mid["id"])
    assert client.delete(f"/api/v1/admin/categories/{mid['id']}", headers=auth).status_code == 200
    assert client.get(f"/api/v1/admin/categories/{leaf['id']}", headers=auth).json()["parent_id"] == root["id"]


def test_category_with_products_cannot_be_deleted(client: TestClient, auth: dict, make_category, make_product) -> None:
    cat = make_category("Beds")
    make_product(category_id=cat["id"])
    assert client.delete(f"/api/v1/admin/categories/{cat['id']}", headers=auth).status_code == 409


def test_generic_crud_for_showrooms(client: TestClient, auth: dict) -> None:
    body = {"name": "Gulshan", "city": "Dhaka", "address": "Road 1", "latitude": 23.79, "longitude": 90.41}
    created = client.post("/api/v1/admin/showrooms", json=body, headers=auth)
    assert created.status_code == 201
    sid = created.json()["id"]
    assert created.json()["slug"] == "gulshan"
    assert client.get("/api/v1/admin/showrooms?q=dhaka", headers=auth).json()["total"] == 1
    assert client.patch(f"/api/v1/admin/showrooms/{sid}", json={"city": "Dhaka North"}, headers=auth).json()["city"] == "Dhaka North"
    assert client.delete(f"/api/v1/admin/showrooms/{sid}", headers=auth).status_code == 200


def test_reorder_banners(client: TestClient, auth: dict) -> None:
    ids = []
    for title in ("A", "B"):
        res = client.post("/api/v1/admin/banners", json={"title": title, "image": "/uploads/x.webp"}, headers=auth)
        ids.append(res.json()["id"])
    res = client.put("/api/v1/admin/banners/reorder", headers=auth,
                     json=[{"id": ids[0], "sort_order": 5}, {"id": ids[1], "sort_order": 1}])
    assert res.status_code == 200
    assert client.get(f"/api/v1/admin/banners/{ids[0]}", headers=auth).json()["sort_order"] == 5


def test_blog_and_pages_sanitize_html(client: TestClient, auth: dict) -> None:
    post = client.post("/api/v1/admin/blog-posts", headers=auth,
                       json={"title": "Hello World", "body_html": '<p onclick="x()">Hi</p><iframe src="x"></iframe>'}).json()
    assert post["slug"] == "hello-world"
    assert "onclick" not in post["body_html"] and "iframe" not in post["body_html"]
    page = client.post("/api/v1/admin/pages", json={"title": "About", "body_html": "<p>About</p>"}, headers=auth)
    assert page.status_code == 201


def test_settings_validation(client: TestClient, auth: dict) -> None:
    ok = client.put("/api/v1/admin/settings", headers=auth,
                    json={"values": {"whatsapp_number": "+880 1711-000000", "site_name": "My Shop"}})
    assert ok.status_code == 200
    assert ok.json()["whatsapp_number"] == "8801711000000"
    assert client.put("/api/v1/admin/settings", json={"values": {"unknown": 1}}, headers=auth).status_code == 422
    bad_color = client.put("/api/v1/admin/settings", json={"values": {"primary_color": "red"}}, headers=auth)
    assert bad_color.status_code == 422


def test_generic_image_upload(client: TestClient, auth: dict) -> None:
    res = client.post("/api/v1/admin/uploads/image?folder=banners",
                      files={"file": ("b.png", png_bytes(), "image/png")}, headers=auth)
    assert res.status_code == 200 and res.json()["url"].startswith("/uploads/banners/")
    bad = client.post("/api/v1/admin/uploads/image?folder=../etc",
                      files={"file": ("b.png", png_bytes(), "image/png")}, headers=auth)
    assert bad.status_code == 422


def test_dashboard_stats(client: TestClient, auth: dict, make_product) -> None:
    make_product()
    stats = client.get("/api/v1/admin/dashboard", headers=auth).json()
    assert stats["products_total"] == 1
    assert stats["top_viewed"][0]["sku"].startswith("SKU-")
