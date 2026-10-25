"""The boundary to price providers. The PIHPS adapter wraps the ARIF-Net collector (D-20).

Every source must stay at or below 1 request per second with a clear User-Agent and respect the
provider's terms (docs 13 §A5, OPEN DATA-01). Sources only fetch; validation happens in validate.
"""

from datetime import date
from typing import Protocol

from ingest.models import Commodity, RawPrice


class PriceSource(Protocol):
    def fetch(self, commodity: Commodity, start: date, end: date) -> list[RawPrice]:
        """Rows observed in [start, end] for one commodity; an unknown day is simply absent."""
        ...
