"""In-memory price source for tests (docs 20 PR 09). It is never wired into a real run."""

from dataclasses import dataclass, field
from datetime import date

from ingest.models import Commodity, RawPrice


@dataclass
class FakePriceSource:
    rows: dict[str, list[RawPrice]] = field(default_factory=dict[str, list[RawPrice]])
    failing: set[str] = field(default_factory=set[str])
    calls: list[tuple[str, date, date]] = field(default_factory=list[tuple[str, date, date]])

    def fetch(self, commodity: Commodity, start: date, end: date) -> list[RawPrice]:
        self.calls.append((commodity.slug, start, end))
        if commodity.slug in self.failing:
            raise ConnectionError("source unavailable")
        return [r for r in self.rows.get(commodity.slug, []) if start <= r.observed_at <= end]


def raw(day: int, price: int, unit: str = "kg") -> RawPrice:
    return RawPrice(observed_at=date(2026, 10, day), price_idr=price, unit=unit)
