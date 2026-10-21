"""Stdlib-only boot child. No runtime/native import before parent Job handshake."""

from __future__ import annotations

import hashlib
import json
import os
from pathlib import Path
import re
import sys
import time


MAX_LINE = 2 * 1024 * 1024


def emit(value):
    text = json.dumps(value, ensure_ascii=False, allow_nan=False)
    if len(text.encode("utf-8")) > MAX_LINE:
        raise RuntimeError("CHILD_RESULT_TOO_LARGE")
    sys.stdout.write(text + "\n")
    sys.stdout.flush()


def receive():
    text = sys.stdin.readline(MAX_LINE + 1)
    if not text or len(text) > MAX_LINE:
        raise RuntimeError("CHILD_PERMISSION_CHANNEL_CLOSED")
    value = json.loads(text)
    if not isinstance(value, dict):
        raise RuntimeError("CHILD_PERMISSION_INVALID")
    return value


def error_code(error):
    code = getattr(error, "code", str(error))
    return code if isinstance(code, str) and re.fullmatch(r"[A-Z][A-Z0-9_]{0,95}", code) else "ONNX_CHILD_FAILURE"


def run():
    # No dependency path, ORT, NumPy, model or repo engine import exists here.
    sys.stdin.reconfigure(encoding="utf-8")
    sys.stdout.reconfigure(encoding="utf-8")
    emit({"type": "BOOT_READY", "stdlibOnly": True, "nativeImported": False})
    settings = receive()
    if settings.get("command") != "START" or settings.get("phase") not in ("load", "tiny", "benchmark"):
        raise RuntimeError("CHILD_START_NOT_AUTHORIZED")
    phase = settings["phase"]
    from onnx_smoke_supervisor import verify_own_job
    verify_own_job(settings["jobName"], settings["memoryLimitBytes"], phase)
    sequence = 0

    def guard(stage, requested_phase):
        nonlocal sequence
        if requested_phase != phase:
            raise RuntimeError("CHILD_PHASE_IMMUTABLE")
        sequence += 1
        emit({"type": "GUARD_REQUEST", "sequence": sequence, "stage": stage, "phase": phase})
        permission = receive()
        if permission != {"command": "AUTHORIZE", "sequence": sequence, "phase": phase}:
            raise RuntimeError("CHILD_STAGE_NOT_AUTHORIZED")
        return verify_own_job(settings["jobName"], settings["memoryLimitBytes"], phase)

    guard("before_runtime_import", phase)
    sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
    sys.path.insert(0, settings["depsDir"])
    from v2.onnx_runtime import LocalOnnxInt8Runtime
    runtime = LocalOnnxInt8Runtime(settings["modelDir"], settings["dictionary"], phase=phase,
        threads=1, safety_guard=guard, provenance_verified=settings.get("provenanceVerified") is True,
        metadata_hashes=settings["metadataHashes"])
    assessments = 0
    try:
        load_metrics = runtime.load()
        emit({"type": "MODEL_LOADED", "metrics": load_metrics})
        cases = settings.get("cases", [])
        expected_count = {"load": 0, "tiny": 1, "benchmark": 15}[phase]
        if not isinstance(cases, list) or len(cases) != expected_count:
            raise RuntimeError("CHILD_CASE_LIMIT_INVALID")
        for case in cases:
            # No category, altered-region labels or synthesized-spoken answer is
            # accepted; only expected text + same-hash legacy observations.
            if set(case) != {"id", "audioPath", "fixtureSha256", "expectedText", "baselineCompleteness", "baselineFluency"}:
                raise RuntimeError("CHILD_CASE_PAYLOAD_INVALID")
            audio = Path(case["audioPath"])
            if not audio.is_file() or audio.is_symlink() or not 44 <= audio.stat().st_size <= 1024 * 1024:
                raise RuntimeError("CHILD_CONTROLLED_AUDIO_INVALID")
            data = audio.read_bytes()
            if hashlib.sha256(data).hexdigest() != case["fixtureSha256"]:
                raise RuntimeError("CONTROLLED_FIXTURE_HASH_MISMATCH")
            started, cpu = time.perf_counter(), time.process_time()
            assessments += 1
            result = runtime.assess(data, case["expectedText"], locale="en-US",
                baseline_completeness=case["baselineCompleteness"], baseline_fluency=case["baselineFluency"])
            elapsed, cpu_elapsed = (time.perf_counter() - started) * 1000, (time.process_time() - cpu) * 1000
            del data
            emit({"type": "CASE_RESULT", "measurement": {"id": case["id"],
                "fixtureSha256": case["fixtureSha256"], "result": result,
                "timingsMs": {**result.get("timings", {}), "harnessElapsedMs": elapsed,
                              "harnessCpuTimeMs": cpu_elapsed},
                "preservedObservations": {"completeness": "CARRIED_FORWARD_SAME_AUDIO_SHA" if
                    case["baselineCompleteness"] is not None else "NOT_AVAILABLE",
                    "fluency": "EXISTING_TIMING_ANALYZER_ON_V2_ALIGNMENT",
                    "legacyFluencyBaseline": "CARRIED_FORWARD_SAME_AUDIO_SHA" if
                    case["baselineFluency"] is not None else "NOT_AVAILABLE", "notNewScorerProof": True}}})
    finally:
        runtime.close()
    emit({"type": "COMPLETE", "phase": phase, "assessmentCalls": assessments,
          "paidCalls": 0, "costUsd": 0, "noRetry": True})


if __name__ == "__main__":
    try:
        run()
    except BaseException as failure:
        try:
            emit({"type": "ERROR", "code": error_code(failure), "noRetry": True})
        finally:
            raise SystemExit(1)
