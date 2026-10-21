"""Test helpers that copy the demo bundle and edit it while keeping every checksum valid."""

import hashlib
import json
import shutil
from collections.abc import Callable
from pathlib import Path
from typing import Any

from app.artifacts.loader import DEMO_BUNDLE

Json = dict[str, Any]


def copy_demo(parent: Path, name: str = DEMO_BUNDLE.name) -> Path:
    target = parent / name
    shutil.copytree(DEMO_BUNDLE, target)
    return target


def rewrite(root: Path, relative: str, change: Callable[[Json], None]) -> None:
    """Edits one file and re-signs it in the manifest, so only the edited rule can fail."""
    path = root / relative
    payload: Json = json.loads(path.read_text(encoding="utf-8"))
    change(payload)
    data = json.dumps(payload).encode()
    path.write_bytes(data)
    if relative == "manifest.json":
        return
    manifest_path = root / "manifest.json"
    manifest: Json = json.loads(manifest_path.read_text(encoding="utf-8"))
    for entry in manifest["files"]:
        if entry["path"] == relative:
            entry.update(sha256=hashlib.sha256(data).hexdigest(), bytes=len(data))
    manifest_path.write_text(json.dumps(manifest), encoding="utf-8")


def make_live(parent: Path, status: str, model_version: str = "arif-net-0.0.1") -> Path:
    """A live-shaped bundle built from the demo files: test-only, never a real result."""
    root = copy_demo(parent, f"{model_version}__2026-10-18")
    manifest: Json = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
    for commodity in manifest["commodities"]:
        rewrite(
            root,
            f"forecasts/{commodity}.json",
            lambda f: f["run"].update(model_version=model_version),
        )
    rewrite(
        root,
        "manifest.json",
        lambda m: m.update(
            bundle_id=root.name, model_version=model_version, artifact_status=status
        ),
    )
    return root
