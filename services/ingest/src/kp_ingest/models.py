"""Validated shapes for price rows entering the system."""

import re
from datetime import UTC, date, datetime, timedelta, timezone

from pydantic import BaseModel, ConfigDict, Field, field_validator

# Indonesia has no daylight saving time; WIB is a fixed UTC+7 offset. Using a fixed offset avoids
# depending on the OS timezone database (absent on Windows without the tzdata package).
WIB = timezone(timedelta(hours=7), "WIB")

#: Plausible retail price range per kg; anything outside is treated as a data error.
MIN_PRICE_IDR = 100
MAX_PRICE_IDR = 10_000_000

#: Whole rupiah, optionally written with zero decimals ("40000" or "40000.0"). Anything else is
#: rejected on purpose: "40.000" (Indonesian thousands separator) would otherwise parse as Rp40,
#: and exponents ("1e4") or underscores ("40_000") are not how prices are written.
_PRICE = re.compile(r"\d+(\.0+)?")
_ISO_DAY = re.compile(r"\d{4}-\d{2}-\d{2}")
EARLIEST_OBSERVATION = date(2000, 1, 1)


def today_wib() -> date:
    return datetime.now(UTC).astimezone(WIB).date()


class RawPriceRow(BaseModel):
    """One daily price observation as read from a source, after validation."""

    model_config = ConfigDict(frozen=True, str_strip_whitespace=True, extra="forbid")

    source_ref: str = Field(min_length=1, max_length=32)
    commodity_name: str = Field(min_length=1, max_length=100)
    observed_on: date
    price_idr: int
    #: Physical line in the source file (for operator-facing logs); not part of the data.
    source_line: int | None = None

    @field_validator("price_idr", mode="before")
    @classmethod
    def _whole_plausible_rupiah(cls, value: object) -> int:
        text = str(value).strip()
        if not _PRICE.fullmatch(text):
            raise ValueError("price must be whole rupiah digits, e.g. 40000 or 40000.0")
        amount = int(text.split(".", 1)[0])
        if not MIN_PRICE_IDR <= amount <= MAX_PRICE_IDR:
            raise ValueError("price is outside the plausible range")
        return amount

    @field_validator("observed_on", mode="before")
    @classmethod
    def _strict_iso_day(cls, value: object) -> object:
        if isinstance(value, date):
            return value
        if not isinstance(value, str) or not _ISO_DAY.fullmatch(value.strip()):
            raise ValueError("date must be YYYY-MM-DD")
        return value.strip()

    @field_validator("observed_on")
    @classmethod
    def _within_range(cls, value: date) -> date:
        if value < EARLIEST_OBSERVATION:
            raise ValueError("observation date is before the supported range")
        if value > today_wib():
            raise ValueError("observation date is in the future")
        return value
