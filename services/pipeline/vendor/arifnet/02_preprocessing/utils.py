"""
ARIF-Net — Utilitas preprocessing bersama (path, konfigurasi, I/O atomik dari arifnet_core).
"""
from __future__ import annotations

from arifnet_core import settings
from arifnet_core.io import load_json, now_utc, save_df, save_json, sha256_file  # noqa: F401

ROOT = settings.ROOT
CONFIG = settings.CONFIG
DATA_RAW = settings.DATA_RAW
DATA_PROCESSED = settings.DATA_PROCESSED
DATA_FINAL = settings.DATA_FINAL
RESULTS = settings.RESULTS

_PROJECT = settings.project()
COMMODITIES = tuple(c["comcat_id"] for c in _PROJECT["commodities"])
COMMODITY_NAMES = {c["comcat_id"]: c["name"] for c in _PROJECT["commodities"]}
HORIZONS = tuple(_PROJECT["horizons"])
FOLDS = tuple(_PROJECT["validation"]["folds"])  # F3 = peran final (configs/project.json validation)


def load_project_config() -> dict:
    return settings.project()
