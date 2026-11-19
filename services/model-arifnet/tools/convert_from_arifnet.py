"""Convert the final ARIF-Net A0 model into the product's inference artefacts (run by hand).

Runs in the ARIF-Net research environment (PyTorch), reads the ARIF-Net repository READ-ONLY and
writes, under services/model-arifnet/:

  model/arifnet-a0.json        configuration, feature order, preprocessing statistics, sigma,
                               validation scores and the provenance (sha256 of every source file)
  model/weights/s<seed>.npz    weights as plain float32 arrays (loaded with allow_pickle=False)
  model/calendar_holidays.json holiday dates of the research calendar (+ flagged estimates)
  model/LICENSE-ARIF-Net, model/model_card.json   copied as-is (MIT, attribution)
  tests/fixtures/golden.json   reference results computed with the ARIF-Net code itself, on a
                               SYNTHETIC price series (no market data is committed)

Usage (from the Kawan Pasar repository root):
  <ARIF-Net env python> services/model-arifnet/tools/convert_from_arifnet.py <path to ARIF-Net>
"""
from __future__ import annotations

import hashlib
import json
import shutil
import sys
from datetime import date, timedelta
from importlib import import_module
from pathlib import Path

import numpy as np
import pandas as pd
import torch

ARIF = Path(sys.argv[1]).resolve()
OUT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ARIF))

_data = import_module("03_training.data")
bd = import_module("02_preprocessing.build_dataset")
cal = import_module("01_collection.collect_calendar")
M = import_module("04_arif_net.model")
T_ = import_module("04_arif_net.train")
ff = import_module("04_arif_net.fit_final")

PRODUCT_CODES = {"com_14": "cabai-merah-keriting", "com_11": "bawang-merah", "com_3": "beras-medium-1"}
SAFE_NUMPY = [np._core.multiarray._reconstruct, np.ndarray, np.dtype, type(np.dtype("float64"))]
MODEL_VERSION = "arifnet-a0-v1.1.0"
FEATURES_VERSION = "arifnet-features-v1.1.0"
# Hijri holidays of 2027 are not in the research calendar yet (owner ruling K1, 19 Nov 2026):
# estimates from the Hijri calendar, flagged as such, to be replaced by the official SKB dates.
ESTIMATED_2027 = {"idul_fitri": [["2027-03-10", "2027-03-11"]], "idul_adha": ["2027-05-17"],
                  "ramadan_start": ["2027-02-08"]}


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=1, ensure_ascii=False) + "\n", encoding="utf-8", newline="\n")


def validation_scores() -> dict:
    """relMAE vs persistence per (commodity, horizon): mean over folds F1-F2 x 5 seeds (frozen A0)."""
    runs = sorted((ARIF / "results" / "runs").glob("*_arifnet_cek08_F*_s*/metrics_per_ch.csv"))
    if len(runs) != 10:
        raise RuntimeError(f"expected 10 validation runs of the frozen candidate, found {len(runs)}")
    d = pd.concat([pd.read_csv(f) for f in runs])
    g = d.groupby(["komoditas", "h"])["relmae"].mean()
    return {c: {str(h): round(float(g[(c, h)]), 4) for h in _data.HORIZONS} for c in _data.COMMODITIES}


BASELINES = ("persistence", "arima", "ridge", "svr", "rf", "xgb", "lgbm", "lstm", "gru", "bilstm",
             "dialstm", "tft", "tcn_xgb")


def pooled_relmae(model: str) -> float:
    """Mean relMAE over the validation runs (F1-F2 x seeds) of results/validation/<model>.csv."""
    return round(float(pd.read_csv(_data.RESULTS / "validation" / f"{model}.csv")["relmae"].mean()), 4)


def best_baseline() -> dict:
    name = min(BASELINES, key=pooled_relmae)
    return {"model": name, "relmae": pooled_relmae(name)}


