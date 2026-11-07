"""Shared test setup.

Auth approach (documented in docs/testing-and-evaluation.md): tests mint HS256 tokens signed
with a TEST secret and the API verifies them through the SAME code path as production
(signature, expiry, audience). No auth bypass exists in the application.

Database tests require a real PostgreSQL (TEST_DATABASE_URL, database name must contain
"test" because the schema is dropped and recreated).
"""

import os
from pathlib import Path

import pytest

TEST_DB = os.environ.get(
    "TEST_DATABASE_URL",
    "postgresql+psycopg://reservehub:reservehub@localhost:5433/reservehub_test",
)
os.environ["DATABASE_URL"] = TEST_DB
os.environ["SUPABASE_JWT_SECRET"] = "test-secret-test-secret-test-secret-123456"  # noqa: S105
# Empty strings override any values in backend/.env so tests always use the test HS256 secret.
os.environ["SUPABASE_JWKS_URL"] = ""
os.environ["JWT_ISSUER"] = ""
os.environ.setdefault("LOG_LEVEL", "WARNING")

BACKEND_DIR = Path(__file__).resolve().parents[1]


@pytest.fixture(scope="session")
def migrated_db():
    from alembic import command
    from alembic.config import Config
    from sqlalchemy import create_engine, text
    from sqlalchemy.engine import make_url

    name = make_url(TEST_DB).database or ""
    assert "test" in name, f"refusing to reset database {name!r}: name must contain 'test'"
    engine = create_engine(TEST_DB, isolation_level="AUTOCOMMIT")
    with engine.connect() as conn:
        conn.execute(text("DROP SCHEMA public CASCADE"))
        conn.execute(text("CREATE SCHEMA public"))
    engine.dispose()
    cfg = Config(str(BACKEND_DIR / "alembic.ini"))
    cfg.set_main_option("script_location", str(BACKEND_DIR / "migrations"))
    command.upgrade(cfg, "head")
    return cfg


@pytest.fixture
def clean_db(migrated_db):
    from sqlalchemy import text

    from app.db.session import get_engine

    tables = (
        "audit_events, notifications, idempotency_records, waitlist_entries, bookings, "
        "availability_slots, resources, profiles"
    )
    with get_engine().begin() as conn:
        conn.execute(text(f"TRUNCATE {tables} RESTART IDENTITY CASCADE"))
    yield


@pytest.fixture
def db(clean_db):
    from app.db.session import get_sessionmaker

    session = get_sessionmaker()()
    try:
        yield session
    finally:
        session.close()


@pytest.fixture
def client(clean_db):
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app)


@pytest.fixture
def nosrv_client(clean_db):
    """Client that returns 500 responses instead of re-raising server exceptions."""
    from fastapi.testclient import TestClient

    from app.main import app

    return TestClient(app, raise_server_exceptions=False)
