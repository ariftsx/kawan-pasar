"""The persistent PIHPS evidence store and the files a run hands to the product (Fase 4A task 6).

ARIF-Net's collector keeps raw responses (bytes as received + sha256) and resumes per monthly chunk
from its manifest. The store keeps them across runs: each staged run's data/raw/pihps points at it,
so a daily run only fetches the newest month. The three original commodities' history up to
2026-09-30 is seeded once from the local ARIF-Net folder (ruling 4A-3), never past the ceiling.
"""

import csv
import hashlib
import json
import os
import shutil
import sys
from datetime import date, timedelta
from pathlib import Path

import pandas as pd

from kp_pipeline.config import Commodity

# Same columns as ARIF-Net's collect_pihps.MANIFEST_FIELDS.
MANIFEST_FIELDS = [
    "comcat_id",
    "commodity",
    "chunk",
    "start_date",
    "end_date",
    "request_url",
    "http_status",
    "raw_file",
    "raw_sha256",
    "raw_bytes",
    "n_date_keys",
    "n_reported",
    "n_dash",
    "n_expected_weekdays",
    "check",
    "error",
    "collected_at_utc",
]


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _read_manifest(path: Path) -> list[dict[str, str]]:
    if not path.exists():
        return []
    with path.open(encoding="utf-8", newline="") as f:
        return list(csv.DictReader(f))


def seed_from_arifnet(arifnet_root: Path, store: Path, ceiling: date) -> int:
    """Copies verified OK chunks ending on or before `ceiling` that the store lacks; returns the count."""
    src_dir = arifnet_root / "data" / "raw" / "pihps"
    dst_dir = store / "pihps"
    dst_dir.mkdir(parents=True, exist_ok=True)
    manifest = dst_dir / "manifest.csv"
    have = {(r["comcat_id"], r["chunk"]) for r in _read_manifest(manifest)}
    new_rows = []
    for row in _read_manifest(src_dir / "manifest.csv"):
        key = (row["comcat_id"], row["chunk"])
        if key in have or row.get("http_status") != "200" or row.get("check") != "OK":
            continue
        if date.fromisoformat(row["end_date"]) > ceiling:
            continue
        src = arifnet_root / row["raw_file"]
        if not src.is_file() or _sha256(src) != row["raw_sha256"]:
            continue
        shutil.copy2(src, dst_dir / src.name)
        new_rows.append({k: row.get(k, "") for k in MANIFEST_FIELDS})
        have.add(key)
    if new_rows:
        exists = manifest.exists()
        with manifest.open("a", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=MANIFEST_FIELDS)
            if not exists:
                w.writeheader()
            w.writerows(new_rows)
    return len(new_rows)


def attach_store(staged: Path, store: Path) -> None:
    """Points <staged>/data/raw/pihps at the store (symlink; a junction on Windows without symlink rights)."""
    # Absolute and normalised: a relative or ".." target makes a broken link (a symlink resolves it
    # from the link's own folder; a Windows junction stores it unusable) — first 4A run.
    target = (store / "pihps").resolve()
    target.mkdir(parents=True, exist_ok=True)
    link = staged / "data" / "raw" / "pihps"
    link.parent.mkdir(parents=True, exist_ok=True)
    try:
        os.symlink(target, link, target_is_directory=True)
    except OSError:
        if sys.platform != "win32":
            raise
        import _winapi

        _winapi.CreateJunction(str(target), str(link))


def write_climate_placeholder(staged: Path, start: date, end: date) -> Path:
    """One constant column, no climate data (ruling 4A-4): ARIF-Net's SequenceBank always reads this
    file, A0 never uses climate (modalities = []). One column rather than none: build_fold reshapes
    the climate block with -1, which fails on zero columns. A constant 0 standardises to 0 with a
    full mask (no NaN)."""
    path = staged / "data" / "processed" / "climate" / "climate_tier1_mean.csv"
    path.parent.mkdir(parents=True, exist_ok=True)
    days = (end - start).days + 1
    lines = [
        "date,kp_placeholder",
        *(f"{(start + timedelta(days=i)).isoformat()},0" for i in range(days)),
    ]
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def export_prices(
    combined: Path, commodities: list[Commodity], data_end: date, out: Path
) -> tuple[Path, Path]:
    """From ARIF-Net's prices_combined.csv, up to the data end:
    (kp_ingest import-pihps file, kp_model price file with product codes)."""
    df = pd.read_csv(combined, dtype={"comcat_id": str, "commodity": str, "date": str})
    df = df[pd.to_datetime(df["date"]) <= pd.Timestamp(data_end)].copy()
    codes = {c.comcat_id: c.code for c in commodities}
    df = df[df["comcat_id"].isin(codes)]
    df["price"] = df["price"].round().astype(int)
    out.mkdir(parents=True, exist_ok=True)
    ingest_csv = out / "prices_pihps.csv"
    df[["comcat_id", "commodity", "date", "price"]].to_csv(ingest_csv, index=False, lineterminator="\n")
    model_csv = out / "prices_model.csv"
    model = pd.DataFrame(
        {"commodity_code": df["comcat_id"].map(codes), "observed_on": df["date"], "price_idr": df["price"]}
    )
    model.to_csv(model_csv, index=False, lineterminator="\n")
    return ingest_csv, model_csv


