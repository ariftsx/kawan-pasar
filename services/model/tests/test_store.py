import asyncio
from pathlib import Path

import pytest

from app.artifacts.loader import BundleError
from app.artifacts.store import ArtifactStore
from tests.bundles import make_live


@pytest.mark.parametrize(
    ("status", "expected"), [("candidate", "candidate"), ("validated", "available")]
)
def test_live_status_follows_the_artifact(tmp_path: Path, status: str, expected: str) -> None:
    release = make_live(tmp_path, status)
    try:
        (tmp_path / "current").symlink_to(release, target_is_directory=True)
    except OSError:  # Windows without Developer Mode; production and CI run on Linux
        pytest.skip("symlinks are not available")
    store = ArtifactStore("live", tmp_path)
    asyncio.run(store.reload())
    assert store.status == expected


def test_failed_reload_keeps_the_previous_bundle(tmp_path: Path) -> None:
    store = ArtifactStore("development", tmp_path)
    asyncio.run(store.reload())
    served = store.bundle
    store.mode = "live"  # live reads <artifacts>/current, which does not exist here
    with pytest.raises(BundleError):
        asyncio.run(store.reload())
    assert store.bundle is served


def test_startup_without_a_bundle_is_missing_not_fatal(tmp_path: Path) -> None:
    store = ArtifactStore("live", tmp_path)
    asyncio.run(store.load_at_startup())
    assert store.status == "missing"
