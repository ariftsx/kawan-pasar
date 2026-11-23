"""The copied ARIF-Net code (vendor/arifnet): verified against its manifest, then staged per run.

ARIF-Net computes every path (configs, data, results) from its own location and has no override,
so each run works on its own copy: the repository copy is never written to, and a run directory
holds exactly the code, configuration, data and weights it used.
"""

import hashlib
import shutil
from pathlib import Path

from kp_pipeline.paths import vendor_dir

VENDOR_DIR = vendor_dir()
MANIFEST = "MANIFEST.sha256"
# Documentation next to the code, not part of it.
_NOT_CODE = {MANIFEST, "SOURCE.md"}
# Folders ARIF-Net writes into (settings.py: CONFIG, DATA, RESULTS, LOGS, STATE).
WRITABLE = ("configs", "data", "results", "logs", "state")


class VendorError(RuntimeError):
    """The copied code is not exactly what the manifest says, or cannot be staged."""


def _sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify(root: Path) -> list[str]:
    """Checks every file against MANIFEST.sha256 (and that there are no others); returns their paths."""
    expected: dict[str, str] = {}
    for line in (root / MANIFEST).read_text(encoding="utf-8").splitlines():
        if line.strip() == "":
            continue
        digest, name = line.split(maxsplit=1)
        # sha256sum writes "<hash>  ./path", or "<hash> *./path" in binary mode (Git Bash on Windows).
        rel = name.strip().lstrip("*").removeprefix("./")
        if rel.startswith(("/", "\\")) or ".." in Path(rel).parts or ":" in rel:
            raise VendorError(f"{rel}: outside the copy")
        expected[rel] = digest
    present = {
        p.relative_to(root).as_posix()
        for p in root.rglob("*")
        # Notes are exempt at the root only; a SOURCE.md in a subfolder would be unverified code.
        if p.is_file() and not (p.parent == root and p.name in _NOT_CODE) and "__pycache__" not in p.parts
    }
    for name in sorted(present - expected.keys()):
        raise VendorError(f"{name}: not in the manifest")
    for name, digest in sorted(expected.items()):
        path = root / name
        if not path.is_file():
            raise VendorError(f"{name}: missing")
        if _sha256(path) != digest:
            raise VendorError(f"{name}: sha256 differs from the manifest")
    return sorted(expected)


def stage(run_dir: Path, source: Path = VENDOR_DIR) -> Path:
    """Copies the verified code to `<run_dir>/arifnet` with empty writable folders; returns that path."""
    files = verify(source)
    target = run_dir / "arifnet"
    if target.exists():
        raise VendorError(f"{target}: already staged")
    for name in files:
        dest = target / name
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source / name, dest)
    for folder in WRITABLE:
        (target / folder).mkdir(parents=True, exist_ok=True)
    # The staged copy is checked again: a run never starts on code that differs from the manifest.
    shutil.copy2(source / MANIFEST, target / MANIFEST)
    verify(target)
    return target
