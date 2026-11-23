"""Per-run ARIF-Net configuration (Fase 4A task 2).

ARIF-Net's configs/project.json carries the frozen research settings (horizons, target rules,
validation, availability lags, training). A run keeps all of them and replaces only what the
product decides: the commodities (from the catalog mirror) and the data end (from the
prospective-test lock).
"""

import json
from dataclasses import dataclass
from datetime import date
from pathlib import Path

from kp_pipeline.paths import commodities_file

COMMODITIES_FILE = commodities_file()


class ConfigError(ValueError):
    """The run configuration would be invalid."""


@dataclass(frozen=True)
class Commodity:
    comcat_id: str
    code: str  # product code (packages/catalog)
    name: str
    pihps_name: str


def load_commodities(path: Path = COMMODITIES_FILE) -> list[Commodity]:
    """Commodities with a PIHPS comcat_id, in catalog order (mirror of packages/catalog)."""
    raw = json.loads(path.read_text(encoding="utf-8"))
    out = [
        Commodity(str(c["comcat_id"]), str(c["code"]), str(c["name"]), str(c["pihps_name"]))
        for c in raw["commodities"]
        if c.get("comcat_id")
    ]
    if not out:
        raise ConfigError("no commodity has a PIHPS comcat_id")
    return out


def write_project(staged: Path, commodities: list[Commodity], data_end: date) -> dict[str, object]:
    """Rewrites <staged>/configs/project.json for this run; returns it."""
    path = staged / "configs" / "project.json"
    project: dict[str, object] = json.loads(path.read_text(encoding="utf-8"))
    period = project["period"]
    if not isinstance(period, dict):
        raise ConfigError("project.json: period is not an object")
    if data_end < date.fromisoformat(str(period["start"])):
        raise ConfigError("data end is before the history starts")
    end = data_end.isoformat()
    project["period"] = {**period, "end": end}
    project["data_end"] = end
    prospective = project["prospective"]
    if not isinstance(prospective, dict):
        raise ConfigError("project.json: prospective is not an object")
    # fit_final trains on origin & label <= prospective.train_end: the newest data the lock allows.
    project["prospective"] = {**prospective, "train_end": end}
    project["commodities"] = [
        {"comcat_id": c.comcat_id, "name": c.name, "pihps_name": c.pihps_name} for c in commodities
    ]
    path.write_text(json.dumps(project, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    return project
