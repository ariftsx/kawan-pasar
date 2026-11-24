"""A finished run as a model candidate for the Core API (Fase 4B task 4).

The registration carries what an admin needs to audit the candidate (4C): the data end, whether
the prospective-test lock was open, the scores per commodity and horizon, and the bundle's own
checksum file hash. Registering never promotes anything.
"""

import hashlib
import json
import urllib.error
import urllib.request
from pathlib import Path
from typing import Any

STEPS_DONE = ("prepare", "collect", "preprocess", "prices", "train", "bundle")


class CandidateError(RuntimeError):
    """The run is not a finished candidate, or the Core API refused it."""


def build_payload(run_dir: Path) -> dict[str, Any]:
    """The Core API's ModelCandidateInput for a finished run (scores keyed by product code)."""
    state = json.loads((run_dir / "run.json").read_text(encoding="utf-8"))
    steps = state.get("steps", {})
    unfinished = [s for s in STEPS_DONE if steps.get(s, {}).get("status") != "ok"]
    if unfinished:
        raise CandidateError(f"run {run_dir.name} is not finished: {', '.join(unfinished)}")
    spec = json.loads((run_dir / "out" / "model" / "arifnet-a0.json").read_text(encoding="utf-8"))
    codes = {str(c["id"]): str(c["code"]) for c in spec["commodities"]}
    validation = spec["validation"]
    bundle = str(state["bundle"])
    sums = run_dir / "out" / "bundles" / bundle / "SHA256SUMS"
    return {
        "runId": str(state["run_id"]),
        "bundleId": bundle,
        "bundleSha256": hashlib.sha256(sums.read_bytes()).hexdigest(),
        "modelVersion": str(spec["model_version"]),
        "dataEnd": str(state["data_end"]),
        "lockOpen": bool(state["lock"]["open"]),
        "commodities": [str(c["code"]) for c in spec["commodities"]],
        "overallRelmae": float(validation["overall"]),
        "scores": {codes[c]: dict(v) for c, v in validation["by_commodity"].items()},
        "window": dict(validation["window"]),
    }


def post_candidate(
    payload: dict[str, Any], api_url: str, token: str, timeout: float = 15.0
) -> tuple[int, bool]:
    """Registers the candidate; returns (id, created). created is False when this exact run and
    bundle was already registered (an Airflow retry). Any other conflict is an error."""
    if not api_url.startswith(("http://", "https://")):
        raise CandidateError("API URL must be http(s)")
    try:
        body = json.dumps(payload, allow_nan=False).encode("utf-8")
    except ValueError:
        raise CandidateError("candidate has non-finite scores (NaN/inf)") from None
    request = urllib.request.Request(  # noqa: S310 - scheme checked above
        f"{api_url.rstrip('/')}/internal/model-candidates",
        data=body,
        headers={"content-type": "application/json", "x-service-token": token},
        method="POST",
    )
    try:
        with urllib.request.urlopen(request, timeout=timeout) as res:  # noqa: S310
            return int(json.loads(res.read())["id"]), res.status == 201
    except urllib.error.HTTPError as e:
        if e.code == 409:
            raise CandidateError(
                "Core API: run id or bundle id already registered with a different bundle (HTTP 409)"
            ) from None
        # The body may echo input: only the status leaves this function.
        raise CandidateError(f"Core API refused the candidate: HTTP {e.code}") from None
