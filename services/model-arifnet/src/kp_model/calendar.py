"""Daily calendar features, exactly as ARIF-Net builds them (01_collection/collect_calendar.py)."""

from __future__ import annotations

import json
from dataclasses import dataclass
from datetime import date, timedelta
from pathlib import Path
from typing import Any

from kp_model.spec import resolve_model_dir

FLAGS = (
    "day_of_week",
    "month",
    "quarter",
    "is_weekend",
    "is_holiday",
    "is_ramadan",
    "is_idul_fitri",
    "is_idul_adha",
    "is_natal_tahun_baru",
    "is_kemerdekaan",
)


@dataclass(frozen=True)
class HolidayCalendar:
    idul_fitri: frozenset[date]
    idul_adha: frozenset[date]
    ramadan: frozenset[date]

    @staticmethod
    def from_config(cfg: dict[str, Any], include_estimates: bool = True) -> HolidayCalendar:
        """`_estimated` holds dates not yet in the research calendar (owner ruling K1)."""
        est: dict[str, Any] = cfg.get("_estimated", {}) if include_estimates else {}
        fitri: set[date] = set()
        for pair in [*cfg["idul_fitri"], *est.get("idul_fitri", [])]:
            for day in pair:
                d = date.fromisoformat(day)
                fitri.update(d + timedelta(days=k) for k in range(-3, 4))
        adha: set[date] = set()
        for day in [*cfg["idul_adha"], *est.get("idul_adha", [])]:
            d = date.fromisoformat(day)
            adha.update(d + timedelta(days=k) for k in range(-1, 2))
        ramadan: set[date] = set()
        for day in [*cfg["ramadan_start"], *est.get("ramadan_start", [])]:
            d = date.fromisoformat(day)
            ramadan.update(d + timedelta(days=k) for k in range(30))
        return HolidayCalendar(frozenset(fitri), frozenset(adha), frozenset(ramadan))

    @staticmethod
    def bundled(include_estimates: bool = True, model_dir: Path | None = None) -> HolidayCalendar:
        path = (model_dir or resolve_model_dir()) / "calendar_holidays.json"
        cfg: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
        return HolidayCalendar.from_config(cfg, include_estimates)

    def row(self, d: date) -> dict[str, float]:
        fixed = (d.month, d.day) in {(12, 25), (1, 1), (8, 17)}
        holiday = d in self.idul_fitri or d in self.idul_adha or fixed
        return {
            "day_of_week": float(d.weekday()),
            "month": float(d.month),
            "quarter": float((d.month - 1) // 3 + 1),
            "is_weekend": float(d.weekday() >= 5),
            "is_holiday": float(holiday),
            "is_ramadan": float(d in self.ramadan),
            "is_idul_fitri": float(d in self.idul_fitri),
            "is_idul_adha": float(d in self.idul_adha),
            "is_natal_tahun_baru": float((d.month == 12 and d.day >= 24) or (d.month == 1 and d.day <= 2)),
            "is_kemerdekaan": float(d.month == 8 and d.day == 17),
        }

    def features(self, d: date, prefix: str) -> dict[str, float]:
        return {f"{prefix}{k}": v for k, v in self.row(d).items()}
