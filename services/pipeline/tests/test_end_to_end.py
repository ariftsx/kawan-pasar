"""End to end, hermetic (no network): a synthetic PIHPS evidence store in PIHPS's own format, then
every real step — ARIF-Net's collector (finds nothing to fetch), preprocessing, scoring + training
(--quick: 1 epoch), conversion and kp_model's bundle. Minutes, so marked slow."""

import csv
import hashlib
import json
import sys
from datetime import date, timedelta
from pathlib import Path

import numpy as np
import pandas as pd
import pytest

from kp_pipeline.lock import frozen_sha256
from kp_pipeline.paths import home
from kp_pipeline.run import Run, RunOptions
from kp_pipeline.store import MANIFEST_FIELDS

DATA_END = date(2023, 6, 30)
COMCATS = {"com_14": 45000.0, "com_11": 32000.0, "com_3": 12000.0, "com_15": 40000.0, "com_16": 50000.0}


def _months(start: date, end: date) -> list[tuple[date, date]]:
    out, cur = [], start
    while cur <= end:
        nxt = date(cur.year + (cur.month == 12), cur.month % 12 + 1, 1)
        out.append((cur, min(nxt - timedelta(days=1), end)))
        cur = nxt
    return out


def synthetic_store(store: Path) -> None:
    """Monthly chunks for 2019-01..2023-06, Pasar Kramatjati level 3, random-walk prices."""
    pihps = store / "pihps"
    pihps.mkdir(parents=True)
    rng = np.random.default_rng(7)
    rows = []
    for cid, base in COMCATS.items():
        price = base
        for start, end in _months(date(2019, 1, 1), DATA_END):
            values = {}
            d = start
            while d <= end:
                if d.weekday() < 5:
                    price = max(1000.0, price * float(np.exp(rng.normal(0, 0.01))))
                    values[d.strftime("%d/%m/%Y")] = f"{round(price / 50) * 50:,.0f}"
                d += timedelta(days=1)
            body = json.dumps(
                {"data": [{"no": "b", "name": "Pasar Kramatjati", "level": 3, **values}]}
            ).encode()
            name = f"{cid}_{start:%Y-%m}.json"
            (pihps / name).write_bytes(body)
            rows.append(
                {
                    "comcat_id": cid,
                    "commodity": cid,
                    "chunk": f"{start:%Y-%m}",
                    "start_date": start.isoformat(),
                    "end_date": end.isoformat(),
                    "request_url": "synthetic",
                    "http_status": "200",
                    "raw_file": f"data/raw/pihps/{name}",
                    "raw_sha256": hashlib.sha256(body).hexdigest(),
                    "raw_bytes": str(len(body)),
                    "n_date_keys": str(len(values)),
                    "n_reported": str(len(values)),
                    "n_dash": "0",
                    "n_expected_weekdays": str(len(values)),
                    "check": "OK",
                    "error": "",
                    # After the month ended: not provisional, so the collector keeps it.
                    "collected_at_utc": "2023-07-15T00:00:00+00:00",
                }
            )
    with (pihps / "manifest.csv").open("w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=MANIFEST_FIELDS)
        w.writeheader()
        w.writerows(rows)


def locked_until(folder: Path, end: date) -> Path:
    folder.mkdir(parents=True)
    (folder / "registration.json").write_text(
        json.dumps(
            {
                "registered_utc": "2023-07-01T00:00:00+00:00",
                "train_end": end.isoformat(),
                "cutoff": "2023-08-31",
                "frozen_sha256": frozen_sha256({}),
                "registered_file_sha256": "0" * 64,
            }
        ),
        encoding="utf-8",
    )
    return folder


@pytest.mark.slow
def test_a_locked_run_makes_a_verified_candidate_without_the_network(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    synthetic_store(tmp_path / "store")
    # kp_model runs from its sources (as in the image).
    monkeypatch.setenv("PYTHONPATH", str(home().parent / "model-arifnet" / "src"))
    opts = RunOptions(
        store=tmp_path / "store",
        runs=tmp_path / "runs",
        run_id="e2e",
        quick=True,
        model_cmd=[sys.executable, "-m", "kp_model"],
        prospective_dir=locked_until(tmp_path / "prospective", DATA_END),
        today=date(2023, 11, 1),
    )
    state = Run(opts).execute()
    assert state["data_end"] == "2023-06-30"
    steps = state["steps"]
    assert isinstance(steps, dict)
    assert {s["status"] for s in steps.values()} == {"ok"}
    out = tmp_path / "runs" / "e2e" / "out"

    # The collector found everything in the store: nothing was fetched.
    assert "sisa=0" in (tmp_path / "runs" / "e2e" / "logs" / "collect.log").read_text(encoding="utf-8")

    # Prices for the product stop at the data end.
    prices = pd.read_csv(out / "prices_pihps.csv", parse_dates=["date"])
    assert prices["date"].max() <= pd.Timestamp(DATA_END)
    assert sorted(prices["comcat_id"].unique()) == sorted(COMCATS)

    # The model folder: 5 commodities, 5 seeds, scores for every commodity and horizon.
    spec = json.loads((out / "model" / "arifnet-a0.json").read_text(encoding="utf-8"))
    assert [c["code"] for c in spec["commodities"]] == [
        "cabai-merah-keriting",
        "bawang-merah",
        "beras-medium-1",
        "cabai-rawit-hijau",
        "cabai-rawit-merah",
    ]
    assert len(spec["seeds"]) == 5
    assert spec["source"]["train_end"] == "2023-06-30"
    assert spec["validation"]["window"] == {"start": "2021-06-30", "end": "2022-06-30"}
    assert set(spec["validation"]["by_commodity"]) == set(COMCATS)

    # The candidate bundle: 5 commodities x 8 horizons, ordered quantiles.
    bundle = out / "bundles" / str(state["bundle"])
    forecasts = pd.read_csv(bundle / "forecasts.csv")
    assert len(forecasts) == 40
    assert (
        (forecasts.q10_change <= forecasts.q50_change) & (forecasts.q50_change <= forecasts.q90_change)
    ).all()
