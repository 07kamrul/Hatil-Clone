import io

from fastapi.testclient import TestClient
from openpyxl import load_workbook

from tests.conftest import png_bytes

BASE = "/api/v1/admin/products"


def test_create_product_with_relations(client: TestClient, auth: dict, make_category) -> None:
    cat = make_category("Sofas")
    color = client.post("/api/v1/admin/colors", json={"name": "Walnut", "hex_code": "#5d4037"}, headers=auth).json()
    res = client.post(BASE, headers=auth, json={
        "name": "Aria Sofa", "sku": "AR-1", "price": "50000", "sale_price": "45000", "category_id": cat["id"],
        "color_ids": [color["id"]], "specs": [{"key": "Width", "value": "210 cm"}],
        "variants": [{"color_id": color["id"], "size": "3 seater", "price_delta": "2500"}],
        "description_html": "<p>Nice</p><script>alert(1)</script>",
    })
    assert res.status_code == 201, res.text
    body = res.json()
    assert body["slug"] == "aria-sofa"
    assert body["discount_percent"] == 10
    assert body["final_price"] == 45000
    assert body["colors"][0]["name"] == "Walnut"
    assert body["variants"][0]["price_delta"] == 2500
    assert body["specs"] == [{"key": "Width", "value": "210 cm"}]
    assert "<script>" not in body["description_html"]
    assert body["breadcrumbs"][0]["slug"] == "sofas"


def test_duplicate_sku_conflicts_and_slug_is_made_unique(client: TestClient, auth: dict, make_product) -> None:
    make_product(name="Chair", sku="DUP")
    res = client.post(BASE, json={"name": "Chair", "sku": "DUP", "price": "10"}, headers=auth)
    assert res.status_code == 409
    second = make_product(name="Chair", sku="DUP-2")
    assert second["slug"] == "chair-2"


def test_sale_price_must_be_lower(client: TestClient, auth: dict) -> None:
    res = client.post(BASE, json={"name": "X", "sku": "X", "price": "100", "sale_price": "150"}, headers=auth)
    assert res.status_code == 422


def test_update_and_delete_product(client: TestClient, auth: dict, make_product) -> None:
    p = make_product()
    res = client.patch(f"{BASE}/{p['id']}", json={"name": "Renamed", "is_published": False}, headers=auth)
    assert res.json()["name"] == "Renamed" and res.json()["is_published"] is False
    assert client.delete(f"{BASE}/{p['id']}", headers=auth).status_code == 200
    assert client.get(f"{BASE}/{p['id']}", headers=auth).status_code == 404


def test_image_upload_reorder_and_delete(client: TestClient, auth: dict, make_product) -> None:
    p = make_product()
    files = [("files", ("a.png", png_bytes("red"), "image/png")), ("files", ("b.png", png_bytes("blue"), "image/png"))]
    res = client.post(f"{BASE}/{p['id']}/images", files=files, headers=auth)
    assert res.status_code == 200, res.text
    images = res.json()["images"]
    assert len(images) == 2 and images[0]["url"].endswith(".webp") and images[0]["thumb_url"]

    order = [images[1]["id"], images[0]["id"]]
    reordered = client.put(f"{BASE}/{p['id']}/images/order", json={"image_ids": order}, headers=auth).json()
    assert [i["id"] for i in reordered["images"]] == order

    after = client.delete(f"{BASE}/{p['id']}/images/{order[0]}", headers=auth).json()
    assert [i["id"] for i in after["images"]] == [order[1]]


def test_upload_rejects_non_image(client: TestClient, auth: dict, make_product) -> None:
    p = make_product()
    res = client.post(f"{BASE}/{p['id']}/images", files=[("files", ("x.png", b"not an image", "image/png"))],
                      headers=auth)
    assert res.status_code == 422


def test_bulk_publish_and_price(client: TestClient, auth: dict, make_product) -> None:
    a, b = make_product(price="1000"), make_product(price="2000", sale_price="1500")
    res = client.post(f"{BASE}/bulk/publish", json={"ids": [a["id"], b["id"]], "is_published": False}, headers=auth)
    assert res.status_code == 200
    assert client.get(f"{BASE}?published=false", headers=auth).json()["total"] == 2

    res = client.post(f"{BASE}/bulk/price", headers=auth,
                      json={"ids": [a["id"], b["id"]], "mode": "percent", "value": "10", "round_to": 10})
    assert res.status_code == 200
    assert client.get(f"{BASE}/{a['id']}", headers=auth).json()["price"] == 1100
    assert client.get(f"{BASE}/{b['id']}", headers=auth).json()["price"] == 2200


def test_csv_import_is_idempotent_and_reports_errors(client: TestClient, auth: dict) -> None:
    csv_text = (
        "sku,name,price,sale_price,category_path,colors,specs,stock_status\n"
        "IMP-1,Imported Bed,30000,27000,Bedroom > Bed,Walnut|White,Width: 180 cm|Height: 100 cm,in_stock\n"
        "IMP-2,Bad Price,abc,,,,,in_stock\n"
    )
    files = {"file": ("products.csv", csv_text.encode(), "text/csv")}
    first = client.post(f"{BASE}/import", files=files, headers=auth).json()
    assert first["created"] == 1 and first["failed"] == 1 and "Row 3" in first["errors"][0]
    second = client.post(f"{BASE}/import", files=files, headers=auth).json()
    assert second["created"] == 0 and second["updated"] == 1

    listing = client.get(f"{BASE}?q=IMP-1", headers=auth).json()
    assert listing["total"] == 1
    detail = client.get(f"{BASE}/{listing['items'][0]['id']}", headers=auth).json()
    assert [c["slug"] for c in detail["breadcrumbs"]] == ["bedroom", "bed"]
    assert len(detail["specs"]) == 2


def test_export_csv_and_xlsx(client: TestClient, auth: dict, make_product) -> None:
    make_product(name="=HYPERLINK(evil)", sku="EXP-1")
    csv_res = client.get(f"{BASE}/export?fmt=csv", headers=auth)
    assert csv_res.status_code == 200
    text = csv_res.content.decode("utf-8-sig")
    assert text.startswith("sku,name")
    assert "'=HYPERLINK(evil)" in text  # formula injection neutralised

    xlsx = client.get(f"{BASE}/export?fmt=xlsx", headers=auth)
    ws = load_workbook(io.BytesIO(xlsx.content)).active
    assert ws.cell(1, 1).value == "sku" and ws.cell(2, 1).value == "EXP-1"


def test_imported_text_is_rebranded(client: TestClient, auth: dict) -> None:
    csv_text = "sku,name,price,short_desc\nRB-1,Sofa,100,Made by HATIL in Dhaka\n"
    client.post(f"{BASE}/import", files={"file": ("p.csv", csv_text.encode(), "text/csv")}, headers=auth)
    item = client.get(f"{BASE}?q=RB-1", headers=auth).json()["items"][0]
    detail = client.get(f"{BASE}/{item['id']}", headers=auth).json()
    assert "HATIL" not in detail["short_desc"]
