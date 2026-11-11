"""The contract every price source implements (CSV seed now, PIHPS later)."""

from collections.abc import Iterator
from dataclasses import dataclass
from typing import Literal, Protocol

from kp_ingest.models import RawPriceRow

SourceKind = Literal["seed_csv", "pihps"]


@dataclass(frozen=True)
class RowError:
    """A row that could not be accepted. `reason` never echoes the raw row content."""

    line: int
    reason: str


class PriceSource(Protocol):
    @property
    def kind(self) -> SourceKind: ...

    def rows(self) -> Iterator[RawPriceRow | RowError]: ...
