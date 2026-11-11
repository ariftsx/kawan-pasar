from datetime import date, timedelta

import pytest
from pydantic import ValidationError

from kp_ingest.models import RawPriceRow, today_wib


def row(price: str, observed_on: str = "2026-09-30") -> RawPriceRow:
    return RawPriceRow.model_validate(
        {
            "source_ref": "com_14",
            "commodity_name": "Cabai Merah Keriting",
            "observed_on": observed_on,
            "price_idr": price,
        }
    )


@pytest.mark.parametrize(
    ("raw", "expected"), [("40000.0", 40000), (" 52400 ", 52400), ("12000", 12000)]
)
def test_accepts_whole_rupiah_written_as_integer_or_float(raw: str, expected: int) -> None:
    assert row(raw).price_idr == expected


@pytest.mark.parametrize("raw", ["40000.5", "0", "-1", "abc", "", "1e9", "NaN", "inf"])
def test_rejects_prices_that_are_not_positive_whole_rupiah(raw: str) -> None:
    with pytest.raises(ValidationError):
        row(raw)


def test_rejects_implausibly_large_prices() -> None:
    with pytest.raises(ValidationError):
        row("10000001")


def test_rejects_observation_dates_in_the_future_wib() -> None:
    tomorrow = today_wib() + timedelta(days=1)
    with pytest.raises(ValidationError):
        row("40000", tomorrow.isoformat())


def test_accepts_today_wib() -> None:
    assert row("40000", today_wib().isoformat()).observed_on == today_wib()


def test_strips_text_fields() -> None:
    parsed = RawPriceRow.model_validate(
        {
            "source_ref": " com_11 ",
            "commodity_name": " Bawang ",
            "observed_on": "2019-01-02",
            "price_idr": "1000",
        }
    )
    assert parsed.source_ref == "com_11"
    assert parsed.commodity_name == "Bawang"
    assert parsed.observed_on == date(2019, 1, 2)


@pytest.mark.parametrize(
    "raw", ["40.000", "1.250.000", "1e4", " 4e1 ", "40_000", "99", "+400", "40,000"]
)
def test_rejects_locale_separators_exponents_and_implausibly_low_prices(raw: str) -> None:
    with pytest.raises(ValidationError):
        row(raw)


def test_accepts_trailing_zero_decimals() -> None:
    assert row("40000.00").price_idr == 40000


@pytest.mark.parametrize(
    "raw", ["1727654400", "1900-01-01", "2026-9-3", "30/09/2026", "2026-09-30T00:00"]
)
def test_rejects_dates_that_are_not_strict_iso_days_in_range(raw: str) -> None:
    with pytest.raises(ValidationError):
        row("40000", raw)
