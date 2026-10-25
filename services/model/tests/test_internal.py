import time
from collections.abc import Iterator
from pathlib import Path

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.config import Settings
from app.core.security import sign
from app.main import create_app
from tests.conftest import SECRET


def signed(client: TestClient, method: str, path: str) -> httpx.Response:
    timestamp = str(int(time.time()))
    signature = sign(SECRET.encode(), timestamp, method, path, b"")
    headers = {"x-kp-timestamp": timestamp, "x-kp-signature": signature}
    return client.request(method, path, headers=headers)


@pytest.fixture
def demo_client(settings: Settings) -> Iterator[TestClient]:
    with TestClient(create_app(settings)) as client:
        yield client


@pytest.fixture
def live_client(tmp_path: Path) -> Iterator[TestClient]:
    settings = Settings(
        model_hmac_secret=SECRET,  # pyright: ignore[reportArgumentType]
        outlook_mode="live",
        artifacts_dir=tmp_path,
    )
    with TestClient(create_app(settings)) as client:
        yield client


def test_development_mode_serves_the_labelled_demo(demo_client: TestClient) -> None:
    assert demo_client.get("/readyz").json()["outlook"] == "in_development"
    body = signed(demo_client, "GET", "/internal/forecasts/cabai-merah-keriting").json()
    assert body["outlook_status"] == "in_development"
    assert body["provenance"]["model_version"] == "demo"
    assert body["provenance"]["artifact_status"] == "draft"
    assert "DATA DEMO — bukan hasil model." in body["limitations"]
    assert body["data"]["reference_price_idr"] == 52400
    assert body["availability"]["climate"] == "missing"


def test_forecasts_require_a_signature(demo_client: TestClient) -> None:
    response = demo_client.get("/internal/forecasts/cabai-merah-keriting")
    assert response.status_code == 401


def test_origin_must_match_the_served_run(demo_client: TestClient) -> None:
    matching = signed(demo_client, "GET", "/internal/forecasts/bawang-merah?origin=2026-10-18")
    assert matching.status_code == 200
    other = signed(demo_client, "GET", "/internal/forecasts/bawang-merah?origin=2026-10-11")
    assert other.status_code == 503
    assert other.json()["error"]["code"] == "FORECAST_UNAVAILABLE"


def test_unknown_commodity_is_not_found(demo_client: TestClient) -> None:
    response = signed(demo_client, "GET", "/internal/forecasts/daging-ayam-ras")
    assert response.status_code == 404
    assert response.json()["error"]["code"] == "ARTIFACT_NOT_FOUND"


def test_manifest_and_reload(demo_client: TestClient) -> None:
    manifest = signed(demo_client, "GET", "/internal/artifacts/manifest").json()
    assert manifest["data"]["bundle_id"] == "demo__2026-10-18"
    reloaded = signed(demo_client, "POST", "/internal/artifacts/reload").json()
    assert reloaded == {
        "data": {"bundle_id": "demo__2026-10-18"},
        "outlook_status": "in_development",
    }


def test_live_mode_without_a_bundle_stays_ready(live_client: TestClient) -> None:
    assert live_client.get("/readyz").json() == {"status": "ok", "outlook": "missing"}
    forecast = signed(live_client, "GET", "/internal/forecasts/cabai-merah-keriting")
    assert forecast.json()["error"]["code"] == "FORECAST_UNAVAILABLE"
    assert signed(live_client, "GET", "/internal/artifacts/manifest").status_code == 503


def test_failed_reload_reports_the_reason(live_client: TestClient) -> None:
    response = signed(live_client, "POST", "/internal/artifacts/reload")
    assert response.status_code == 422
    assert response.json()["error"]["code"] == "SCHEMA_INVALID"
    assert "manifest.json" in response.json()["error"]["message"]
