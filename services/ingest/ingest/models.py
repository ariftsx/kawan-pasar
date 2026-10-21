"""Ingest data shapes. `PriceObservation` mirrors packages/contracts (docs 08 §5.1)."""

import re
from datetime import date
from typing import Annotated, Literal

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field

_SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9]|-(?!-))*(?<!-)$")
MAX_SLUG = 64

Market = Literal["PIKJ", "PIBC"]
PriceUnit = Literal["kg", "l", "butir"]


def _slug(value: str) -> str:
    if len(value) > MAX_SLUG or not _SLUG.fullmatch(value):
        raise ValueError("slug tidak valid")
    return value


Slug = Annotated[str, AfterValidator(_slug)]


class Frozen(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True)


class Commodity(Frozen):
    slug: Slug
    pihps_name: Annotated[str, Field(min_length=1)]
    comcat_id: Annotated[str, Field(pattern=r"^com_\d+$")]
    market: Market
    unit: PriceUnit


class RawPrice(Frozen):
    """One row as a source returns it, before any product validation."""

    observed_at: date
    price_idr: int
    unit: str


class PriceObservation(Frozen):
    commodity: Slug
    market: Market
    observed_at: date
    # When the value really reached us; a forecast at origin t may use it only if <= t.
    available_at: AwareDatetime
    price_idr: Annotated[int, Field(gt=0)]
    unit: PriceUnit
    source: Literal["pihps"] = "pihps"
    status: Literal["valid", "quarantined"]


class Rejected(Frozen):
    """A row that never becomes an observation, with the reason for the ingest report."""

    commodity: Slug
    observed_at: date
    reason: str