def _month_end(chunk: str) -> date:
    year, month = (int(x) for x in chunk.split("-"))
    first_next = date(year + (month == 12), month % 12 + 1, 1)
    return first_next - timedelta(days=1)


def chunks_after(store: Path, data_end: date) -> list[str]:
    """OK chunks in the store whose data goes past `data_end` (refused while the lock holds)."""
    return sorted(
        f"{r['comcat_id']}:{r['chunk']}"
        for r in _read_manifest(store / "pihps" / "manifest.csv")
        if r.get("check") == "OK" and r.get("end_date") and date.fromisoformat(r["end_date"]) > data_end
    )


def forget_open_month(store: Path, data_end: date) -> int:
    """Drops manifest rows of chunks fetched before their month (or the data end) was complete, so
    ARIF-Net's collector fetches them again (review finding, Fase 4A). Raw files stay as evidence;
    the collector writes a new file next to them. Returns the number of rows dropped."""
    path = store / "pihps" / "manifest.csv"
    if not path.exists():
        return 0
    with path.open(encoding="utf-8", newline="") as f:
        reader = csv.DictReader(f)
        fields = list(reader.fieldnames or MANIFEST_FIELDS)
        rows = list(reader)
    keep = [
        r
        for r in rows
        if not (
            r.get("end_date")
            and r.get("chunk")
            and date.fromisoformat(r["end_date"]) < min(_month_end(r["chunk"]), data_end)
        )
    ]
    if len(keep) != len(rows):
        with path.open("w", encoding="utf-8", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            w.writerows(keep)
    return len(rows) - len(keep)


def remove_run_dir(run_dir: Path) -> None:
    """Deletes a run folder without ever following its link into the shared store: the one link a
    run has (arifnet/data/raw/pihps, symlink or Windows junction) is removed first, then the rest."""
    link = run_dir / "arifnet" / "data" / "raw" / "pihps"
    if link.is_symlink():
        link.unlink()
    elif link.is_junction():
        os.rmdir(link)
    elif link.exists():
        raise RuntimeError(f"{link}: expected a link to the store, found a folder; not deleting")
    if run_dir.exists():
        shutil.rmtree(run_dir)


def run_created_utc(run_dir: Path) -> str | None:
    """`created_utc` of a run folder, or None when it is not a readable run (no or corrupt run.json):
    such folders are never counted or removed."""
    state = run_dir / "run.json"
    if not (run_dir.is_dir() and state.is_file()):
        return None
    try:
        data = json.loads(state.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return None
    return str(data.get("created_utc", "")) if isinstance(data, dict) else None


def clean_runs(runs: Path, keep_latest: int, keep: set[str], prefix: str = "") -> list[str]:
    """Removes run folders whose id starts with `prefix`, except the `keep_latest` newest (by run.json
    created_utc) and the run ids in `keep` (candidates still awaiting an admin, the approved one).
    Folders without a readable run.json are not runs and are left alone. Returns the removed run
    ids, oldest first."""
    found = []
    for d in runs.iterdir() if runs.exists() else []:
        created = run_created_utc(d) if d.name.startswith(prefix) else None
        if created is not None:
            found.append((created, d))
    found.sort()
    newest = {d.name for _, d in found[-keep_latest:]} if keep_latest > 0 else set()
    removed = []
    for _, d in found:
        if d.name in newest or d.name in keep:
            continue
        remove_run_dir(d)
        removed.append(d.name)
    return removed