def main() -> None:
    frozen = json.loads((_data.RESULTS / "frozen" / "arifnet.json").read_text(encoding="utf-8"))
    cfg = frozen["config"]
    card_path = _data.RESULTS / "models" / "arifnet" / "model_card.json"
    card = json.loads(card_path.read_text(encoding="utf-8"))
    tr, _ = ff.training_frame()
    if sha256(_data.RESULTS / "prospektif" / "train_snapshot.csv") != card["train_sha256"]:
        raise RuntimeError("training snapshot does not match the model card")

    # Feature order and preprocessing statistics exactly as build_fold computes them.
    groups = {g: _data.feature_columns(tr, (g,)) for g in ("PRICE", "CAL", "CALF", "DRIFT")}
    pre = {g: _data.Preprocessor(cols).fit(tr) for g, cols in groups.items() if g != "DRIFT"}
    stats = {g: {c: {"med": s[0].tolist(), "mu": s[1].tolist(), "sd": s[2].tolist()}
                 for c, s in p.stats.items()} for g, p in pre.items()}

    weights_dir = OUT / "model" / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)
    seeds = []
    models = {}
    for seed in _data.SEEDS:
        src = _data.RESULTS / "models" / "arifnet" / f"arifnet_s{seed}.pt"
        if sha256(src) != card["seeds"][str(seed)]["sha256"]:
            raise RuntimeError(f"seed {seed}: weights do not match the model card")
        # weights_only: no arbitrary unpickling; only numpy arrays (sigma) are allowed besides tensors.
        with torch.serialization.safe_globals(SAFE_NUMPY):
            ck = torch.load(src, weights_only=True, map_location="cpu")
        target = weights_dir / f"s{seed}.npz"
        np.savez(target, **{k: v.detach().cpu().numpy().astype(np.float32) for k, v in ck["state_dict"].items()})
        seeds.append({"seed": seed, "file": f"weights/s{seed}.npz", "sha256": sha256(target),
                      "source_sha256": card["seeds"][str(seed)]["sha256"],
                      "sigma": np.asarray(ck["sigma"], float).tolist()})
        models[seed] = ck

    holidays = json.loads((ARIF / "configs" / "calendar_holidays.json").read_text(encoding="utf-8"))
    holidays["_estimated"] = ESTIMATED_2027
    write_json(OUT / "model" / "calendar_holidays.json", holidays)

    scores = validation_scores()
    spec = {
        "name": "arif-net",
        "model_version": MODEL_VERSION,
        "preprocess_version": FEATURES_VERSION,
        "source": {"repository": "ARIF-Net", "commit": card["git"]["commit"], "train_end": card["train_end"],
                   "train_rows": card["train_rows"], "train_sha256": card["train_sha256"],
                   "frozen_utc": card["frozen_utc"]},
        "commodities": [{"id": c, "code": PRODUCT_CODES[c]} for c in _data.COMMODITIES],
        "horizons": list(_data.HORIZONS),
        "taus": list(M.TAUS),
        "L": int(cfg["train"]["L"]),
        "z_clip": float(_data.Z_CLIP),
        "model": {k: cfg["model"][k] for k in ("d", "emb", "encoder", "hurdle", "quantile", "drift",
                                                "drift_window", "drift_alpha")},
        "features": groups,
        "preprocess": stats,
        "seeds": seeds,
        "validation": {"metric": "relMAE vs persistence, folds F1-F2 x 5 seeds", "by_commodity": scores,
                       "overall": pooled_relmae("arifnet"), "best_baseline": best_baseline(),
                       "prospective_test": {"status": "not_opened", "opens_after": "2026-11-30"}},
    }
    write_json(OUT / "model" / "arifnet-a0.json", spec)
    shutil.copyfile(ARIF / "LICENSE", OUT / "model" / "LICENSE-ARIF-Net")
    shutil.copyfile(card_path, OUT / "model" / "model_card.json")
    golden(cfg, groups, pre, models)
    print("converted:", OUT / "model")


def synthetic_prices(seed: int, start_price: float, days: int = 1700) -> pd.DataFrame:
    """A made-up series shaped like PIHPS: mostly unchanged days, jumps, missing weekends."""
    rng = np.random.default_rng(seed)
    day0 = date(2022, 1, 3)
    rows, price = [], start_price
    for k in range(days):
        d = day0 + timedelta(days=k)
        if d.weekday() >= 5 or rng.random() < 0.03:
            continue
        if rng.random() < 0.2:
            price = max(1000.0, round(price * (1 + rng.normal(0, 0.04)) / 50) * 50)
        rows.append({"date": pd.Timestamp(d), "price": float(price)})
    return pd.DataFrame(rows)


