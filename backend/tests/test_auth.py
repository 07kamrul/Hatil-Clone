from fastapi.testclient import TestClient

from tests.conftest import ADMIN_EMAIL, ADMIN_PASSWORD


def test_login_returns_token_pair(client: TestClient) -> None:
    res = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert res.status_code == 200
    body = res.json()
    assert body["token_type"] == "bearer"
    assert body["access_token"] and body["refresh_token"]


def test_login_rejects_wrong_password(client: TestClient) -> None:
    res = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": "nope"})
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password"


def test_login_rejects_unknown_email_with_same_message(client: TestClient) -> None:
    res = client.post("/api/v1/auth/login", json={"email": "ghost@test.io", "password": "whatever"})
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password"


def test_admin_routes_require_token(client: TestClient) -> None:
    assert client.get("/api/v1/admin/dashboard").status_code == 401
    bad = {"Authorization": "Bearer not-a-jwt"}
    assert client.get("/api/v1/admin/dashboard", headers=bad).status_code == 401


def test_refresh_token_cannot_be_used_as_access_token(client: TestClient, tokens: dict) -> None:
    res = client.get("/api/v1/admin/dashboard", headers={"Authorization": f"Bearer {tokens['refresh_token']}"})
    assert res.status_code == 401


def test_refresh_rotates_and_detects_reuse(client: TestClient, tokens: dict) -> None:
    first = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert first.status_code == 200
    new_pair = first.json()
    assert new_pair["refresh_token"] != tokens["refresh_token"]

    reuse = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert reuse.status_code == 401
    # Reuse revokes the whole family, including the newly issued token.
    after = client.post("/api/v1/auth/refresh", json={"refresh_token": new_pair["refresh_token"]})
    assert after.status_code == 401


def test_logout_revokes_refresh_token(client: TestClient, tokens: dict) -> None:
    assert client.post("/api/v1/auth/logout", json={"refresh_token": tokens["refresh_token"]}).status_code == 200
    res = client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]})
    assert res.status_code == 401


def test_me_returns_current_admin(client: TestClient, auth: dict) -> None:
    res = client.get("/api/v1/auth/me", headers=auth)
    assert res.status_code == 200
    assert res.json()["email"] == ADMIN_EMAIL
    assert res.json()["role"] == "super_admin"


def test_super_admin_manages_users_and_admin_cannot(client: TestClient, auth: dict) -> None:
    created = client.post("/api/v1/admin/users", headers=auth,
                          json={"email": "editor@test.io", "password": "Editor123!", "role": "admin"})
    assert created.status_code == 201
    login = client.post("/api/v1/auth/login", json={"email": "editor@test.io", "password": "Editor123!"})
    editor = {"Authorization": f"Bearer {login.json()['access_token']}"}
    assert client.get("/api/v1/admin/users", headers=editor).status_code == 403
    assert client.get("/api/v1/admin/dashboard", headers=editor).status_code == 200


def test_last_super_admin_cannot_be_demoted(client: TestClient, auth: dict) -> None:
    me = client.get("/api/v1/auth/me", headers=auth).json()
    res = client.patch(f"/api/v1/admin/users/{me['id']}", json={"role": "admin"}, headers=auth)
    assert res.status_code == 422


def test_change_password_revokes_sessions(client: TestClient, auth: dict, tokens: dict) -> None:
    res = client.post("/api/v1/auth/change-password", headers=auth,
                      json={"current_password": ADMIN_PASSWORD, "new_password": "BrandNew123!"})
    assert res.status_code == 200
    assert client.post("/api/v1/auth/refresh", json={"refresh_token": tokens["refresh_token"]}).status_code == 401
    ok = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": "BrandNew123!"})
    assert ok.status_code == 200
