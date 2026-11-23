import json
import threading
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from typing import ClassVar

import psycopg
import pytest

from kp_ingest.__main__ import main

FIXTURES = Path(__file__).parent / "fixtures"


def test_import_csv_prints_a_json_summary(
    ingest_url: str,
    owner_conn: psycopg.Connection,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("INGEST_DATABASE_URL", ingest_url)
    code = main(["import-csv", "--file", str(FIXTURES / "small.csv")])
    out = capsys.readouterr().out
    assert code == 0
    summary = json.loads(out)
    assert summary["status"] == "succeeded"
    assert summary["inserted"] == 10
    assert "postgres://" not in out


def test_partial_import_exits_with_code_2(
    ingest_url: str,
    owner_conn: psycopg.Connection,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("INGEST_DATABASE_URL", ingest_url)
    assert main(["import-csv", "--file", str(FIXTURES / "bad_rows.csv")]) == 2
    assert json.loads(capsys.readouterr().out)["rejected"] == 6


def test_missing_database_url_is_reported_by_name(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.delenv("INGEST_DATABASE_URL", raising=False)
    assert main(["import-csv", "--file", str(FIXTURES / "small.csv")]) == 1
    assert "INGEST_DATABASE_URL" in capsys.readouterr().err


def test_missing_file_is_reported(
    ingest_url: str, monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    monkeypatch.setenv("INGEST_DATABASE_URL", ingest_url)
    assert main(["import-csv", "--file", str(FIXTURES / "nope.csv")]) == 1
    assert "nope.csv" in capsys.readouterr().err


def test_unknown_market_fails_without_leaking_the_connection_url(
    ingest_url: str,
    owner_conn: psycopg.Connection,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("INGEST_DATABASE_URL", ingest_url)
    assert main(["import-csv", "--file", str(FIXTURES / "small.csv"), "--market", "XXXX"]) == 1
    captured = capsys.readouterr()
    assert "ValueError" in captured.err
    assert "postgres://" not in captured.err + captured.out


def test_connection_uses_a_timeout_so_it_never_hangs(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    seen: dict[str, object] = {}

    def fake_connect(url: str, **kwargs: object) -> None:
        seen.update(kwargs)
        raise psycopg.OperationalError("unreachable")

    monkeypatch.setenv("INGEST_DATABASE_URL", "postgres://u:secret@127.0.0.1:1/db")
    monkeypatch.setattr("kp_ingest.__main__.psycopg.connect", fake_connect)
    assert main(["import-csv", "--file", str(FIXTURES / "small.csv")]) == 1
    assert seen.get("connect_timeout") == 10
    assert "secret" not in capsys.readouterr().err


def test_a_bad_header_is_explained_to_the_operator(
    ingest_url: str,
    owner_conn: psycopg.Connection,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("INGEST_DATABASE_URL", ingest_url)
    assert main(["import-csv", "--file", str(FIXTURES / "bad_header.csv")]) == 1
    captured = capsys.readouterr()
    assert "comcat_id" in captured.out + captured.err


class _InvalidateHandler(BaseHTTPRequestHandler):
    calls: ClassVar[list[tuple[str, str | None, bytes]]] = []

    def do_POST(self) -> None:
        length = int(self.headers.get("Content-Length", "0"))
        self.calls.append((self.path, self.headers.get("x-service-token"), self.rfile.read(length)))
        body = b'{"deleted": 3}'
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def log_message(self, format: str, *args: object) -> None:  # noqa: A002
        return


def test_successful_import_invalidates_the_api_price_cache(
    ingest_url: str,
    owner_conn: psycopg.Connection,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    _InvalidateHandler.calls = []
    server = HTTPServer(("127.0.0.1", 0), _InvalidateHandler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        monkeypatch.setenv("INGEST_DATABASE_URL", ingest_url)
        monkeypatch.setenv("API_INTERNAL_URL", f"http://127.0.0.1:{server.server_port}")
        monkeypatch.setenv("SERVICE_TOKEN", "t" * 40)
        assert main(["import-csv", "--file", str(FIXTURES / "small.csv")]) == 0
    finally:
        server.shutdown()
    assert _InvalidateHandler.calls == [
        ("/internal/cache/invalidate", "t" * 40, b'{"scope": "prices"}')
    ]
    capsys.readouterr()


def test_an_unreachable_api_does_not_fail_the_import(
    ingest_url: str,
    owner_conn: psycopg.Connection,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    monkeypatch.setenv("INGEST_DATABASE_URL", ingest_url)
    monkeypatch.setenv("API_INTERNAL_URL", "http://127.0.0.1:1")
    monkeypatch.setenv("SERVICE_TOKEN", "t" * 40)
    assert main(["import-csv", "--file", str(FIXTURES / "small.csv")]) == 0
    assert "t" * 40 not in capsys.readouterr().err


def test_import_pihps_labels_rows_and_honours_the_ceiling(
    ingest_url: str,
    owner_conn: psycopg.Connection,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
    tmp_path: Path,
) -> None:
    monkeypatch.setenv("INGEST_DATABASE_URL", ingest_url)
    path = tmp_path / "prices_combined.csv"
    path.write_text(
        "comcat_id,commodity,date,price\n"
        "com_14,Cabai Merah Keriting,2026-09-30,63000\n"
        "com_14,Cabai Merah Keriting,2026-10-01,64000\n",
        encoding="utf-8",
    )
    code = main(["import-pihps", "--file", str(path), "--ceiling", "2026-09-30"])
    summary = json.loads(capsys.readouterr().out)
    assert code == 2
    assert (summary["inserted"], summary["rejected"]) == (1, 1)
    with owner_conn.cursor() as cur:
        cur.execute("SELECT source FROM ingest_runs ORDER BY id DESC LIMIT 1")
        assert cur.fetchone() == ("pihps",)
        cur.execute("SELECT source FROM price_observations WHERE observed_on = '2026-09-30'")
        assert ("pihps",) in cur.fetchall()


def test_import_pihps_requires_an_explicit_ceiling_choice(
    monkeypatch: pytest.MonkeyPatch, tmp_path: Path, ingest_url: str
) -> None:
    # No silent default: the caller states the lock's ceiling, or "none" once it is open.
    monkeypatch.setenv("INGEST_DATABASE_URL", ingest_url)
    path = tmp_path / "p.csv"
    path.write_text("comcat_id,commodity,date,price\n", encoding="utf-8")
    with pytest.raises(SystemExit):
        main(["import-pihps", "--file", str(path)])
