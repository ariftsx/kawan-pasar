"""Loads and verifies one bundle directory (docs 08 §12.1-12.3, §12.5).

Nothing is trusted before it is checked: every file must be listed in the manifest with the
right size and SHA-256, must stay inside the bundle, and must parse against its schema.
"""

import hashlib
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from pathlib import Path
from typing import Literal

from pydantic import ValidationError

from app.schemas.bundle import Forecast, Manifest, ModalityAvailability

Mode = Literal["development", "live"]

MAX_FILE_BYTES = 5 * 1024 * 1024
AVAILABILITY_PATH = "context/availability.json"
# The demo bundle is development-only and can never reach users as a model result (DH-03).
DEMO_MODEL_VERSION = "demo"
LIVE_STATUSES = frozenset({"candidate", "validated", "published"})
# Packaged demo bundle (docs 08 §12.5). It is never read from the artifacts volume.
DEMO_BUNDLE = Path(__file__).resolve().parents[2] / "demo" / "demo__2026-10-18"


class BundleError(Exception):
    """The bundle is rejected; the message names the first problem found."""


@dataclass(frozen=True, slots=True)
class Bundle:
    manifest: Manifest
    forecasts: dict[str, Forecast]
    availability: ModalityAvailability


def reconstruct_price(reference_idr: int, change: float) -> int:
    """Whole rupiah, half up, the same rule as packages/domain."""
    value = Decimal(reference_idr) * (Decimal(1) + Decimal(str(change)))
    return int(value.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def _read_verified(root: Path, manifest: Manifest, relative: str) -> bytes:
    entry = next((file for file in manifest.files if file.path == relative), None)
    if entry is None:
        raise BundleError(f"{relative}: tidak tercantum di manifest")
    path = (root / relative).resolve()
    if not path.is_relative_to(root.resolve()) or not path.is_file():
        raise BundleError(f"{relative}: berada di luar bundle atau tidak ada")
    if path.stat().st_size > MAX_FILE_BYTES:
        raise BundleError(f"{relative}: terlalu besar")
    data = path.read_bytes()
    if len(data) != entry.bytes or hashlib.sha256(data).hexdigest() != entry.sha256:
        raise BundleError(f"{relative}: ukuran atau checksum tidak cocok")
    return data


def _check_mode(manifest: Manifest, mode: Mode) -> None:
    is_demo = manifest.model_version == DEMO_MODEL_VERSION
    if mode == "development" and not (is_demo and manifest.artifact_status == "draft"):
        raise BundleError("mode development hanya memuat bundle demo berstatus draft")
    if mode == "live" and (is_demo or manifest.artifact_status not in LIVE_STATUSES):
        raise BundleError("mode live menolak bundle demo atau berstatus di bawah candidate")


def _check_forecast(forecast: Forecast, commodity: str, manifest: Manifest) -> None:
    run = forecast.run
    versions = (run.model_version, run.dataset_version, run.preprocessing_version)
    expected = (manifest.model_version, manifest.dataset_version, manifest.preprocessing_version)
    if (
        run.commodity != commodity
        or versions != expected
        or run.data_cutoff != manifest.data_cutoff
    ):
        raise BundleError(f"{commodity}: identitas run tidak cocok dengan manifest")
    # Temporal integrity: the origin may not lie after the data cutoff (AGENTS §2.5).
    if run.origin > manifest.data_cutoff.date():
        raise BundleError(f"{commodity}: origin melewati data_cutoff")
    for point in forecast.points:
        if point.horizon_day not in manifest.horizons:
            raise BundleError(f"{commodity}: horizon {point.horizon_day} tidak didukung")
        rebuilt = reconstruct_price(forecast.reference_price_idr, point.predicted_change)
        if point.predicted_price_idr != rebuilt:
            raise BundleError(f"{commodity}: harga rekonstruksi h{point.horizon_day} tidak cocok")


def load_bundle(root: Path, mode: Mode) -> Bundle:
    manifest_path = root / "manifest.json"
    if not manifest_path.is_file() or manifest_path.stat().st_size > MAX_FILE_BYTES:
        raise BundleError("manifest.json tidak ada atau terlalu besar")
    try:
        manifest = Manifest.model_validate_json(manifest_path.read_bytes())
        if root.name != manifest.bundle_id:
            raise BundleError("nama folder harus sama dengan bundle_id")
        _check_mode(manifest, mode)
        forecasts: dict[str, Forecast] = {}
        for commodity in manifest.commodities:
            raw = _read_verified(root, manifest, f"forecasts/{commodity}.json")
            forecasts[commodity] = Forecast.model_validate_json(raw)
            _check_forecast(forecasts[commodity], commodity, manifest)
        availability = ModalityAvailability.model_validate_json(
            _read_verified(root, manifest, AVAILABILITY_PATH)
        )
    except ValidationError as error:
        # Field locations only; values from an untrusted bundle are not echoed.
        fields = ", ".join(".".join(map(str, e["loc"])) for e in error.errors()) or "root"
        raise BundleError(f"skema tidak valid: {fields}") from None
    return Bundle(manifest=manifest, forecasts=forecasts, availability=availability)
