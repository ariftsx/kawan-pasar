"""Train, score and convert a candidate ARIF-Net A0 (Fase 4A task 6). Runs inside a staged run copy.

    python -m kp_pipeline.train --root <run>/arifnet --out <run>/model --data-end YYYY-MM-DD

1. Score: fit_predict on the evaluation fold (evaluation.EvalWindow), 5 seeds, relMAE per
   (commodity, horizon) averaged over seeds — the scores the product shows (eval_status, K2).
2. Final fit: like ARIF-Net's fit_final (5 seeds on origin & label <= data end), with the data end
   as a parameter instead of the research train_end.
3. Convert: like services/model-arifnet/tools/convert_from_arifnet.py — float32 .npz weights,
   feature order and preprocessing statistics, sigma per seed — into the product's model folder.

The frozen A0 configuration (results/frozen/arifnet.json) is used unchanged. Nothing here is ever
promoted: the output is a candidate an admin audits (owner decision P8).
"""

import argparse
import hashlib
import json
import logging
import shutil
import sys
from datetime import UTC, date, datetime
from importlib import import_module
from pathlib import Path
from types import ModuleType
from typing import Any

import numpy as np
import pandas as pd

from kp_pipeline.evaluation import EvalWindow, mean_scores, split_eval, split_final

log = logging.getLogger("kp_pipeline.train")
DATES = ["origin_date", "label_date", "target_date_nominal"]
MODEL_VERSION_PREFIX = "arifnet-a0-kp"
FEATURES_VERSION = "arifnet-features-v1.1.0"


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _write_json(path: Path, obj: object) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")


class Arif:
    """The staged ARIF-Net modules (imported from the run's own copy)."""

    def __init__(self, root: Path) -> None:
        sys.path.insert(0, str(root))
        self.data: ModuleType = import_module("03_training.data")
        self.metrics: ModuleType = import_module("03_training.metrics")
        self.ckpt: ModuleType = import_module("03_training.checkpoint")
        self.model: ModuleType = import_module("04_arif_net.model")
        self.train: ModuleType = import_module("04_arif_net.train")


def _quick(cfg: dict[str, Any], quick: bool) -> dict[str, Any]:
    """Tests only: one epoch. Never used for a candidate meant for the product."""
    if not quick:
        return cfg
    return {**cfg, "train": {**cfg["train"], "epochs": 1}}


def score(arif: Arif, full: pd.DataFrame, cfg: dict[str, Any], data_end: date) -> dict[str, Any]:
    window = EvalWindow.for_data_end(data_end)
    train, ev = split_eval(full, window, data_end)
    if train.empty or ev.empty:
        raise RuntimeError("evaluation fold is empty: not enough history before the data end")
    fd = arif.data.build_fold("candidate-eval", train, ev, int(cfg["train"]["L"]))
    tables, pooled = [], []
    for seed in arif.data.SEEDS:
        preds, _ = arif.train.fit_predict(fd, cfg, seed, log=log.info)
        frame = fd.frames_val.reset_index(drop=True).copy()
        frame["r_hat"] = preds["r_hat"]
        tables.append(arif.metrics.table(frame))
        pooled.append(float(arif.metrics.overall(frame)["relmae"]))
        log.info("evaluation seed %s: relMAE %.4f", seed, pooled[-1])
    return {
        "metric": "relMAE vs persistence, evaluation fold x 5 seeds (ARIF-Net fold method)",
        # Read with care (Fase 4A review): the frozen A0 configuration was selected by ARIF-Net on
        # data that may overlap this window, and the scored fit (trained before the window) is not
        # the deployed fit (trained up to the data end). Only the prospective test is independent.
        "note": (
            "not independent evidence: window may overlap A0's selection data; scored fit != deployed fit"
        ),
        "window": {"start": window.start.isoformat(), "end": window.end.isoformat()},
        "train_rows": len(train),
        "eval_rows": len(ev),
        "by_commodity": mean_scores(tables),
        "overall": round(float(np.mean(pooled)), 4),
    }


def final_fit(
    arif: Arif, full: pd.DataFrame, cfg: dict[str, Any], data_end: date, out: Path
) -> tuple[pd.DataFrame, dict[str, Any], dict[int, dict[str, Any]]]:
    """fit_final with the data end as a parameter. Returns (train frame, card, checkpoints)."""
    import torch  # heavy: only in the training process

    tr = split_final(full, data_end)
    ev = tr[tr["origin_date"] == tr["origin_date"].max()]  # unused for fitting; build_fold needs a val part
    fd = arif.data.build_fold("final-deploy", tr, ev, int(cfg["train"]["L"]))
    weights = out / "pt"
    weights.mkdir(parents=True, exist_ok=True)
    checkpoints: dict[int, dict[str, Any]] = {}
    seeds: dict[str, dict[str, str]] = {}
    for seed in arif.data.SEEDS:
        base = out / "checkpoints" / f"fit_s{seed}"
        base.parent.mkdir(parents=True, exist_ok=True)
        with arif.ckpt.scope(base):
            torch.manual_seed(seed)
            model = arif.train.build(cfg, fd)
            info = arif.train.fit(model, fd, cfg, seed, log=log.info)
        ck = {
            "state_dict": model.state_dict(),
            "sigma": info["sigma"],
            "dims": fd.dims,
            "L": fd.L,
            "config": cfg,
            "seed": seed,
            "lambda_drift": info.get("lambda_drift"),
            "created_utc": datetime.now(UTC).isoformat(timespec="seconds"),
        }
        target = weights / f"arifnet_s{seed}.pt"
        torch.save(ck, target)
        arif.ckpt.clear(base)
        checkpoints[seed] = ck
        seeds[str(seed)] = {"file": target.name, "sha256": _sha256(target)}
        log.info("final seed %s saved", seed)
    card = {
        "model": "ARIF-Net A0 (Kawan Pasar retraining)",
        "config": cfg,
        "train_end": data_end.isoformat(),
        "train_rows": len(tr),
        "commodities": list(arif.data.COMMODITIES),
        "horizons": list(arif.data.HORIZONS),
        "seeds": seeds,
    }
    return tr, card, checkpoints