def golden(cfg, groups, pre, models) -> None:
    """Reference computed step by step with the ARIF-Net code, on synthetic prices."""
    series = {"com_14": synthetic_prices(1, 45000.0), "com_11": synthetic_prices(2, 32000.0),
              "com_3": synthetic_prices(3, 14000.0)}
    calendar = pd.DataFrame(cal.build_calendar(date(2022, 1, 1), date(2028, 12, 31)))
    calendar["date"] = pd.to_datetime(calendar["date"])
    cal_cols = [c for c in calendar.columns if c not in ("date", "day_name", "year")]
    calendar = calendar[["date"] + cal_cols].set_index("date")

    bank = object.__new__(_data.SequenceBank)
    bank.L = int(cfg["train"]["L"])
    bank.prices = {c: (s["date"].to_numpy("datetime64[D]"), np.log(s["price"].to_numpy(float)))
                   for c, s in series.items()}

    cases = []
    for ci, c in enumerate(_data.COMMODITIES):
        s = series[c]
        pfeat = bd.build_price_features(s).set_index("date")
        for origin in (s["date"].iloc[-1], s["date"].iloc[-300]):
            o = np.datetime64(origin.date(), "D")
            hs = np.array(_data.HORIZONS)
            drift = bd.build_drift_features(s, np.full(len(hs), o), hs)
            for hi, h in enumerate(_data.HORIZONS):
                row = {"comcat_id": c}
                for col in groups["PRICE"]:
                    row[col] = pfeat.at[origin, col]
                for col in groups["CAL"]:
                    row[col] = calendar.at[origin, col.removeprefix("cal_")]
                tgt = origin + pd.Timedelta(days=h)
                for col in groups["CALF"]:
                    row[col] = calendar.at[tgt, col.removeprefix("tgt_cal_")]
                for col in groups["DRIFT"]:
                    row[col] = drift.iloc[hi][col]
                frame = pd.DataFrame([row])
                x = {g: pre[g].transform(frame)[0] for g in ("PRICE", "CAL", "CALF")}
                drift_raw = np.nan_to_num(frame[groups["DRIFT"]].to_numpy(np.float32), nan=0.0)[0]
                seq = bank.price_seq(c, o)
                per_seed = []
                for ck in models.values():
                    model = T_.build(cfg, _FD(ck["dims"]))
                    model.load_state_dict(ck["state_dict"])
                    model.eval()
                    sig = np.asarray(ck["sigma"])
                    B = {"c": torch.tensor([ci]), "hi": torch.tensor([hi]),
                         "seq": torch.as_tensor(seq[None]),
                         **{f"x_{g}": torch.as_tensor(x[g][None]) for g in ("PRICE", "CAL", "CALF")},
                         "x_DRIFT_RAW": torch.as_tensor(drift_raw[None])}
                    with torch.no_grad():
                        outs = model(B, torch.tensor([sig[ci, hi]], dtype=torch.float32))
                    per_seed.append({"logit": float(outs["logit"][0]), "q": outs["q"][0].tolist()})
                cases.append({"commodity": c, "origin": str(o), "h": h,
                              "features": {k: (None if pd.isna(v) else float(v)) for k, v in row.items()
                                           if k != "comcat_id"},
                              "x": {g: v.tolist() for g, v in x.items()}, "drift_raw": drift_raw.tolist(),
                              "seq": seq.tolist(), "seeds": per_seed})
    write_json(OUT / "tests" / "fixtures" / "golden.json", {
        "_doc": "Reference values from the ARIF-Net code on SYNTHETIC prices (tools/convert_from_arifnet.py).",
        "series": {c: [[d.date().isoformat(), p] for d, p in zip(s["date"], s["price"])] for c, s in series.items()},
        "cases": cases})


class _FD:
    """Just enough of a FoldData for train.build (it only reads `dims`)."""

    def __init__(self, dims: dict) -> None:
        self.dims = dims


if __name__ == "__main__":
    main()
