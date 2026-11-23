"""Task 1: the copied ARIF-Net code is used only when it matches its manifest, and is staged per run."""

from pathlib import Path

import pytest

from kp_pipeline.vendor import VENDOR_DIR, VendorError, stage, verify


def test_the_repository_copy_matches_its_manifest() -> None:
    files = verify(VENDOR_DIR)
    assert "04_arif_net/train.py" in files
    assert "results/frozen/arifnet.json" in files
    assert len(files) == 30


def _fake_vendor(tmp_path: Path) -> Path:
    root = tmp_path / "vendor"
    (root / "pkg").mkdir(parents=True)
    (root / "pkg" / "a.py").write_bytes(b"x = 1\n")
    (root / "MANIFEST.sha256").write_text(
        # sha256 of b"x = 1\n"
        "6d5b5d3a1f9a1b7f84b6ec0f1c3e3f0c4f0e0a1a2b4f4d5d1d3e5c3d2f1e0a9b  ./pkg/a.py\n",
        encoding="utf-8",
    )
    return root


def test_a_changed_file_is_refused(tmp_path: Path) -> None:
    root = _fake_vendor(tmp_path)
    with pytest.raises(VendorError, match=r"pkg/a\.py: sha256 differs"):
        verify(root)


def test_a_missing_or_extra_file_is_refused(tmp_path: Path) -> None:
    root = tmp_path / "vendor"
    root.mkdir()
    (root / "MANIFEST.sha256").write_text(f"{'0' * 64}  ./gone.py\n", encoding="utf-8")
    with pytest.raises(VendorError, match=r"gone\.py: missing"):
        verify(root)
    (root / "MANIFEST.sha256").write_text("", encoding="utf-8")
    (root / "extra.py").write_bytes(b"")
    with pytest.raises(VendorError, match=r"extra\.py: not in the manifest"):
        verify(root)


def test_stage_copies_the_verified_code_into_the_run_directory(tmp_path: Path) -> None:
    run = tmp_path / "run"
    staged = stage(run)
    assert staged == run / "arifnet"
    assert (staged / "04_arif_net" / "train.py").read_bytes() == (
        VENDOR_DIR / "04_arif_net" / "train.py"
    ).read_bytes()
    # The run gets its own writable folders; the repository copy is never written to.
    for folder in ("configs", "data", "results", "logs", "state"):
        assert (staged / folder).is_dir()
    with pytest.raises(VendorError, match="already staged"):
        stage(run)


def test_only_root_level_notes_are_exempt_and_names_cannot_escape(tmp_path: Path) -> None:
    root = tmp_path / "vendor"
    (root / "sub").mkdir(parents=True)
    (root / "MANIFEST.sha256").write_text("", encoding="utf-8")
    (root / "sub" / "SOURCE.md").write_bytes(b"hidden")
    with pytest.raises(VendorError, match=r"sub/SOURCE\.md: not in the manifest"):
        verify(root)
    (root / "sub" / "SOURCE.md").unlink()
    (root / "MANIFEST.sha256").write_text(f"{'0' * 64}  ./../outside.py\n", encoding="utf-8")
    with pytest.raises(VendorError, match="outside the copy"):
        verify(root)
