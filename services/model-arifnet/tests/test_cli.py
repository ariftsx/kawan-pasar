"""Command line, calendar estimates and input validation."""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any

import pytest

from kp_model.__main__ import main
from kp_model.calendar import HolidayCalendar
from kp_model.features import Series, price_features
from kp_model.spec import load_spec

GOLDEN: dict[str, Any] = json.loads(
    (Path(__file__).parent / "fixtures" / "golden.json").read_text(encoding="utf-8")
)


def prices_file(tmp_path: Path) -> Path:
    spec = load_spec()
    lines = ["commodity_code,observed_on,price_idr"]
    for cid, rows in GOLDEN["series"].items():
        lines += [f"{spec.product_code(cid)},{d},{int(p)}" for d, p in rows]
    path = tmp_path / "prices.csv"
    path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return path


def test_writes_a_bundle_and_prints_its_path(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    code = main(
        [
            "--prices",
            str(prices_file(tmp_path)),
            "--out",
            str(tmp_path / "out"),
            "--now",
            "2026-11-19T03:00:00+00:00",
        ]
    )
    assert code == 0
    printed = Path(capsys.readouterr().out.strip())
    assert printed.parent == tmp_path / "out"
    assert (printed / "SHA256SUMS").exists()


def test_refused_input_exits_2_with_a_reason(tmp_path: Path, capsys: pytest.CaptureFixture[str]) -> None:
    bad = tmp_path / "bad.csv"
    bad.write_text("commodity_code,observed_on,price_idr\ngula-pasir,2026-09-30,15000\n", encoding="utf-8")
    assert main(["--prices", str(bad), "--out", str(tmp_path / "out")]) == 2
    assert "not covered" in capsys.readouterr().err
    assert not (tmp_path / "out").exists()


def test_missing_commodity_is_refused(tmp_path: Path) -> None:
    only = tmp_path / "only.csv"
    only.write_text("commodity_code,observed_on,price_idr\nbawang-merah,2026-09-30,40000\n", encoding="utf-8")
    assert main(["--prices", str(only), "--out", str(tmp_path / "out")]) == 2


def test_the_same_bundle_is_not_written_twice(tmp_path: Path) -> None:
    args = [
        "--prices",
        str(prices_file(tmp_path)),
        "--out",
        str(tmp_path / "out"),
        "--now",
        "2026-11-19T03:00:00+00:00",
    ]
    assert main(args) == 0
    assert main(args) == 2


class TestCalendar:
    def test_2027_hijri_holidays_are_estimates_switchable_off(self) -> None:
        lebaran_2027 = date(2027, 3, 10)
        with_est = HolidayCalendar.bundled(include_estimates=True).row(lebaran_2027)
        without = HolidayCalendar.bundled(include_estimates=False).row(lebaran_2027)
        assert with_est["is_idul_fitri"] == 1.0 and with_est["is_holiday"] == 1.0
        assert without["is_idul_fitri"] == 0.0
        assert HolidayCalendar.bundled().row(date(2027, 2, 20))["is_ramadan"] == 1.0

    def test_fixed_holidays_and_weekends(self) -> None:
        cal = HolidayCalendar.bundled()
        assert cal.row(date(2026, 8, 17))["is_kemerdekaan"] == 1.0
        assert cal.row(date(2026, 12, 25))["is_holiday"] == 1.0
        assert cal.row(date(2026, 12, 31))["is_natal_tahun_baru"] == 1.0
        assert cal.row(date(2026, 11, 21))["is_weekend"] == 1.0


class TestSeries:
    def test_rejects_duplicates_and_non_positive_prices(self) -> None:
        with pytest.raises(ValueError):
            Series.from_rows([(date(2026, 9, 30), 1.0), (date(2026, 9, 30), 2.0)])
        with pytest.raises(ValueError):
            Series.from_rows([(date(2026, 9, 30), 0.0)])
        with pytest.raises(ValueError):
            Series.from_rows([])

    def test_short_history_gives_missing_features_not_errors(self) -> None:
        s = Series.from_rows([(date(2026, 9, 29), 100.0), (date(2026, 9, 30), 110.0)])
        f = price_features(s, date(2026, 9, 30))
        assert f["return_1d"] == pytest.approx(0.1)
        assert f["return_30d"] != f["return_30d"]  # NaN: filled with the training median later
        with pytest.raises(ValueError):
            price_features(s, date(2026, 9, 1))


def test_a_missing_price_file_is_a_refusal_not_a_crash(tmp_path: Path) -> None:
    assert main(["--prices", str(tmp_path / "nope.csv"), "--out", str(tmp_path / "out")]) == 2


def test_the_image_model_directory_is_used_for_weights_and_calendar(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    import shutil

    from kp_model.spec import DEFAULT_DIR

    copy = tmp_path / "model"
    shutil.copytree(DEFAULT_DIR, copy)
    cfg = json.loads((copy / "calendar_holidays.json").read_text(encoding="utf-8"))
    cfg["idul_adha"].append("2026-11-23")  # only in the copy
    (copy / "calendar_holidays.json").write_text(json.dumps(cfg), encoding="utf-8")
    monkeypatch.setenv("KP_MODEL_DIR", str(copy))
    assert HolidayCalendar.bundled().row(date(2026, 11, 23))["is_idul_adha"] == 1.0
    assert load_spec().seeds[0].seed == 0