def convert(
    arif: Arif,
    tr: pd.DataFrame,
    cfg: dict[str, Any],
    checkpoints: dict[int, dict[str, Any]],
    card: dict[str, Any],
    validation: dict[str, Any],
    product_codes: dict[str, str],
    root: Path,
    out: Path,
    run_id: str,
) -> Path:
    """The product's model folder (same layout as services/model-arifnet/model)."""
    model_dir = out / "model"
    weights_dir = model_dir / "weights"
    weights_dir.mkdir(parents=True, exist_ok=True)
    # Feature order and preprocessing statistics exactly as build_fold computes them.
    groups = {g: arif.data.feature_columns(tr, (g,)) for g in ("PRICE", "CAL", "CALF", "DRIFT")}
    pre = {g: arif.data.Preprocessor(cols).fit(tr) for g, cols in groups.items() if g != "DRIFT"}
    stats = {
        g: {c: {"med": s[0].tolist(), "mu": s[1].tolist(), "sd": s[2].tolist()} for c, s in p.stats.items()}
        for g, p in pre.items()
    }
    seeds = []
    for seed, ck in sorted(checkpoints.items()):
        target = weights_dir / f"s{seed}.npz"
        np.savez(
            target,
            **{k: v.detach().cpu().numpy().astype(np.float32) for k, v in ck["state_dict"].items()},
        )
        seeds.append(
            {
                "seed": seed,
                "file": f"weights/s{seed}.npz",
                "sha256": _sha256(target),
                "source_sha256": card["seeds"][str(seed)]["sha256"],
                "sigma": np.asarray(ck["sigma"], float).tolist(),
            }
        )
    missing = [c for c in arif.data.COMMODITIES if c not in product_codes]
    if missing:
        raise RuntimeError(f"no product code for {missing}")
    spec = {
        "name": "arif-net",
        "model_version": f"{MODEL_VERSION_PREFIX}-{run_id}",
        "preprocess_version": FEATURES_VERSION,
        "source": {
            "repository": "ARIF-Net (copy in services/pipeline/vendor, Fase 4A)",
            "train_end": card["train_end"],
            "train_rows": card["train_rows"],
            "run": run_id,
        },
        "commodities": [{"id": c, "code": product_codes[c]} for c in arif.data.COMMODITIES],
        "horizons": list(arif.data.HORIZONS),
        "taus": list(arif.model.TAUS),
        "L": int(cfg["train"]["L"]),
        "z_clip": float(arif.data.Z_CLIP),
        "model": {
            k: cfg["model"][k]
            for k in ("d", "emb", "encoder", "hurdle", "quantile", "drift", "drift_window", "drift_alpha")
        },
        "features": groups,
        "preprocess": stats,
        "seeds": seeds,
        "validation": validation,
    }
    _write_json(model_dir / "arifnet-a0.json", spec)
    shutil.copyfile(root / "configs" / "calendar_holidays.json", model_dir / "calendar_holidays.json")
    shutil.copyfile(root / "LICENSE", model_dir / "LICENSE-ARIF-Net")
    _write_json(model_dir / "model_card.json", card)
    return model_dir


def main(argv: list[str] | None = None) -> int:
    ap = argparse.ArgumentParser(prog="kp_pipeline.train")
    ap.add_argument("--root", required=True, type=Path)
    ap.add_argument("--out", required=True, type=Path)
    ap.add_argument("--data-end", required=True, type=date.fromisoformat)
    ap.add_argument("--run-id", required=True)
    ap.add_argument("--product-codes", required=True, help="JSON {comcat_id: product code}")
    ap.add_argument("--quick", action="store_true", help="tests only: 1 epoch")
    args = ap.parse_args(argv)
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s %(message)s")
    arif = Arif(args.root)
    frozen = json.loads((args.root / "results" / "frozen" / "arifnet.json").read_text(encoding="utf-8"))
    cfg = _quick(frozen["config"], args.quick)
    full = pd.read_csv(arif.data.DATA_FINAL / "dataset_full.csv", parse_dates=DATES)
    if (full["origin_date"] > pd.Timestamp(args.data_end)).any():
        # The configs already stop collection at the data end; this is the last line of defence.
        raise RuntimeError("dataset holds origins after the data end")
    validation = score(arif, full, cfg, args.data_end)
    tr, card, checkpoints = final_fit(arif, full, cfg, args.data_end, args.out)
    model_dir = convert(
        arif,
        tr,
        cfg,
        checkpoints,
        card,
        validation,
        json.loads(args.product_codes),
        args.root,
        args.out,
        args.run_id,
    )
    print(json.dumps({"model_dir": str(model_dir), "overall_relmae": validation["overall"]}))
    return 0


if __name__ == "__main__":
    sys.exit(main())
