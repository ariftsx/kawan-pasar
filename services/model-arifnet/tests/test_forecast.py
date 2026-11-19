"""Mixture quantiles, the ensemble forecast and the bundle (contract v1, ADR 0012)."""

from __future__ import annotations

import csv
import hashlib
import io
import json
from datetime import UTC, date, datetime
from pathlib import Path
from typing import Any

import numpy as np
import pytest

from kp_model.bundle import BundleError, read_prices_csv, write_bundle
from kp_model.calendar import HolidayCalendar
from kp_model.features import Series
from kp_model.forecast import forecast, mixture_quantile
from kp_model.spec import ModelIntegrityError, load_spec

TAUS = [0.1, 0.25, 0.5, 0.75, 0.9]
GOLDEN: dict[str, Any] = json.loads(
    (Path(__file__).parent / "fixtures" / "golden.json").read_text(encoding="utf-8")
)
NOW = datetime(2026, 11, 19, 3, 0, tzinfo=UTC)


def golden_series() -> dict[str, Series]:
    return {
        c: Series.from_rows([(date.fromisoformat(d), float(p)) for d, p in rows])
        for c, rows in GOLDEN["series"].items()
    }


class TestMixtureQuantile:
    def test_median_is_zero_when_no_change_is_likely(self) -> None:
        q = np.array([-0.2, -0.1, 0.05, 0.1, 0.3])
        assert mixture_quantile(0.3, q, 0.5, TAUS) == 0.0

    def test_certain_change_reads_the_conditional_quantiles(self) -> None:
        q = np.array([-0.2, -0.1, 0.05, 0.1, 0.3])
        assert mixture_quantile(1.0, q, 0.5, TAUS) == pytest.approx(0.05)
        assert mixture_quantile(1.0, q, 0.1, TAUS) == pytest.approx(-0.2)
        assert mixture_quantile(1.0, q, 0.9, TAUS) == pytest.approx(0.3)

    def test_is_monotone_in_the_level(self) -> None:
        q = np.array([-0.5, -0.2, 0.01, 0.2, 0.6])
        values = [mixture_quantile(0.6, q, lvl, TAUS) for lvl in np.linspace(0.05, 0.95, 19)]
        assert values == sorted(values)


class TestForecast:
    def test_one_row_per_commodity_and_horizon_with_monotone_prices(self) -> None:
        spec = load_spec()
        rows = forecast(spec, golden_series(), HolidayCalendar.bundled())
        assert len(rows) == 3 * 8
        assert {(r.commodity_code, r.horizon_days) for r in rows} == {
            (spec.product_code(c), h) for c in spec.commodity_ids for h in spec.horizons
        }
        for r in rows:
            assert r.q10_change <= r.q50_change <= r.q90_change
            assert 0 < r.q10_price_idr <= r.q50_price_idr <= r.q90_price_idr

    def test_eval_status_follows_the_validation_scores(self) -> None:
        # Owner ruling K2: available when ARIF-Net beat "price unchanged" in validation.
        spec = load_spec()
        for r in forecast(spec, golden_series(), HolidayCalendar.bundled()):
            cid = spec.commodity_for_code(r.commodity_code)
            assert cid is not None
            expected = "available" if spec.relmae(cid, r.horizon_days) < 1 else "partial"
            assert r.eval_status == expected

    def test_uses_only_prices_up_to_the_last_observation(self) -> None:
        spec = load_spec()
        series = golden_series()
        base = forecast(spec, series, HolidayCalendar.bundled())
        # Same history, so the same forecast whatever happens to unrelated commodities.
        again = forecast(spec, dict(series), HolidayCalendar.bundled())
        assert [r.q50_change for r in base] == [r.q50_change for r in again]

    def test_tampered_weights_are_refused(self, tmp_path: Path) -> None:
        import shutil

        src = Path(load_spec.__globals__["DEFAULT_DIR"])
        shutil.copytree(src, tmp_path / "model")
        target = tmp_path / "model" / "weights" / "s0.npz"
        data = bytearray(target.read_bytes())
        data[-10] ^= 1
        target.write_bytes(bytes(data))
        with pytest.raises(ModelIntegrityError):
            load_spec(tmp_path / "model")


class TestBundle:
    def write(self, tmp_path: Path) -> Path:
        spec = load_spec()
        prices = tmp_path / "prices.csv"
        lines = ["commodity_code,observed_on,price_idr"]
        for cid, rows in GOLDEN["series"].items():
            lines += [f"{spec.product_code(cid)},{d},{int(p)}" for d, p in rows]
        prices.write_text("\n".join(lines) + "\n", encoding="utf-8")
        series = read_prices_csv(prices, spec)
        rows = forecast(spec, series, HolidayCalendar.bundled())
        return write_bundle(tmp_path / "out", spec, rows, prices, NOW)

    def test_writes_the_contract_files_with_matching_checksums(self, tmp_path: Path) -> None:
        out = self.write(tmp_path)
        assert sorted(p.name for p in out.iterdir()) == ["SHA256SUMS", "forecasts.csv", "metadata.json"]
        sums = {}
        for line in (out / "SHA256SUMS").read_text().splitlines():
            digest, name = line.split("  ")
            sums[name] = digest
        for name in ("forecasts.csv", "metadata.json"):
            assert sums[name] == hashlib.sha256((out / name).read_bytes()).hexdigest()

    def test_metadata_names_the_model_and_data_versions(self, tmp_path: Path) -> None:
        out = self.write(tmp_path)
        meta = json.loads((out / "metadata.json").read_text())
        assert meta["model_name"] == "arif-net"
        assert meta["model_version"].startswith("arifnet-a0-v1.1.0+")
        assert meta["preprocess_version"] == "arifnet-features-v1.1.0"
        last = max(d for rows in GOLDEN["series"].values() for d, _ in rows)
        assert meta["data_version"].startswith(f"pihps-{last}-")
        assert meta["data_cutoff"] == f"{last}T23:59:59+07:00"
        assert meta["issued_at"] == "2026-11-19T03:00:00.000Z"
        assert meta["bundle_id"] == out.name
        assert len(meta["bundle_id"]) <= 121

    def test_csv_follows_the_contract_columns_and_rounding(self, tmp_path: Path) -> None:
        out = self.write(tmp_path)
        reader = csv.DictReader(io.StringIO((out / "forecasts.csv").read_text()))
        assert reader.fieldnames == [
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
        rows = list(reader)
        assert len(rows) == 24
        for r in rows:
            assert r["market_code"] == "PIKJ"
            for k in ("q10_change", "q50_change", "q90_change"):
                assert len(r[k].split(".")[-1]) <= 6
            assert r["q50_price_idr"].isdigit()

    def test_refuses_unknown_codes_and_bad_rows(self, tmp_path: Path) -> None:
        spec = load_spec()
        bad = tmp_path / "bad.csv"
        for body in (
            "commodity_code,observed_on,price_idr\ncabai-rawit-merah,2026-09-30,50000\n",
            "commodity_code,observed_on,price_idr\nbawang-merah,2026-09-30,-1\n",
            "commodity_code,observed_on,price_idr\nbawang-merah,30-09-2026,40000\n",
            "kode,tanggal,harga\nbawang-merah,2026-09-30,40000\n",
        ):
            bad.write_text(body, encoding="utf-8")
            with pytest.raises(BundleError):
                read_prices_csv(bad, spec)
