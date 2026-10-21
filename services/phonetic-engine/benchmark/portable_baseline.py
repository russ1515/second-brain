"""Frozen fifteen-case PocketSphinx rerun, confined and entirely offline.

The legacy Phase H main regenerates fixtures; it is intentionally NEVER called.
Only its existing --worker protocol is reused, with audioPath + expectedText.
No learner data, new gold, new scoring rules or model downloads are introduced.
"""

from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import queue
import statistics
import subprocess
import sys
import threading
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from v2.onnx_smoke_supervisor import (SafetyStop, WindowsAPI, WindowsJob,
    WindowsMemoryMonitor, check_pressure, digest, discard_stderr,
    experimental_budget, load_controlled_cases, persist, stable_code, stream_reader)

MIN_AVAILABLE_BYTES = 4 * 1024 ** 3
CASE_TIMEOUT_SECONDS = 90


def _worker_environment(deps_dir):
    dependencies = Path(deps_dir).resolve(strict=True)
    if not dependencies.is_dir():
        raise SafetyStop("BASELINE_DEPENDENCIES_DIRECTORY_REQUIRED")
    # Do not inherit arbitrary import paths from the caller. -S disables site;
    # this one explicit isolated directory supplies the pinned baseline wheel.
    environment = dict(os.environ)
    environment.update({"PYTHONPATH": str(dependencies), "PYTHONNOUSERSITE": "1",
        "HF_HUB_OFFLINE": "1", "TRANSFORMERS_OFFLINE": "1", "OMP_NUM_THREADS": "1"})
    return environment


def _run_case(case, deps_dir, monitor, api, budget):
    process = job = None
    assigned = False
    events, stderr_count, samples = queue.Queue(maxsize=8), [0], []
    result_line = None
    report = {"id": case["id"], "fixtureSha256": case["fixtureSha256"],
              "status": "FAIL", "noRetry": True}
    started = time.monotonic()
    try:
        check_pressure(monitor.sample(), budget)
        job = WindowsJob(api, budget["childTotalCommitLimitBytes"])
        runner = Path(__file__).resolve().parents[1] / "tests" / "run_phase_h_acceptance.py"
        process = subprocess.Popen([sys.executable, "-S", "-u", str(runner), "--worker"],
            stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
            env=_worker_environment(deps_dir), creationflags=subprocess.CREATE_NO_WINDOW)
        # The worker imports only stdlib/pure engine code before stdin. Native
        # PocketSphinx is imported inside evaluate(), after this verified attach.
        report["jobProof"] = job.assign(process)
        assigned = True
        sample = monitor.sample(process)
        check_pressure(sample, budget)
        samples.append(sample)
        threading.Thread(target=stream_reader, args=(process.stdout, events, "STDOUT"), daemon=True).start()
        threading.Thread(target=discard_stderr, args=(process.stderr, stderr_count), daemon=True).start()
        payload = {"audioPath": case["audioPath"], "expectedText": case["expectedText"]}
        process.stdin.write(json.dumps(payload).encode("utf-8"))
        process.stdin.close()
        stdout_ended = False
        deadline = time.monotonic() + CASE_TIMEOUT_SECONDS
        while process.poll() is None or not stdout_ended:
            if time.monotonic() > deadline:
                raise SafetyStop("BASELINE_CASE_TIMEOUT")
            if process.poll() is None:
                sample = monitor.sample(process)
                check_pressure(sample, budget)
                job.verify(process)
                samples.append(sample)
            try:
                label, line = events.get(timeout=0.1)
            except queue.Empty:
                continue
            if label == "PROTOCOL_ERROR":
                raise SafetyStop(line)
            if label == "EOF":
                stdout_ended = True
            elif label == "STDOUT":
                if result_line is not None:
                    raise SafetyStop("BASELINE_MULTIPLE_RESULTS")
                result_line = line
        process.wait(timeout=5)
        if process.returncode != 0 or result_line is None:
            raise SafetyStop("BASELINE_WORKER_FAILED")
        measured = json.loads(result_line)
        value = measured.get("result", {})
        if (value.get("masteryEligible") is not False or
                value.get("calibrationStatus") != "UNCALIBRATED"):
            raise SafetyStop("BASELINE_UNCALIBRATED_BOUNDARY_VIOLATED")
        if value.get("status") not in ("EVIDENCE_AVAILABLE", "NOT_EVALUABLE"):
            raise SafetyStop("BASELINE_TECHNICAL_EVALUATION_FAILURE")
        if digest(case["audioPath"]) != case["fixtureSha256"]:
            raise SafetyStop("CONTROLLED_FIXTURE_CHANGED_DURING_BASELINE")
        result_timings = value.get("evidence", {}).get("timings", {})
        report.update({"status": "PASS", "result": value,
            "elapsedMs": measured.get("elapsedMs"),
            "peakMemoryBytes": measured.get("peakMemoryBytes"),
            "peakProcessMemoryBytes": max([measured.get("peakMemoryBytes") or 0] +
                [row.get("child", {}).get("peakWorkingSetBytes", 0) for row in samples]),
            "cpuTimeMs": result_timings.get("cpuTimeMs"),
            "timingsMs": {**result_timings, "harnessElapsedMs": measured.get("elapsedMs")}})
    except Exception as error:
        report["error"] = stable_code(error)
    finally:
        try:
            if process is not None and process.poll() is None:
                if assigned:
                    job.terminate()
                else:
                    process.kill()  # Only this just-created stdlib boot child.
                process.wait(timeout=10)
            if job is not None:
                accounting = job.wait_empty()
                report["release"] = {"activeProcessesAfterExit": accounting["activeProcesses"],
                    "processExited": process is not None and process.returncode is not None,
                    "job": accounting}
                if accounting["activeProcesses"] != 0:
                    report["status"], report["error"] = "FAIL", "BASELINE_CHILD_RELEASE_FAILED"
        except Exception as error:
            report["status"], report["error"] = "FAIL", stable_code(error)
        finally:
            if job is not None:
                job.close()
            if process is not None:
                for stream in (process.stdin, process.stdout, process.stderr):
                    if stream and not stream.closed:
                        stream.close()
    report["resourceSamples"] = samples
    report["stderrBytesDiscardedNotLogged"] = stderr_count[0]
    report["supervisedElapsedMs"] = (time.monotonic() - started) * 1000
    return report


