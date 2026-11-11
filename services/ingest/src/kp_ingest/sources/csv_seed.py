"""Reads the team's historical PIHPS export (`data/seed/prices_combined.csv`)."""

import csv
from collections.abc import Iterator
from pathlib import Path

from pydantic import ValidationError

from kp_ingest.models import RawPriceRow
from kp_ingest.sources.base import RowError, SourceKind

REQUIRED_COLUMNS = ("comcat_id", "commodity", "date", "price")


def _reason(error: ValidationError) -> str:
    # Field names and messages only: pydantic's str(error) would include the raw input value.
    return "; ".join(
        f"{'.'.join(str(p) for p in issue['loc'])}: {issue['msg']}" for issue in error.errors()
    )


class CsvSeedSource:
    def __init__(self, path: Path) -> None:
        self._path = path

    @property
    def kind(self) -> SourceKind:
        return "seed_csv"

    def rows(self) -> Iterator[RawPriceRow | RowError]:
        # utf-8-sig drops a BOM; newline="" lets the csv module handle CRLF itself.
        with self._path.open(encoding="utf-8-sig", newline="") as handle:
            reader = csv.DictReader(handle)
            header = [name.strip() for name in reader.fieldnames or []]
            missing = [c for c in REQUIRED_COLUMNS if c not in header]
            if missing:
                raise ValueError(f"CSV header is missing required columns: {', '.join(missing)}")
            reader.fieldnames = header
            for record in reader:
                try:
                    yield RawPriceRow.model_validate(
                        {
                            "source_ref": record["comcat_id"],
                            "commodity_name": record["commodity"],
                            "observed_on": (record["date"] or "").strip(),
                            "price_idr": record["price"],
                        }
                    )
                except ValidationError as error:
                    yield RowError(line=reader.line_num, reason=_reason(error))
