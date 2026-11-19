"""Price input and forecast bundle output (docs/data/kontrak-bundel-prediksi.md, contract v1)."""

from __future__ import annotations

import csv
import hashlib
import json
import os
import re
import shutil
from datetime import UTC, date, datetime
from pathlib import Path

from kp_model.features import Series
from kp_model.forecast import MARKET, ForecastRow
from kp_model.spec import Spec

PRICE_COLUMNS = ["commodity_code", "observed_on", "price_idr"]
CSV_COLUMNS = [
    "market_code",
    "commodity_code",
    "base_date",
    "horizon_days",
    "q10_change",
    "q50_change",
    "q90_change",
    "q10_price_idr",
    "q50_price_idr",
    "q90_price_idr",
    "eval_status",
]
MAX_INPUT_BYTES = 20 * 1024 * 1024
_DAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


class BundleError(Exception):
    """The input or the output does not follow the contract; nothing is written."""


def _sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def read_prices_csv(path: Path, spec: Spec) -> dict[str, Series]:
    """Prices of the commodities ARIF-Net covers (product codes), exported by the Core API."""
    if path.stat().st_size > MAX_INPUT_BYTES:
        raise BundleError("price file is too large")
    rows: dict[str, list[tuple[date, float]]] = {}
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        if reader.fieldnames != PRICE_COLUMNS:
            raise BundleError(f"price file header must be {','.join(PRICE_COLUMNS)}")
        for n, r in enumerate(reader, start=2):
            cid = spec.commodity_for_code(r["commodity_code"])
            if cid is None:
                raise BundleError(f"line {n}: commodity not covered by ARIF-Net")
            if not _DAY.match(r["observed_on"]) or not r["price_idr"].isdigit():
                raise BundleError(f"line {n}: expected YYYY-MM-DD and a whole rupiah price")
            price = int(r["price_idr"])
            if price <= 0:
                raise BundleError(f"line {n}: price must be positive")
            rows.setdefault(cid, []).append((date.fromisoformat(r["observed_on"]), float(price)))
    try:
        return {cid: Series.from_rows(v) for cid, v in rows.items()}
    except ValueError as e:
        raise BundleError(str(e)) from e


def _fmt(x: float) -> str:
    return format(x, ".6f").rstrip("0").rstrip(".") if x != int(x) else str(int(x))


def write_bundle(
    out_root: Path, spec: Spec, rows: list[ForecastRow], prices_file: Path, now: datetime
) -> Path:
    """Writes <bundle_id>/{forecasts.csv, metadata.json, SHA256SUMS} atomically (temp dir, rename)."""
    if not rows:
        raise BundleError("no forecast rows")
    base = max(r.base_date for r in rows).isoformat()
    input_sha = _sha256(prices_file.read_bytes())[:8]
    weights_sha = _sha256("".join(s["sha256"] for s in spec.raw["seeds"]).encode())[:8]
    lines = [",".join(CSV_COLUMNS)]
    for r in rows:
        lines.append(
            ",".join(
                [
                    MARKET,
                    r.commodity_code,
                    r.base_date.isoformat(),
                    str(r.horizon_days),
                    _fmt(r.q10_change),
                    _fmt(r.q50_change),
                    _fmt(r.q90_change),
                    str(r.q10_price_idr),
                    str(r.q50_price_idr),
                    str(r.q90_price_idr),
                    r.eval_status,
                ]
            )
        )
    forecasts = ("\n".join(lines) + "\n").encode()
    issued = now.astimezone(UTC)
    stamp = issued.strftime("%Y%m%d%H%M")
    bundle_id = f"arifnet-{base}-{stamp}-{_sha256(forecasts)[:8]}"
    cutoff_end = datetime.fromisoformat(f"{base}T23:59:59+07:00")
    metadata = {
        "bundle_id": bundle_id,
        "model_name": spec.raw["name"],
        "model_version": f"{spec.raw['model_version']}+{weights_sha}",
        "data_version": f"pihps-{base}-{input_sha}",
        "preprocess_version": spec.raw["preprocess_version"],
        "data_cutoff": f"{base}T23:59:59+07:00" if cutoff_end <= issued else issued.isoformat(),
        "issued_at": issued.isoformat(timespec="milliseconds").replace("+00:00", "Z"),
    }
    meta_bytes = (json.dumps(metadata, indent=2, ensure_ascii=False) + "\n").encode()
    sums = f"{_sha256(forecasts)}  forecasts.csv\n{_sha256(meta_bytes)}  metadata.json\n".encode()

    target = out_root / bundle_id
    if target.exists():
        raise BundleError(f"{bundle_id} already exists")
    tmp = out_root / f".{bundle_id}.tmp"
    # A half-written directory of an interrupted run is ours to replace (never a finished bundle).
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)
    try:
        for name, data in (
            ("forecasts.csv", forecasts),
            ("metadata.json", meta_bytes),
            ("SHA256SUMS", sums),
        ):
            with (tmp / name).open("wb") as f:
                f.write(data)
                f.flush()
                os.fsync(f.fileno())
        tmp.rename(target)
    except BaseException:
        shutil.rmtree(tmp, ignore_errors=True)
        raise
    return target