def run_baseline(inventory_path, baseline_path, fixture_root, deps_dir, output_dir):
    """Run exactly fifteen immutable fixtures; failed case stops this run."""
    output = Path(output_dir).resolve()
    output.mkdir(parents=True, exist_ok=False)
    report = {"status": "FAIL", "validation": "FROZEN_SYNTHETIC_NOT_HUMAN_CALIBRATION",
        "measurementSource": "CURRENT_HOST_POCKETSPHINX_RERUN",
        "historicalBaseline": {"path": str(Path(baseline_path).resolve()),
            "measurementSource": "SAVED_PHASE_H"},
        "cases": [], "paidCalls": 0, "costUsd": 0, "masteryEligible": False,
        "calibrationStatus": "UNCALIBRATED", "noRetry": True}
    monitor = None
    try:
        report["historicalBaseline"]["sha256"] = digest(baseline_path)
        inventory, _, cases = load_controlled_cases(inventory_path, baseline_path, "benchmark", fixture_root)
        report["inventorySha256"] = digest(inventory_path)
        report["expectedCaseCount"] = inventory["caseCount"]
        _worker_environment(deps_dir)
        api = WindowsAPI()
        monitor = WindowsMemoryMonitor(api)
        samples = []
        for _ in range(3):
            time.sleep(1)
            samples.append(monitor.sample())
        report["baselineMemorySamples"] = samples
        if min(sample["availablePhysicalBytes"] for sample in samples) < MIN_AVAILABLE_BYTES:
            raise SafetyStop("PORTABLE_BENCHMARK_REQUIRES_4_GIB_AVAILABLE")
        budget = experimental_budget(samples)
        report["budget"] = budget
        originals = {case["id"]: case for case in inventory["cases"]}
        for case in cases:
            measured = _run_case(case, deps_dir, monitor, api, budget)
            original = originals[case["id"]]
            measured.update({"expectedText": original["expectedText"], "category": original["category"],
                "syntheticText": original["syntheticText"],
                "expectedManipulatedRegion": original["intendedManipulation"]})
            persist(output / ("case-" + case["id"] + ".json"), measured)
            report["cases"].append(measured)
            if measured["status"] != "PASS":
                raise SafetyStop(measured.get("error", "BASELINE_CASE_FAILED"))
        report["status"] = "PASS"
    except Exception as error:
        report["error"] = stable_code(error)
    finally:
        if monitor is not None:
            try:
                report["systemAfterExit"] = monitor.sample()
            except Exception as error:
                report["status"], report["error"] = "FAIL", stable_code(error)
            monitor.close()
        report["measurementsCompleted"] = len(report["cases"])
        successful = [row for row in report["cases"] if row.get("status") == "PASS"]
        report["timingsMs"] = {}
        for metric in ("preprocessingElapsedMs", "completenessElapsedMs", "alignmentElapsedMs",
                "totalElapsedMs", "cpuTimeMs", "harnessElapsedMs"):
            values = [row["timingsMs"][metric] for row in successful
                if isinstance(row.get("timingsMs", {}).get(metric), (int, float))]
            report["timingsMs"][metric] = {"sampleCount": len(values), "min": min(values),
                "medianObserved": statistics.median(values), "max": max(values)} if values else None
        peaks = [row["peakProcessMemoryBytes"] for row in successful
            if isinstance(row.get("peakProcessMemoryBytes"), int)]
        report["peakProcessMemoryBytes"] = max(peaks) if peaks else None
        report["p95"] = "NOT_REPRESENTATIVE"
        persist(output / "result.json", report)
    return report


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("inventory", "baseline", "fixture-root", "deps-dir", "output-dir"):
        parser.add_argument("--" + name, required=True)
    args = parser.parse_args()
    report = run_baseline(args.inventory, args.baseline, args.fixture_root, args.deps_dir, args.output_dir)
    print(json.dumps({"status": report["status"], "measurementsCompleted": report["measurementsCompleted"],
        "error": report.get("error"), "paidCalls": 0}))
    return 0 if report["status"] == "PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
