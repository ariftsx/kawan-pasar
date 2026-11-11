"""Validate → map to catalog → insert idempotently → record the run → refresh derived data."""

import csv
import logging
from dataclasses import dataclass
from typing import Literal

import psycopg

from kp_ingest import repository
from kp_ingest.models import RawPriceRow
from kp_ingest.repository import ObservationBatch
from kp_ingest.sources.base import PriceSource, RowError

BATCH_SIZE = 1_000

log = logging.getLogger("kp_ingest")

RunStatus = Literal["succeeded", "partial", "failed"]


@dataclass(frozen=True)
class IngestResult:
    run_id: int
    status: RunStatus
    inserted: int
    skipped: int
    rejected: int
    error: str | None = None


#: Failures that can happen while reading or writing a source. Anything else is a programming error
#: and is allowed to propagate.
_RUN_FAILURES = (psycopg.Error, ValueError, csv.Error, OSError)


def _describe(error: Exception) -> str:
    """A log/DB-safe summary. psycopg messages can echo row values, so only the SQLSTATE is kept."""
    if isinstance(error, psycopg.Error):
        return f"{type(error).__name__}: {error.sqlstate or 'no sqlstate'}"
    return f"{type(error).__name__}: {str(error)[:200]}"


def run_ingest(
    source: PriceSource, conn: psycopg.Connection, market_code: str = "PIKJ"
) -> IngestResult:
    market = repository.market_id(conn, market_code)
    if market is None:
        raise ValueError(f"unknown market code: {market_code}")
    commodities = repository.commodity_ids_by_ref(conn)

    run_id = repository.start_run(conn, source.kind)
    conn.commit()  # the run row must survive a later rollback

    inserted = skipped = rejected = 0
    batch = ObservationBatch([], [], [])

    def flush() -> None:
        nonlocal inserted, skipped, batch
        if not batch.prices:
            return
        with conn.transaction():
            added = repository.insert_batch(
                conn, market=market, kind=source.kind, run_id=run_id, batch=batch
            )
        inserted += added
        skipped += len(batch.prices) - added
        batch = ObservationBatch([], [], [])

    try:
        for item in source.rows():
            if isinstance(item, RowError):
                rejected += 1
                log.warning("row rejected: line %d: %s", item.line, item.reason)
                continue
            commodity = commodities.get(item.source_ref)
            if commodity is None:
                rejected += 1
                log.warning("row rejected: unknown commodity ref %s", item.source_ref)
                continue
            _append(batch, commodity, item)
            if len(batch.prices) >= BATCH_SIZE:
                flush()
        flush()
    except _RUN_FAILURES as error:
        conn.rollback()
        summary = _describe(error)
        # Summary only: a traceback could carry row data into the logs.
        log.error("ingest run %d failed: %s", run_id, summary)  # noqa: TRY400
        _finish(conn, run_id, "failed", inserted, skipped, rejected, summary)
        # Batches committed before the failure are real data: keep the derived view in sync.
        _refresh(conn, run_id)
        return IngestResult(run_id, "failed", inserted, skipped, rejected, summary)

    status: RunStatus = "partial" if rejected else "succeeded"
    _finish(conn, run_id, status, inserted, skipped, rejected, None)
    refresh_error = _refresh(conn, run_id)
    return IngestResult(run_id, status, inserted, skipped, rejected, refresh_error)


def _finish(
    conn: psycopg.Connection,
    run_id: int,
    status: RunStatus,
    inserted: int,
    skipped: int,
    rejected: int,
    error: str | None,
) -> None:
    """Closes the run in its own commit, so a later failure can never leave it 'running'."""
    repository.finish_run(
        conn,
        run_id,
        status=status,
        inserted=inserted,
        skipped=skipped,
        rejected=rejected,
        error=error,
    )
    conn.commit()


def _refresh(conn: psycopg.Connection, run_id: int) -> str | None:
    """Refreshes mv_latest_prices; on failure records it on the run and returns the reason."""
    try:
        repository.refresh_latest_prices(conn)
        conn.commit()
    except psycopg.Error as error:
        conn.rollback()
        reason = f"latest-price refresh failed: {_describe(error)}"
        log.error("ingest run %d: %s", run_id, reason)  # noqa: TRY400
        repository.set_run_error(conn, run_id, reason)
        conn.commit()
        return reason
    return None


def _append(batch: ObservationBatch, commodity_id: int, row: RawPriceRow) -> None:
    batch.commodity_ids.append(commodity_id)
    batch.dates.append(row.observed_on)
    batch.prices.append(row.price_idr)
