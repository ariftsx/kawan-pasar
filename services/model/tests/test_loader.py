from pathlib import Path

import pytest

from app.artifacts.loader import DEMO_BUNDLE, BundleError, load_bundle, reconstruct_price
from tests.bundles import Json, copy_demo, make_live, rewrite


@pytest.fixture
def bundle(tmp_path: Path) -> Path:
    return copy_demo(tmp_path)


def test_loads_the_packaged_demo_bundle() -> None:
    loaded = load_bundle(DEMO_BUNDLE, "development")
    assert loaded.manifest.model_version == "demo"
    assert set(loaded.forecasts) == {"cabai-merah-keriting", "bawang-merah", "beras-medium-1"}
    points = loaded.forecasts["cabai-merah-keriting"].points
    seven_day = next(p for p in points if p.horizon_day == 7)
    assert (seven_day.predicted_change, seven_day.predicted_price_idr) == (0.028, 53867)


def test_live_mode_loads_a_candidate_bundle(tmp_path: Path) -> None:
    loaded = load_bundle(make_live(tmp_path, "candidate"), "live")
    assert loaded.manifest.artifact_status == "candidate"


def test_live_mode_never_serves_the_demo(bundle: Path) -> None:
    with pytest.raises(BundleError, match="mode live"):
        load_bundle(bundle, "live")


def test_live_mode_rejects_a_draft(tmp_path: Path) -> None:
    with pytest.raises(BundleError, match="mode live"):
        load_bundle(make_live(tmp_path, "draft"), "live")


def test_development_mode_only_serves_a_draft_demo(bundle: Path) -> None:
    rewrite(bundle, "manifest.json", lambda m: m.update(artifact_status="candidate"))
    with pytest.raises(BundleError, match="mode development"):
        load_bundle(bundle, "development")


def test_rejects_a_tampered_file(bundle: Path) -> None:
    path = bundle / "forecasts" / "bawang-merah.json"
    path.write_bytes(path.read_bytes().replace(b"38933", b"38934"))
    with pytest.raises(BundleError, match="checksum"):
        load_bundle(bundle, "development")


def test_rejects_a_file_missing_from_the_manifest(bundle: Path) -> None:
    def drop(manifest: Json) -> None:
        manifest["files"] = [f for f in manifest["files"] if "beras" not in f["path"]]

    rewrite(bundle, "manifest.json", drop)
    with pytest.raises(BundleError, match="tidak tercantum"):
        load_bundle(bundle, "development")


def test_rejects_a_listed_file_that_is_absent(bundle: Path) -> None:
    (bundle / "context" / "availability.json").unlink()
    with pytest.raises(BundleError, match="tidak ada"):
        load_bundle(bundle, "development")


def test_rejects_a_path_that_escapes_the_bundle(bundle: Path) -> None:
    def escape(manifest: Json) -> None:
        manifest["files"] = [{"path": "../outside.json", "sha256": "0" * 64, "bytes": 1}]

    rewrite(bundle, "manifest.json", escape)
    with pytest.raises(BundleError, match="skema tidak valid: files"):
        load_bundle(bundle, "development")


def test_rejects_a_folder_renamed_away_from_its_id(bundle: Path) -> None:
    with pytest.raises(BundleError, match="bundle_id"):
        load_bundle(bundle.rename(bundle.with_name("demo__2026-10-25")), "development")


def test_rejects_a_missing_manifest(tmp_path: Path) -> None:
    with pytest.raises(BundleError, match=r"manifest\.json"):
        load_bundle(tmp_path, "development")


def test_rejects_an_origin_after_the_cutoff(bundle: Path) -> None:
    rewrite(
        bundle,
        "forecasts/cabai-merah-keriting.json",
        lambda f: f["run"].update(origin="2026-10-19"),
    )
    with pytest.raises(BundleError, match="origin melewati data_cutoff"):
        load_bundle(bundle, "development")


def test_rejects_a_run_from_another_model(bundle: Path) -> None:
    rewrite(
        bundle,
        "forecasts/bawang-merah.json",
        lambda f: f["run"].update(model_version="arif-net-0.1.0"),
    )
    with pytest.raises(BundleError, match="identitas run"):
        load_bundle(bundle, "development")


def test_rejects_a_price_that_does_not_match_its_change(bundle: Path) -> None:
    def wrong_price(forecast: Json) -> None:
        forecast["points"][0]["predicted_price_idr"] += 1

    rewrite(bundle, "forecasts/cabai-merah-keriting.json", wrong_price)
    with pytest.raises(BundleError, match="rekonstruksi"):
        load_bundle(bundle, "development")


def test_rejects_an_unsupported_horizon(bundle: Path) -> None:
    rewrite(bundle, "manifest.json", lambda m: m.update(horizons=[7]))
    with pytest.raises(BundleError, match="horizon 1 tidak didukung"):
        load_bundle(bundle, "development")


def test_rejects_a_cutoff_after_generation(bundle: Path) -> None:
    rewrite(bundle, "manifest.json", lambda m: m.update(generated_at="2026-10-17T12:00:00+07:00"))
    with pytest.raises(BundleError, match="skema tidak valid"):
        load_bundle(bundle, "development")


def test_reconstruction_rounds_half_up() -> None:
    assert reconstruct_price(52_400, 0.028) == 53_867
    assert reconstruct_price(10, 0.05) == 11
    assert reconstruct_price(13_650, 0.0) == 13_650
