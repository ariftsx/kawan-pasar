"""Fase 4B task 4: a finished run becomes a candidate registration for the Core API."""

import hashlib
import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import ClassVar

import pytest

from kp_pipeline.candidate import CandidateError, build_payload, post_candidate


def _finished_run(tmp_path: Path) -> Path:
    run = tmp_path / "20261207T030000Z"
    bundle = run / "out" / "bundles" / "arifnet-2026-12-04-202612070330-1a2b3c4d"
    bundle.mkdir(parents=True)
    (bundle / "SHA256SUMS").write_bytes(b"abc  forecasts.csv\n")
    (run / "out" / "model").mkdir(parents=True)
    spec = {
        "model_version": "arifnet-a0-kp-20261207T030000Z",
        "commodities": [
            {"id": "com_14", "code": "cabai-merah-keriting"},
            {"id": "com_3", "code": "beras-medium-1"},
        ],
        "validation": {
            "overall": 0.867,
            "window": {"start": "2024-12-04", "end": "2025-12-04"},
            "by_commodity": {"com_14": {"1": 1.0, "365": 0.6309}, "com_3": {"90": 2.518}},
        },
    }
    (run / "out" / "model" / "arifnet-a0.json").write_text(json.dumps(spec), encoding="utf-8")
    state = {
        "run_id": "20261207T030000Z",
        "data_end": "2026-12-04",
        "lock": {"open": True},
        "bundle": bundle.name,
        "steps": {
            s: {"status": "ok"} for s in ("prepare", "collect", "preprocess", "prices", "train", "bundle")
        },
    }
    (run / "run.json").write_text(json.dumps(state), encoding="utf-8")
    return run


def test_builds_the_registration_from_the_run_with_product_codes(tmp_path: Path) -> None:
    run = _finished_run(tmp_path)
    payload = build_payload(run)
    assert payload == {
        "runId": "20261207T030000Z",
        "bundleId": "arifnet-2026-12-04-202612070330-1a2b3c4d",
        "bundleSha256": hashlib.sha256(b"abc  forecasts.csv\n").hexdigest(),
        "modelVersion": "arifnet-a0-kp-20261207T030000Z",
        "dataEnd": "2026-12-04",
        "lockOpen": True,
        "commodities": ["cabai-merah-keriting", "beras-medium-1"],
        "overallRelmae": 0.867,
        "scores": {"cabai-merah-keriting": {"1": 1.0, "365": 0.6309}, "beras-medium-1": {"90": 2.518}},
        "window": {"start": "2024-12-04", "end": "2025-12-04"},
    }


def test_an_unfinished_run_is_not_a_candidate(tmp_path: Path) -> None:
    run = _finished_run(tmp_path)
    state = json.loads((run / "run.json").read_text(encoding="utf-8"))
    state["steps"]["bundle"]["status"] = "failed"
    (run / "run.json").write_text(json.dumps(state), encoding="utf-8")
    with pytest.raises(CandidateError, match="bundle"):
        build_payload(run)


class _Api(BaseHTTPRequestHandler):
    seen: ClassVar[list[tuple[str, str, dict[str, object]]]] = []
    status: ClassVar[int] = 201

    def do_POST(self) -> None:
        body = json.loads(self.rfile.read(int(self.headers["content-length"])))
        _Api.seen.append((self.path, self.headers.get("x-service-token", ""), body))
        self.send_response(_Api.status)
        self.send_header("content-type", "application/json")
        self.end_headers()
        self.wfile.write(b'{"id": 7}' if _Api.status < 300 else b'{"error":{"code":"conflict"}}')

    def log_message(self, *_: object) -> None:
        return


@pytest.fixture
def api() -> object:
    server = HTTPServer(("127.0.0.1", 0), _Api)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    _Api.seen.clear()
    _Api.status = 201
    yield f"http://127.0.0.1:{server.server_port}"
    server.shutdown()


def test_posts_with_the_service_token(api: str, tmp_path: Path) -> None:
    assert post_candidate(build_payload(_finished_run(tmp_path)), api, "rahasia") == (7, True)
    path, token, body = _Api.seen[0]
    assert (path, token, body["runId"]) == ("/internal/model-candidates", "rahasia", "20261207T030000Z")


def test_an_already_registered_run_is_not_an_error(api: str, tmp_path: Path) -> None:
    # Airflow retries a task: the API answers 200 with the existing id for the same registration.
    _Api.status = 200
    assert post_candidate(build_payload(_finished_run(tmp_path)), api, "rahasia") == (7, False)


def test_a_conflicting_registration_is_an_error(api: str, tmp_path: Path) -> None:
    # Same run id with another bundle, or a bundle id of another run: never "already registered".
    _Api.status = 409
    with pytest.raises(CandidateError, match="409"):
        post_candidate(build_payload(_finished_run(tmp_path)), api, "rahasia")


def test_non_finite_scores_are_refused_before_sending(api: str, tmp_path: Path) -> None:
    payload = build_payload(_finished_run(tmp_path))
    payload["overallRelmae"] = float("nan")
    with pytest.raises(CandidateError, match="non-finite"):
        post_candidate(payload, api, "rahasia")
    assert _Api.seen == []
