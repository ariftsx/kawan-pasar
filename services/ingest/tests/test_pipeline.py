from pathlib import Path

import psycopg
import pytest

from kp_ingest.pipeline import run_ingest
from kp_ingest.sources.csv_seed import CsvSeedSource

FIXTURES = Path(__file__).parent / "fixtures"


def test_imports_valid_rows_and_records_the_run(
    ingest_conn: psycopg.Connection, owner_conn: psycopg.Connection
) -> None:
    result = run_ingest(CsvSeedSource(FIXTURES / "small.csv"), ingest_conn)
    assert (result.status, result.inserted, result.skipped, result.rejected) == (
        "succeeded",
        10,
        0,
        0,
    )

    run = owner_conn.execute(
        "SELECT status, rows_inserted, rows_skipped, rows_rejected, finished_at IS NOT NULL, source"
        " FROM ingest_runs WHERE id = %s",
        (result.run_id,),
    ).fetchone()
    assert run == ("succeeded", 10, 0, 0, True, "seed_csv")

    linked = owner_conn.execute(
        "SELECT count(*) FROM price_observations WHERE ingest_run_id = %s", (result.run_id,)
    ).fetchone()
    assert linked == (10,)


def test_reimport_is_idempotent(
    ingest_conn: psycopg.Connection, owner_conn: psycopg.Connection
) -> None:
    run_ingest(CsvSeedSource(FIXTURES / "small.csv"), ingest_conn)
    again = run_ingest(CsvSeedSource(FIXTURES / "small.csv"), ingest_conn)
    assert (again.status, again.inserted, again.skipped) == ("succeeded", 0, 10)
    assert owner_conn.execute("SELECT count(*) FROM price_observations").fetchone() == (10,)


def test_bad_rows_are_rejected_and_never_stored_as_zero(
    ingest_conn: psycopg.Connection, owner_conn: psycopg.Connection
) -> None:
    result = run_ingest(CsvSeedSource(FIXTURES / "bad_rows.csv"), ingest_conn)
    # 2 valid rows; 6 rejected: unknown commodity, 'abc', empty, 0, 16100.5, 2026-02-30
    assert (result.status, result.inserted, result.rejected) == ("partial", 2, 6)
    assert owner_conn.execute("SELECT count(*) FROM price_observations").fetchone() == (2,)
    assert owner_conn.execute(
        "SELECT count(*) FROM price_observations WHERE price_idr <= 0"
    ).fetchone() == (0,)
    run = owner_conn.execute(
        "SELECT status, rows_rejected FROM ingest_runs WHERE id = %s", (result.run_id,)
    ).fetchone()
    assert run == ("partial", 6)


def test_refreshes_the_latest_price_view(
    ingest_conn: psycopg.Connection, owner_conn: psycopg.Connection
) -> None:
    run_ingest(CsvSeedSource(FIXTURES / "small.csv"), ingest_conn)
    latest = owner_conn.execute(
        "SELECT c.code, to_char(v.observed_on, 'YYYY-MM-DD'), v.price_idr"
        " FROM mv_latest_prices v JOIN commodities c ON c.id = v.commodity_id ORDER BY c.sort_order"
    ).fetchall()
    assert latest == [
        ("cabai-merah-keriting", "2026-09-26", 52600),
        ("bawang-merah", "2026-09-26", 32600),
    ]


def test_unknown_market_is_refused_before_any_write(
    ingest_conn: psycopg.Connection, owner_conn: psycopg.Connection
) -> None:
    with pytest.raises(ValueError, match="XXXX"):
        run_ingest(CsvSeedSource(FIXTURES / "small.csv"), ingest_conn, market_code="XXXX")
    assert owner_conn.execute("SELECT count(*) FROM ingest_runs").fetchone() == (0,)


