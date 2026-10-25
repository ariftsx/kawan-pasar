"""One ingest run across the catalog. Storage (staging -> published tables) arrives with F2."""

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta, timezone

import structlog

from ingest.models import Commodity, PriceObservation, Rejected
from ingest.sources import PriceSource
from ingest.validate import validate_rows

WIB = timezone(timedelta(hours=7), "WIB")

log = structlog.get_logger()


def now_wib() -> datetime:
    return datetime.now(WIB)


@dataclass(frozen=True, slots=True)
class IngestReport:
    observations: list[PriceObservation] = field(default_factory=list[PriceObservation])
    rejected: list[Rejected] = field(default_factory=list[Rejected])
    failed: list[str] = field(default_factory=list[str])


def run_ingest(
    source: PriceSource,
    catalog: Sequence[Commodity],
    history: Mapping[str, Sequence[PriceObservation]],
    period: tuple[date, date],
    *,
    clock: Callable[[], datetime] = now_wib,
) -> IngestReport:
    """Fetches and validates every commodity; one failing commodity never stops the others.

    `period` is the inclusive (start, end) range of observation dates to fetch.
    """
    start, end = period
    report = IngestReport()
    for commodity in catalog:
        try:
            rows = source.fetch(commodity, start, end)
        except Exception as error:  # any source failure is reported, never raised
            log.warning("source failed", commodity=commodity.slug, error=type(error).__name__)
            report.failed.append(commodity.slug)
            continue
        # available_at is taken when the rows really reached us, after the fetch returned.
        accepted, rejected = validate_rows(
            commodity, rows, history.get(commodity.slug, ()), clock()
        )
        report.observations.extend(accepted)
        report.rejected.extend(rejected)
        log.info(
            "commodity ingested",
            commodity=commodity.slug,
            valid=sum(o.status == "valid" for o in accepted),
            quarantined=sum(o.status == "quarantined" for o in accepted),
            rejected=len(rejected),
        )
    return report
