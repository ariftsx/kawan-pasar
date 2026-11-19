"""kp-model: write an ARIF-Net forecast bundle from a price file.

  python -m kp_model --prices <prices.csv> --out <artifacts dir> [--now 2026-11-19T03:00:00Z]

The price file (commodity_code,observed_on,price_idr) is exported by the Core API; this program
never connects to a database or the network. Exit codes: 0 written (bundle path on stdout),
2 refused input (reason on stderr), 1 any other error.
"""

from __future__ import annotations

import argparse
import sys
from datetime import UTC, datetime
from pathlib import Path

from kp_model.bundle import BundleError, read_prices_csv, write_bundle
from kp_model.calendar import HolidayCalendar
from kp_model.forecast import forecast
from kp_model.spec import ModelIntegrityError, load_spec


def _aware(value: str) -> datetime:
    """An ISO-8601 time WITH its zone: a bare local time would shift issued_at by hours."""
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        raise argparse.ArgumentTypeError("--now needs a time zone, e.g. 2026-11-19T03:00:00+00:00")
    return parsed


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="kp-model", description=__doc__.splitlines()[0])
    ap.add_argument("--prices", type=Path, required=True)
    ap.add_argument("--out", type=Path, required=True)
    ap.add_argument("--now", type=_aware, default=None, help="issue time with a zone (tests)")
    args = ap.parse_args(argv)
    try:
        spec = load_spec()
        series = read_prices_csv(args.prices, spec)
        rows = forecast(spec, series, HolidayCalendar.bundled())
        now = args.now or datetime.now(UTC)
        target = write_bundle(args.out, spec, rows, args.prices, now)
    except (BundleError, ModelIntegrityError, ValueError, OSError) as e:
        print(f"kp-model: {e}", file=sys.stderr)
        return 2
    print(target)
    return 0


if __name__ == "__main__":
    sys.exit(main())
