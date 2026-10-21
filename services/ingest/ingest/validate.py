"""Product-side validation of fetched prices (docs 13 §A5, docs 05 §4.1).

Rows that are malformed are rejected. Rows that are well-formed but implausible are kept as
`quarantined`, so an operator can review them; only `valid` rows are ever published.
"""

from collections.abc import Iterable, Sequence
from datetime import date, datetime, timedelta
from statistics import median

from ingest.models import Commodity, PriceObservation, RawPrice, Rejected

# A value further than ±60% from the median of the previous 7 days is quarantined.
OUTLIER_RATIO = 0.6
MEDIAN_WINDOW = timedelta(days=7)


def _reference_median(history: Sequence[PriceObservation], day: date) -> float | None:
    """Median of valid prices in the 7 calendar days before `day`; None when there are none."""
    window = [
        row.price_idr
        for row in history
        if row.status == "valid" and day - MEDIAN_WINDOW <= row.observed_at < day
    ]
    return median(window) if window else None


def _reject_reason(row: RawPrice, commodity: Commodity, today: date) -> str | None:
    if row.unit != commodity.unit:
        return f"satuan {row.unit!r} bukan {commodity.unit!r}"
    if row.price_idr <= 0:
        return "harga harus lebih dari 0"
    if row.observed_at > today:
        return "tanggal observasi di masa depan"
    return None


def validate_rows(
    commodity: Commodity,
    rows: Iterable[RawPrice],
    history: Sequence[PriceObservation],
    received_at: datetime,
) -> tuple[list[PriceObservation], list[Rejected]]:
    """Validates one commodity's rows in date order; each accepted row joins the history.

    Missing days are never filled: no zeros and no interpolation (docs 05 §4.1).
    """
    accepted: list[PriceObservation] = []
    rejected: list[Rejected] = []
    seen = {row.observed_at for row in history}
    today = received_at.date()
    for row in sorted(rows, key=lambda r: r.observed_at):
        reason = _reject_reason(row, commodity, today)
        if reason is None and row.observed_at in seen:
            reason = "tanggal observasi ganda"
        if reason is not None:
            rejected.append(
                Rejected(commodity=commodity.slug, observed_at=row.observed_at, reason=reason)
            )
            continue
        reference = _reference_median([*history, *accepted], row.observed_at)
        is_outlier = reference is not None and abs(row.price_idr / reference - 1) > OUTLIER_RATIO
        accepted.append(
            PriceObservation(
                commodity=commodity.slug,
                market=commodity.market,
                observed_at=row.observed_at,
                available_at=received_at,
                price_idr=row.price_idr,
                unit=commodity.unit,
                status="quarantined" if is_outlier else "valid",
            )
        )
        seen.add(row.observed_at)
    return accepted, rejected
