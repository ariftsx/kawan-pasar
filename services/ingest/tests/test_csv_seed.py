from pathlib import Path

import pytest

from kp_ingest.models import RawPriceRow
from kp_ingest.sources.base import RowError
from kp_ingest.sources.csv_seed import CsvSeedSource

FIXTURES = Path(__file__).parent / "fixtures"


def test_reads_windows_csv_with_bom_and_crlf() -> None:
    rows = list(CsvSeedSource(FIXTURES / "bom_crlf.csv").rows())
    assert all(isinstance(r, RawPriceRow) for r in rows)
    parsed = [r for r in rows if isinstance(r, RawPriceRow)]
    assert [r.source_ref for r in parsed] == ["com_14", "com_11", "com_3"]
    assert [r.price_idr for r in parsed] == [40000, 30000, 12000]


def test_rejects_a_header_missing_required_columns() -> None:
    with pytest.raises(ValueError, match="comcat_id") as info:
        list(CsvSeedSource(FIXTURES / "bad_header.csv").rows())
    assert "price" in str(info.value)


def test_reports_bad_rows_with_their_physical_line_numbers() -> None:
    rows = list(CsvSeedSource(FIXTURES / "bad_rows.csv").rows())
    errors = [r for r in rows if isinstance(r, RowError)]
    # header is line 1; line 3 (unknown ref) is valid here — the catalog check is in the pipeline
    assert [e.line for e in errors] == [4, 5, 6, 7, 8]
    assert all(e.reason for e in errors)
    assert sum(isinstance(r, RawPriceRow) for r in rows) == 3


def test_error_reason_never_contains_the_raw_row() -> None:
    errors = [r for r in CsvSeedSource(FIXTURES / "bad_rows.csv").rows() if isinstance(r, RowError)]
    assert all("Bawang" not in e.reason for e in errors)


def test_source_kind_is_seed_csv() -> None:
    assert CsvSeedSource(FIXTURES / "small.csv").kind == "seed_csv"
