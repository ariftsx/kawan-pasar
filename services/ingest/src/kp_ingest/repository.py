"""All SQL used by the ingest service. Every statement is parameterised."""

from dataclasses import dataclass
from datetime import date

import psycopg

from kp_ingest.sources.base import SourceKind


@dataclass(frozen=True)
class ObservationBatch:
    commodity_ids: list[int]
    dates: list[date]
    prices: list[int]


def market_id(conn: psycopg.Connection, code: str) -> int | None:
    row = conn.execute("SELECT id FROM markets WHERE code = %s", (code,)).fetchone()
    return None if row is None else int(row[0])


def commodity_ids_by_ref(conn: psycopg.Connection) -> dict[str, int]:
    rows = conn.execute(
        "SELECT source_ref, id FROM commodities WHERE source_ref IS NOT NULL"
    ).fetchall()
    return {str(ref): int(cid) for ref, cid in rows}


def start_run(conn: psycopg.Connection, kind: SourceKind) -> int:
    row = conn.execute(
        "INSERT INTO ingest_runs (source, status) VALUES (%s, 'running') RETURNING id", (kind,)
    ).fetchone()
    if row is None:  # pragma: no cover - RETURNING always yields a row
        raise RuntimeError("ingest run was not created")
    return int(row[0])


def finish_run(
    conn: psycopg.Connection,
    run_id: int,
    *,
    status: str,
    inserted: int,
    skipped: int,
    rejected: int,
    error: str | None,
) -> None:
    conn.execute(
        """UPDATE ingest_runs
           SET status = %s, rows_inserted = %s, rows_skipped = %s, rows_rejected = %s,
               error = %s, finished_at = now()
           WHERE id = %s""",
        (status, inserted, skipped, rejected, error, run_id),
    )


def set_run_error(conn: psycopg.Connection, run_id: int, error: str) -> None:
    """Appends a note to an already finished run (e.g. a failed view refresh)."""
    conn.execute(
        "UPDATE ingest_runs SET error = concat_ws('; ', error, %s::text) WHERE id = %s",
        (error, run_id),
    )


def insert_batch(
    conn: psycopg.Connection, *, market: int, kind: SourceKind, run_id: int, batch: ObservationBatch
) -> int:
    """Inserts one batch in a single statement; existing (market, commodity, day) rows are kept.

    Returns the number of rows actually inserted.
    """
    cursor = conn.execute(
        """INSERT INTO price_observations
             (market_id, commodity_id, observed_on, price_idr, source, ingest_run_id)
           SELECT %s, c, d, p, %s, %s
           FROM unnest(%s::smallint[], %s::date[], %s::integer[]) AS t(c, d, p)
           ON CONFLICT DO NOTHING""",
        (market, kind, run_id, batch.commodity_ids, batch.dates, batch.prices),
    )
    return cursor.rowcount


def refresh_latest_prices(conn: psycopg.Connection) -> None:
    conn.execute("SELECT refresh_latest_prices()")
