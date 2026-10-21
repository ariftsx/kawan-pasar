from datetime import date, datetime

from ingest.catalog import load_catalog
from ingest.models import PriceObservation
from ingest.pipeline import WIB
from ingest.validate import validate_rows
from tests.fakes import raw

CABAI = load_catalog()[0]
RECEIVED = datetime(2026, 10, 14, 6, 35, tzinfo=WIB)


def observed(day: int, price: int, status: str = "valid") -> PriceObservation:
    return PriceObservation.model_validate(
        {
            "commodity": CABAI.slug,
            "market": "PIKJ",
            "observed_at": date(2026, 10, day),
            "available_at": RECEIVED,
            "price_idr": price,
            "unit": "kg",
            "status": status,
        }
    )


def test_accepts_rows_and_records_when_they_arrived() -> None:
    accepted, rejected = validate_rows(CABAI, [raw(13, 52_400), raw(12, 51_000)], [], RECEIVED)
    assert rejected == []
    assert [o.observed_at.day for o in accepted] == [12, 13]
    assert {o.available_at for o in accepted} == {RECEIVED}
    assert {o.status for o in accepted} == {"valid"}


def test_rejects_malformed_rows_with_reasons() -> None:
    rows = [raw(13, 52_400, unit="ons"), raw(12, 0), raw(15, 52_000)]
    accepted, rejected = validate_rows(CABAI, rows, [], RECEIVED)
    assert accepted == []
    assert [r.reason for r in rejected] == [
        "harga harus lebih dari 0",
        "satuan 'ons' bukan 'kg'",
        "tanggal observasi di masa depan",
    ]


def test_rejects_a_day_that_already_exists() -> None:
    _, rejected = validate_rows(CABAI, [raw(13, 52_400)], [observed(13, 52_000)], RECEIVED)
    assert [r.reason for r in rejected] == ["tanggal observasi ganda"]


def test_quarantines_a_jump_beyond_60_percent_of_the_7_day_median() -> None:
    history = [observed(day, 50_000) for day in range(6, 13)]
    accepted, _ = validate_rows(CABAI, [raw(13, 81_000), raw(14, 79_000)], history, RECEIVED)
    assert [(o.observed_at.day, o.status) for o in accepted] == [(13, "quarantined"), (14, "valid")]


def test_quarantined_rows_never_shift_the_median() -> None:
    history = [observed(10, 50_000), observed(11, 200_000, status="quarantined")]
    accepted, _ = validate_rows(CABAI, [raw(12, 79_000)], history, RECEIVED)
    assert accepted[0].status == "valid"


def test_rows_older_than_the_window_do_not_count() -> None:
    accepted, _ = validate_rows(CABAI, [raw(13, 90_000)], [observed(5, 50_000)], RECEIVED)
    # No valid price in the 7 days before: nothing to compare with, so the row stays valid.
    assert accepted[0].status == "valid"


def test_missing_days_are_not_filled() -> None:
    accepted, _ = validate_rows(CABAI, [raw(10, 50_000), raw(13, 51_000)], [], RECEIVED)
    assert [o.observed_at.day for o in accepted] == [10, 13]
