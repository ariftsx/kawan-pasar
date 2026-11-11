import os
from collections.abc import Iterator
from pathlib import Path

import psycopg
import pytest

ROOT_ENV = Path(__file__).resolve().parents[3] / ".env"


def _load_root_env() -> None:
    """Loads the repo .env (created by `pnpm env:init`) without overriding the real environment."""
    if not ROOT_ENV.exists():
        return
    for line in ROOT_ENV.read_text(encoding="utf-8").splitlines():
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key, value)


_load_root_env()


def _require(name: str) -> str:
    value = os.environ.get(name, "")
    if not value:
        pytest.fail(f"missing env {name}: run `pnpm env:init` and `pnpm infra:up`")
    return value


@pytest.fixture(scope="session")
def ingest_url() -> str:
    return _require("TEST_INGEST_DATABASE_URL")


@pytest.fixture
def owner_conn() -> Iterator[psycopg.Connection]:
    with psycopg.connect(
        _require("TEST_DATABASE_MIGRATION_URL"), autocommit=True, connect_timeout=10
    ) as conn:
        exists = conn.execute(
            "SELECT to_regclass('public.price_observations') IS NOT NULL"
        ).fetchone()
        if exists is None or not exists[0]:
            pytest.fail(
                "test database is not migrated: run `pnpm --filter @kawan-pasar/api db:test:reset`"
            )
        conn.execute("TRUNCATE price_observations, ingest_runs RESTART IDENTITY CASCADE")
        conn.execute("SELECT refresh_latest_prices()")
        yield conn


@pytest.fixture
def ingest_conn(ingest_url: str, owner_conn: psycopg.Connection) -> Iterator[psycopg.Connection]:
    with psycopg.connect(ingest_url, connect_timeout=10) as conn:
        yield conn
