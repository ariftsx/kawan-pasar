"""CLI: `python -m kp_ingest import-csv --file <path> [--market PIKJ]`.

Exit codes: 0 succeeded, 2 partial (some rows rejected), 1 failed or bad invocation.
"""

import argparse
import json
import logging
import os
import sys
from dataclasses import asdict
from pathlib import Path

import psycopg

from kp_ingest.api_client import invalidate_price_cache
from kp_ingest.pipeline import run_ingest
from kp_ingest.sources.csv_seed import CsvSeedSource

EXIT = {"succeeded": 0, "partial": 2, "failed": 1}

#: Seconds to wait for a connection. Without it an unreachable database hangs the job forever.
CONNECT_TIMEOUT_S = 10


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="kp_ingest")
    sub = parser.add_subparsers(dest="command", required=True)
    csv_cmd = sub.add_parser("import-csv", help="import the historical PIHPS CSV export")
    csv_cmd.add_argument("--file", required=True, type=Path)
    csv_cmd.add_argument("--market", default="PIKJ")
    return parser


def main(argv: list[str] | None = None) -> int:
    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s")
    args = _parser().parse_args(argv)

    url = os.environ.get("INGEST_DATABASE_URL", "")
    if not url:
        print("missing env INGEST_DATABASE_URL", file=sys.stderr)
        return 1
    path: Path = args.file
    if not path.is_file():
        print(f"file not found: {path.name}", file=sys.stderr)
        return 1

    try:
        with psycopg.connect(
            url, application_name="kawan-pasar-ingest", connect_timeout=CONNECT_TIMEOUT_S
        ) as conn:
            result = run_ingest(CsvSeedSource(path), conn, market_code=args.market)
    except psycopg.Error as error:
        # psycopg connection errors can echo the URL (with its password): report the class only.
        print(f"ingest failed: {type(error).__name__}", file=sys.stderr)
        return 1
    except ValueError as error:
        # Raised before any run exists (e.g. unknown market); the message holds no secrets.
        print(f"ingest failed: {type(error).__name__}: {error}", file=sys.stderr)
        return 1

    print(json.dumps(asdict(result)))
    api_url = os.environ.get("API_INTERNAL_URL", "")
    token = os.environ.get("SERVICE_TOKEN", "")
    if result.status != "failed" and api_url and token:
        invalidate_price_cache(api_url, token)
    return EXIT[result.status]


if __name__ == "__main__":
    sys.exit(main())
