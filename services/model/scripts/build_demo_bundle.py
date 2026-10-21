"""Writes the DATA DEMO bundle (docs 08 §12.5, DH-03).

Run from services/model: uv run python -m scripts.build_demo_bundle

Every number here is a labelled sample for UI development, NOT a model result. The 7-day changes
match the DATA DEMO card in apps/web; other horizons scale them by sqrt(h / 7) only so charts have
a shape. Output is deterministic, so rerunning it must leave git clean.
"""

import hashlib
import json
from datetime import date, timedelta
from pathlib import Path

from app.artifacts.loader import DEMO_BUNDLE, reconstruct_price
from app.schemas.bundle import HORIZONS

ORIGIN = date(2026, 10, 18)
CUTOFF = "2026-10-18T12:00:00+07:00"
VERSIONS = {"model_version": "demo", "dataset_version": "demo", "preprocessing_version": "demo"}
# commodity -> (reference price per kg, 7-day change), from the DATA DEMO card.
SAMPLES = {
    "cabai-merah-keriting": (52_400, 0.028),
    "bawang-merah": (38_933, 0.009),
    "beras-medium-1": (13_650, 0.0),
}
RUN_IDS = {
    "cabai-merah-keriting": "fr_01JADEM0000000000000000001",
    "bawang-merah": "fr_01JADEM0000000000000000002",
    "beras-medium-1": "fr_01JADEM0000000000000000003",
}
LIMITATIONS = [
    "DATA DEMO — bukan hasil model.",
    "Fitur masih dalam pengembangan; perkiraan ARIF-Net tampil setelah model selesai.",
]


def _forecast(commodity: str) -> dict[str, object]:
    reference, change_7d = SAMPLES[commodity]
    points = []
    for horizon in HORIZONS:
        change = round(change_7d * (horizon / 7) ** 0.5, 4)
        points.append(
            {
                "horizon_day": horizon,
                "target_date": (ORIGIN + timedelta(days=horizon)).isoformat(),
                "predicted_change": change,
                "predicted_price_idr": reconstruct_price(reference, change),
            }
        )
    run = {
        "id": RUN_IDS[commodity],
        "commodity": commodity,
        "market": "PIKJ",
        "origin": ORIGIN.isoformat(),
        **VERSIONS,
        "data_cutoff": CUTOFF,
        "status": "generated",
    }
    return {"run": run, "reference_price_idr": reference, "points": points}


def _write(root: Path, relative: str, payload: object) -> dict[str, object]:
    data = (json.dumps(payload, ensure_ascii=False, indent=2) + "\n").encode()
    path = root / relative
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(data)
    return {"path": relative, "sha256": hashlib.sha256(data).hexdigest(), "bytes": len(data)}


def main() -> None:
    root = DEMO_BUNDLE
    files = [_write(root, f"forecasts/{c}.json", _forecast(c)) for c in SAMPLES]
    availability = {
        "price": "available",
        "climate": "missing",
        "news": "missing",
        "macro_logistics": "missing",
        "calendar": "missing",
    }
    files.append(_write(root, "context/availability.json", availability))
    manifest = {
        "bundle_schema": "kp-artifact-bundle-1.0.0",
        "bundle_id": root.name,
        **VERSIONS,
        "data_cutoff": CUTOFF,
        "generated_at": CUTOFF,
        "artifact_status": "draft",
        # Product repo commit the demo was first built from; there is no research run behind it.
        "source_commit": "b97756a",
        "commodities": list(SAMPLES),
        "horizons": list(HORIZONS),
        "files": files,
        "limitations": LIMITATIONS,
    }
    # Written last, as the research pipeline must (docs 08 §12.3).
    _write(root, "manifest.json", manifest)


if __name__ == "__main__":
    main()
