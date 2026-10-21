"""ARIF-Net bundle contract (docs 08 §5.3, §12). Mirrors packages/contracts; extra keys fail."""

import re
from datetime import date
from typing import Annotated, Literal

from pydantic import AfterValidator, AwareDatetime, BaseModel, ConfigDict, Field, model_validator

BUNDLE_SCHEMA = "kp-artifact-bundle-1.0.0"
HORIZONS = (1, 3, 7, 14, 30, 90, 180, 365)

_SLUG = re.compile(r"^[a-z0-9](?:[a-z0-9]|-(?!-))*(?<!-)$")
_SEGMENT = re.compile(r"^[A-Za-z0-9._-]+$")
MAX_SLUG = 64
MAX_PATH = 200


def _slug(value: str) -> str:
    if len(value) > MAX_SLUG or not _SLUG.fullmatch(value):
        raise ValueError("slug tidak valid")
    return value


def _bundle_path(value: str) -> str:
    """Relative POSIX path only: no absolute paths, no `..`, no backslashes."""
    segments = value.split("/")
    if len(value) > MAX_PATH or any(s == ".." or not _SEGMENT.fullmatch(s) for s in segments):
        raise ValueError("path file bundle tidak aman")
    return value


Slug = Annotated[str, AfterValidator(_slug)]
BundlePath = Annotated[str, AfterValidator(_bundle_path)]
Horizon = Literal[1, 3, 7, 14, 30, 90, 180, 365]
ArtifactStatus = Literal["draft", "candidate", "validated", "published", "deprecated", "archived"]
Availability = Literal[
    "available",
    "partial",
    "missing",
    "insufficient_coverage",
    "temporally_invalid",
    "schema_invalid",
    "stale",
]


class Contract(BaseModel):
    model_config = ConfigDict(extra="forbid", frozen=True, strict=True)


class BundleFile(Contract):
    path: BundlePath
    sha256: Annotated[str, Field(pattern=r"^[0-9a-f]{64}$")]
    bytes: Annotated[int, Field(ge=0)]


class Manifest(Contract):
    bundle_schema: Literal["kp-artifact-bundle-1.0.0"]
    bundle_id: Annotated[str, Field(pattern=r"^[a-z0-9][a-z0-9.-]*__\d{4}-\d{2}-\d{2}$")]
    model_version: Annotated[str, Field(min_length=1)]
    dataset_version: Annotated[str, Field(min_length=1)]
    preprocessing_version: Annotated[str, Field(min_length=1)]
    data_cutoff: Annotated[AwareDatetime, Field(strict=False)]
    generated_at: Annotated[AwareDatetime, Field(strict=False)]
    artifact_status: ArtifactStatus
    source_commit: Annotated[str, Field(pattern=r"^[0-9a-f]{7,40}$")]
    commodities: Annotated[tuple[Slug, ...], Field(min_length=1)]
    horizons: Annotated[tuple[Horizon, ...], Field(min_length=1)]
    files: Annotated[tuple[BundleFile, ...], Field(min_length=1)]
    limitations: Annotated[tuple[Annotated[str, Field(min_length=1)], ...], Field(min_length=1)]

    @model_validator(mode="after")
    def _consistent(self) -> Manifest:
        if self.data_cutoff > self.generated_at:
            raise ValueError("data_cutoff harus ≤ generated_at")
        if not self.bundle_id.startswith(f"{self.model_version}__"):
            raise ValueError("bundle_id harus diawali model_version")
        if len({file.path for file in self.files}) != len(self.files):
            raise ValueError("path file dalam manifest tidak boleh ganda")
        return self


class ForecastRun(Contract):
    id: Annotated[str, Field(pattern=r"^fr_[0-9A-HJKMNP-TV-Z]{26}$")]
    commodity: Slug
    market: Literal["PIKJ", "PIBC"]
    origin: Annotated[date, Field(strict=False)]
    model_version: str
    dataset_version: str
    preprocessing_version: str
    data_cutoff: Annotated[AwareDatetime, Field(strict=False)]
    status: Literal["pending", "generated", "validated", "published", "failed"]


class ForecastPoint(Contract):
    horizon_day: Horizon
    target_date: Annotated[date, Field(strict=False)]
    # Relative movement is the canonical target (AGENTS §2.4); it must stay above -100 %.
    predicted_change: Annotated[float, Field(gt=-1, allow_inf_nan=False, strict=False)]
    # Reconstruction for display: reference * (1 + predicted_change).
    predicted_price_idr: Annotated[int, Field(ge=0)]


class Forecast(Contract):
    run: ForecastRun
    reference_price_idr: Annotated[int, Field(gt=0)]
    points: Annotated[tuple[ForecastPoint, ...], Field(min_length=1)]


class ModalityAvailability(Contract):
    price: Availability
    climate: Availability
    news: Availability
    macro_logistics: Availability
    calendar: Availability
