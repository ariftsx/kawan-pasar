from datetime import date, datetime

from ingest.catalog import load_catalog
from ingest.pipeline import WIB, now_wib, run_ingest
from tests.fakes import FakePriceSource, raw

CATALOG = load_catalog()
RECEIVED = datetime(2026, 10, 14, 6, 35, tzinfo=WIB)
PERIOD = (date(2026, 10, 13), date(2026, 10, 14))


def test_runs_every_commodity_in_the_catalog() -> None:
    source = FakePriceSource(
        rows={
            "cabai-merah-keriting": [raw(13, 52_400), raw(14, 52_800)],
            "bawang-merah": [raw(14, 38_000)],
        }
    )
    report = run_ingest(source, CATALOG, {}, PERIOD, clock=lambda: RECEIVED)
    assert [call[0] for call in source.calls] == [c.slug for c in CATALOG]
    assert [(o.commodity, o.observed_at.day) for o in report.observations] == [
        ("cabai-merah-keriting", 13),
        ("cabai-merah-keriting", 14),
        ("bawang-merah", 14),
    ]
    # beras returned nothing: absent, never a zero price.
    assert report.failed == []


def test_one_failing_source_does_not_stop_the_others() -> None:
    source = FakePriceSource(
        rows={"beras-medium-1": [raw(14, 13_500)]}, failing={"cabai-merah-keriting"}
    )
    report = run_ingest(source, CATALOG, {}, PERIOD, clock=lambda: RECEIVED)
    assert report.failed == ["cabai-merah-keriting"]
    assert [o.commodity for o in report.observations] == ["beras-medium-1"]


def test_rejected_rows_are_reported() -> None:
    source = FakePriceSource(rows={"bawang-merah": [raw(14, 38_000, unit="ons")]})
    report = run_ingest(source, CATALOG, {}, PERIOD, clock=lambda: RECEIVED)
    assert [(r.commodity, r.reason) for r in report.rejected] == [
        ("bawang-merah", "satuan 'ons' bukan 'kg'")
    ]


def test_the_default_clock_is_wib() -> None:
    assert now_wib().utcoffset() is not None
    assert now_wib().tzinfo == WIB
