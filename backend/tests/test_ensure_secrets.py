from sqlalchemy import create_engine
from sqlalchemy.pool import StaticPool

from scripts.ensure_secrets import needs_value, resolve_secrets


def _engine():
    return create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)


def test_needs_value_for_missing_empty_and_placeholder():
    assert needs_value(None)
    assert needs_value("  ")
    assert needs_value("__openssl_rand_hex_64__")
    assert not needs_value("a" * 64)


def test_generates_placeholder_secrets_and_reuses_them_on_next_deploy():
    engine = _engine()
    env = {"JWT_SECRET": "__openssl_rand_hex_64__", "SUPER_ADMIN_PASSWORD": "__strong_password__"}

    first = resolve_secrets(engine, env)
    second = resolve_secrets(engine, env)

    assert len(first["JWT_SECRET"][0]) == 128
    assert first["JWT_SECRET"][1] is True
    assert second["JWT_SECRET"] == (first["JWT_SECRET"][0], False)
    assert second["SUPER_ADMIN_PASSWORD"] == (first["SUPER_ADMIN_PASSWORD"][0], False)


def test_real_env_values_are_left_alone():
    env = {"JWT_SECRET": "x" * 64, "SUPER_ADMIN_PASSWORD": "Real-Password-123"}

    assert resolve_secrets(_engine(), env) == {}
