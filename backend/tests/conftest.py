import io
import os
import tempfile
from collections.abc import Iterator

# Configure the app for tests before anything imports settings.
_UPLOADS = tempfile.mkdtemp(prefix="uploads-")
os.environ.update({
    "DATABASE_URL": "sqlite://",
    "UPLOAD_DIR": _UPLOADS,
    "RATE_LIMIT_ENABLED": "false",
    "JWT_SECRET": "test-secret-key-that-is-long-enough-123",
    "SUPER_ADMIN_EMAIL": "admin@test.io",
    "SUPER_ADMIN_PASSWORD": "Sup3rSecret!",
    "BRAND_MODE": "neutral",
})

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from PIL import Image  # noqa: E402
from sqlalchemy import create_engine, event  # noqa: E402
from sqlalchemy.orm import Session, sessionmaker  # noqa: E402
from sqlalchemy.pool import StaticPool  # noqa: E402

import app.models  # noqa: E402,F401
from app.core.enums import AdminRole  # noqa: E402
from app.core.security import hash_password  # noqa: E402
from app.db.base import Base  # noqa: E402
from app.db.session import get_db  # noqa: E402
from app.main import app  # noqa: E402
from app.models import AdminUser  # noqa: E402

ADMIN_EMAIL = "admin@test.io"
ADMIN_PASSWORD = "Sup3rSecret!"


@pytest.fixture
def engine():
    eng = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)

    @event.listens_for(eng, "connect")
    def _fk_on(dbapi_conn, _):  # noqa: ANN001
        dbapi_conn.execute("PRAGMA foreign_keys=ON")

    Base.metadata.create_all(eng)
    yield eng
    eng.dispose()


@pytest.fixture
def db(engine) -> Iterator[Session]:  # noqa: ANN001
    session = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)()
    yield session
    session.close()


@pytest.fixture
def client(engine, db: Session) -> Iterator[TestClient]:  # noqa: ANN001
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def _get_db() -> Iterator[Session]:
        s = factory()
        try:
            yield s
        finally:
            s.close()

    app.dependency_overrides[get_db] = _get_db
    db.add(AdminUser(email=ADMIN_EMAIL, full_name="Admin", role=AdminRole.SUPER_ADMIN,
                     password_hash=hash_password(ADMIN_PASSWORD)))
    db.commit()
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def tokens(client: TestClient) -> dict:
    res = client.post("/api/v1/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD})
    assert res.status_code == 200, res.text
    return res.json()


@pytest.fixture
def auth(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}


def png_bytes(color: str = "red", size: tuple[int, int] = (64, 64)) -> bytes:
    buf = io.BytesIO()
    Image.new("RGB", size, color).save(buf, format="PNG")
    return buf.getvalue()


@pytest.fixture
def make_category(client: TestClient, auth: dict):
    def _make(name: str, parent_id: int | None = None) -> dict:
        res = client.post("/api/v1/admin/categories", json={"name": name, "parent_id": parent_id}, headers=auth)
        assert res.status_code == 201, res.text
        return res.json()
    return _make


@pytest.fixture
def make_product(client: TestClient, auth: dict):
    counter = {"n": 0}

    def _make(**overrides: object) -> dict:
        counter["n"] += 1
        body = {"name": f"Product {counter['n']}", "sku": f"SKU-{counter['n']}", "price": "1000.00"}
        body.update(overrides)
        res = client.post("/api/v1/admin/products", json=body, headers=auth)
        assert res.status_code == 201, res.text
        return res.json()
    return _make
