"""Path proyek, konfigurasi, dan pengaturan runtime dari environment.

Urutan prioritas: variabel environment > file `.env` di root repo > nilai bawaan.
Tidak ada kredensial yang dibutuhkan pipeline; semua sumber data bersifat publik. Nilai yang dapat diatur
didokumentasikan di `.env.example`.

Fase pipeline (`ARIFNET_PHASE`):
  development  data sampai `data_end` (2026-09-30); desain, seleksi, validasi, registrasi.
  prospective  data sampai `prospective.cutoff`; hanya untuk pembukaan uji prospektif sesudah registrasi.
"""
from __future__ import annotations

import json
import os
from datetime import date
from functools import cache
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[1]
CONFIG = ROOT / "configs"
DATA = ROOT / "data"
DATA_RAW = DATA / "raw"
DATA_PROCESSED = DATA / "processed"
DATA_FINAL = DATA / "final"
RESULTS = ROOT / "results"
LOGS = ROOT / "logs"
STATE = ROOT / "state"

PHASES = ("development", "prospective")


def _load_dotenv(path: Path) -> None:
    """Muat `KEY=VALUE` dari .env tanpa menimpa variabel yang sudah ada."""
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key, value = key.strip(), value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


_load_dotenv(ROOT / ".env")


def env(name: str, default: str | None = None) -> str | None:
    value = os.environ.get(name)
    return value if value not in (None, "") else default


def env_float(name: str, default: float) -> float:
    value = env(name)
    return float(value) if value is not None else default


def env_int(name: str, default: int) -> int:
    value = env(name)
    return int(value) if value is not None else default


def load_json(path: Path) -> Any:
    return json.loads(Path(path).read_text(encoding="utf-8"))


@cache
def project() -> dict:
    return load_json(CONFIG / "project.json")


def phase() -> str:
    value = (env("ARIFNET_PHASE", "development") or "development").lower()
    if value not in PHASES:
        raise ValueError(f"ARIFNET_PHASE={value!r} tidak dikenal; pilih {PHASES}")
    return value


def period_start() -> date:
    return date.fromisoformat(project()["period"]["start"])


def data_end() -> date:
    """Batas akhir data untuk fase aktif (koleksi, label target)."""
    cfg = project()
    if phase() == "prospective":
        return date.fromisoformat(cfg["prospective"]["cutoff"])
    return date.fromisoformat(cfg["data_end"])


def development_end() -> date:
    return date.fromisoformat(project()["data_end"])


@cache
def http_config() -> dict:
    return load_json(CONFIG / "http.json")


def user_agent() -> str:
    return env("ARIFNET_USER_AGENT", http_config()["user_agent"])


def http_delay_scale() -> float:
    """Pengali jeda antar-request (mis. 2 = dua kali lebih pelan)."""
    return max(0.1, env_float("ARIFNET_HTTP_DELAY_SCALE", 1.0))


def network_max_wait_minutes() -> float:
    """Lama maksimum menunggu internet kembali untuk satu request sebelum dianggap gagal."""
    return env_float("ARIFNET_NET_MAX_WAIT_MIN", 360.0)
