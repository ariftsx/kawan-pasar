"""PIHPS prices from the retraining pipeline (Fase 4A).

The pipeline runs ARIF-Net's own collector and preprocessing, which write prices_combined.csv in
exactly the format of the historical seed export, so PIHPS's response format (DD/MM/YYYY keys,
"40,000" prices, "-" for not reported) is interpreted in one place only: the ARIF-Net collector.
This source reads that file and labels the rows `pihps`.
"""

from collections.abc import Iterator
from datetime import date
from pathlib import Path

from kp_ingest.models import RawPriceRow
from kp_ingest.sources.base import RowError, SourceKind
from kp_ingest.sources.csv_seed import CsvSeedSource

CEILING_REASON = "observed_on: after the data ceiling (prospective-test lock)"


class PihpsSource:
    def __init__(self, path: Path, ceiling: date | None) -> None:
        self._csv = CsvSeedSource(path)
        # Latest date allowed in; None once the ARIF-Net prospective test has been opened.
        self._ceiling = ceiling

    @property
    def kind(self) -> SourceKind:
        return "pihps"

    def rows(self) -> Iterator[RawPriceRow | RowError]:
        for row in self._csv.rows():
            if (
                isinstance(row, RawPriceRow)
                and self._ceiling is not None
                and row.observed_on > self._ceiling
            ):
                # The CSV reader always sets source_line; 0 only if it ever did not.
                yield RowError(line=row.source_line or 0, reason=CEILING_REASON)
            else:
                yield row
