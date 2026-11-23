"""Task 6: the persistent PIHPS evidence store, price exports, and the climate placeholder."""

import csv
import hashlib
from datetime import date
from pathlib import Path

import pandas as pd

from kp_pipeline.config import Commodity
from kp_pipeline.store import (
    MANIFEST_FIELDS,
    export_prices,
    seed_from_arifnet,
    write_climate_placeholder,
)

FIELDS = MANIFEST_FIELDS


def _arifnet_with(tmp_path: Path, chunks: list[tuple[str, str, str, bytes]]) -> Path:
    """A fake ARIF-Net folder: data/raw/pihps with a manifest and raw chunk files."""
    root = tmp_path / "ARIF-Net"
    raw = root / "data" / "raw" / "pihps"
    raw.mkdir(parents=True)
    with (raw / "manifest.csv").open("w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        w.writeheader()
        for cid, start, end, body in chunks:
            name = f"{cid}_{start[:7]}.json"
            (raw / name).write_bytes(body)
            w.writerow(
                {
                    "comcat_id": cid,
                    "chunk": start[:7],
                    "start_date": start,
                    "end_date": end,
                    "http_status": "200",
                    "raw_file": f"data/raw/pihps/{name}",
                    "raw_sha256": hashlib.sha256(body).hexdigest(),
                    "check": "OK",
                    "collected_at_utc": "2026-11-01T00:00:00+00:00",
                }
            )
    return root


def test_seed_copies_verified_chunks_up_to_the_ceiling_only(tmp_path: Path) -> None:
    arif = _arifnet_with(
        tmp_path,
        [
            ("com_14", "2026-08-01", "2026-08-31", b"{}"),
            ("com_14", "2026-09-01", "2026-09-30", b'{"a":1}'),
            ("com_14", "2026-10-01", "2026-10-31", b'{"b":2}'),  # after the ceiling: never copied
        ],
    )
    store = tmp_path / "store"
    copied = seed_from_arifnet(arif, store, ceiling=date(2026, 9, 30))
    assert copied == 2
    rows = list(csv.DictReader((store / "pihps" / "manifest.csv").open(encoding="utf-8")))
    assert [r["chunk"] for r in rows] == ["2026-08", "2026-09"]
    assert not (store / "pihps" / "com_14_2026-10.json").exists()
    # Idempotent: a second seed adds nothing.
    assert seed_from_arifnet(arif, store, ceiling=date(2026, 9, 30)) == 0


def test_seed_skips_a_chunk_whose_file_does_not_match_its_hash(tmp_path: Path) -> None:
    arif = _arifnet_with(tmp_path, [("com_14", "2026-08-01", "2026-08-31", b"{}")])
    (arif / "data" / "raw" / "pihps" / "com_14_2026-08.json").write_bytes(b"changed")
    assert seed_from_arifnet(arif, tmp_path / "store", ceiling=date(2026, 9, 30)) == 0


def test_price_exports_map_codes_and_stop_at_the_data_end(tmp_path: Path) -> None:
    combined = tmp_path / "prices_combined.csv"
    pd.DataFrame(
        {
            "comcat_id": ["com_14", "com_15", "com_14"],
            "commodity": ["Cabai Merah Keriting", "Cabai Rawit Hijau", "Cabai Merah Keriting"],
            "date": ["2026-09-29", "2026-09-30", "2026-10-01"],
            "price": [63000.0, 55000.0, 64000.0],
        }
    ).to_csv(combined, index=False)
    commodities = [
        Commodity("com_14", "cabai-merah-keriting", "Cabai Merah Keriting", "Cabai Merah Keriting"),
        Commodity("com_15", "cabai-rawit-hijau", "Cabai Rawit Hijau", "Cabai Rawit Hijau"),
    ]
    ingest_csv, model_csv = export_prices(combined, commodities, date(2026, 9, 30), tmp_path / "out")
    assert ingest_csv.read_text(encoding="utf-8").splitlines() == [
        "comcat_id,commodity,date,price",
        "com_14,Cabai Merah Keriting,2026-09-29,63000",
        "com_15,Cabai Rawit Hijau,2026-09-30,55000",
    ]
    assert model_csv.read_text(encoding="utf-8").splitlines() == [
        "commodity_code,observed_on,price_idr",
        "cabai-merah-keriting,2026-09-29,63000",
        "cabai-rawit-hijau,2026-09-30,55000",
    ]


def test_the_climate_placeholder_is_one_constant_column(tmp_path: Path) -> None:
    # One column, not zero: build_fold reshapes the climate block with -1 (4A run 2 failed on 0).
    path = write_climate_placeholder(tmp_path, date(2019, 1, 1), date(2019, 1, 3))
    assert path.read_text(encoding="utf-8").splitlines() == [
        "date,kp_placeholder",
        "2019-01-01,0",
        "2019-01-02,0",
        "2019-01-03,0",
    ]