def test_a_database_failure_marks_the_run_failed_and_keeps_it_recorded(
    ingest_conn: psycopg.Connection, owner_conn: psycopg.Connection
) -> None:
    # Revoke the insert right mid-flight: the batch must roll back but the run row must survive.
    owner_conn.execute("REVOKE INSERT ON price_observations FROM ingest_w")
    try:
        result = run_ingest(CsvSeedSource(FIXTURES / "small.csv"), ingest_conn)
    finally:
        owner_conn.execute("GRANT INSERT ON price_observations TO ingest_w")
    assert (result.status, result.inserted) == ("failed", 0)
    run = owner_conn.execute(
        "SELECT status, error IS NOT NULL FROM ingest_runs WHERE id = %s", (result.run_id,)
    ).fetchone()
    assert run == ("failed", True)
    assert owner_conn.execute("SELECT count(*) FROM price_observations").fetchone() == (0,)


def test_imports_across_several_batches(
    ingest_conn: psycopg.Connection, owner_conn: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("kp_ingest.pipeline.BATCH_SIZE", 3)
    result = run_ingest(CsvSeedSource(FIXTURES / "small.csv"), ingest_conn)
    assert (result.status, result.inserted, result.skipped) == ("succeeded", 10, 0)
    assert owner_conn.execute("SELECT count(*) FROM price_observations").fetchone() == (10,)


def test_a_bad_header_finishes_the_run_as_failed_with_the_reason(
    ingest_conn: psycopg.Connection, owner_conn: psycopg.Connection
) -> None:
    result = run_ingest(CsvSeedSource(FIXTURES / "bad_header.csv"), ingest_conn)
    assert result.status == "failed"
    assert result.error is not None and "comcat_id" in result.error
    run = owner_conn.execute(
        "SELECT status, finished_at IS NOT NULL, error FROM ingest_runs WHERE id = %s",
        (result.run_id,),
    ).fetchone()
    assert run is not None and run[:2] == ("failed", True) and "comcat_id" in str(run[2])


def test_an_undecodable_file_fails_the_run_and_keeps_the_view_in_sync(
    ingest_conn: psycopg.Connection, owner_conn: psycopg.Connection, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr("kp_ingest.pipeline.BATCH_SIZE", 1)
    result = run_ingest(CsvSeedSource(FIXTURES / "cp1252.csv"), ingest_conn)
    assert result.status == "failed"
    stored = owner_conn.execute("SELECT count(*) FROM price_observations").fetchone()
    run = owner_conn.execute(
        "SELECT status, finished_at IS NOT NULL FROM ingest_runs WHERE id = %s", (result.run_id,)
    ).fetchone()
    assert run == ("failed", True)
    # Rows committed before the failure must be visible in the derived view too.
    latest = owner_conn.execute("SELECT count(*) FROM mv_latest_prices").fetchone()
    assert stored is not None and stored[0] >= 1
    assert latest == (1,)


def test_a_refresh_failure_still_finishes_the_run(
    ingest_conn: psycopg.Connection, owner_conn: psycopg.Connection
) -> None:
    owner_conn.execute("REVOKE EXECUTE ON FUNCTION refresh_latest_prices() FROM ingest_w")
    try:
        result = run_ingest(CsvSeedSource(FIXTURES / "small.csv"), ingest_conn)
    finally:
        owner_conn.execute("GRANT EXECUTE ON FUNCTION refresh_latest_prices() TO ingest_w")
    run = owner_conn.execute(
        "SELECT status, finished_at IS NOT NULL, error FROM ingest_runs WHERE id = %s",
        (result.run_id,),
    ).fetchone()
    assert run is not None and run[:2] == ("succeeded", True) and "refresh" in str(run[2])
    assert result.inserted == 10


def test_unknown_commodity_rejections_carry_their_line_number(
    ingest_conn: psycopg.Connection,
    owner_conn: psycopg.Connection,
    caplog: pytest.LogCaptureFixture,
) -> None:
    with caplog.at_level("WARNING", logger="kp_ingest"):
        run_ingest(CsvSeedSource(FIXTURES / "bad_rows.csv"), ingest_conn)
    assert any("line 3" in r.getMessage() and "com_99" in r.getMessage() for r in caplog.records)
