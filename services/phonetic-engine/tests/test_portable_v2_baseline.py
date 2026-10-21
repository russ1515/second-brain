"""Portable path/baseline orchestration tests. No native or acoustic runtime."""

import copy
import hashlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from benchmark import portable_baseline as runner
from v2 import onnx_smoke_supervisor as supervisor


class PortableFrozenFixtures(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory()
        self.root = Path(self.temporary.name)
        self.fixtures = self.root / "fixtures"
        self.fixtures.mkdir()
        self.baseline = self.root / "baseline.json"
        self.inventory = self.root / "inventory.json"
        self.original = {"caseCount": 15, "cases": []}
        old = {"cases": []}
        for index in range(15):
            case_id = "fixture-" + str(index)
            content = ("frozen-" + case_id).encode()
            (self.fixtures / (case_id + ".wav")).write_bytes(content)
            sha = hashlib.sha256(content).hexdigest()
            self.original["cases"].append({"id": case_id, "fixtureSha256": sha,
                "audioPath": "C:\\old\\fixtures\\" + case_id + ".wav",
                "expectedText": "Expected " + str(index), "category": "REFERENCE",
                "syntheticText": "Frozen synthetic text", "intendedManipulation": {},
                "goldRegions": [], "audio": {"durationMs": 2000}})
            old["cases"].append({"id": case_id, "fixtureSha256": sha,
                "expectedText": "Expected " + str(index), "result": {}})
        self.baseline.write_text(json.dumps(old), encoding="utf-8")
        self.original["baselineSha256"] = supervisor.digest(self.baseline)
        self.inventory.write_text(json.dumps(self.original), encoding="utf-8")
        self.sha = supervisor.digest(self.inventory)
        self.hash_patch = patch.object(supervisor, "FROZEN_INVENTORY_SHA", self.sha)
        self.hash_patch.start()

    def tearDown(self):
        self.hash_patch.stop()
        self.temporary.cleanup()

    def test_rebase_changes_only_child_execution_path(self):
        before = self.inventory.read_bytes()
        inventory, _, payload = supervisor.load_controlled_cases(
            self.inventory, self.baseline, "benchmark", self.fixtures)
        self.assertEqual(inventory, self.original)
        self.assertEqual(self.inventory.read_bytes(), before)
        self.assertEqual(len(payload), 15)
        for index, case in enumerate(payload):
            self.assertEqual(Path(case["audioPath"]).parent, self.fixtures)
            self.assertEqual(case["expectedText"], "Expected " + str(index))
            self.assertNotIn("goldRegions", case)
            self.assertNotIn("syntheticText", case)
            self.assertEqual(set(case), {"id", "audioPath", "fixtureSha256", "expectedText",
                "baselineCompleteness", "baselineFluency"})

    def test_tiny_remains_original_first_case(self):
        _, _, payload = supervisor.load_controlled_cases(self.inventory, self.baseline, "tiny", self.fixtures)
        self.assertEqual([case["id"] for case in payload], ["fixture-0"])

    def test_hash_change_not_accepted_after_relocation(self):
        (self.fixtures / "fixture-5.wav").write_bytes(b"modified")
        with self.assertRaisesRegex(supervisor.SafetyStop, "CONTROLLED_FIXTURE_HASH_MISMATCH"):
            supervisor.load_controlled_cases(self.inventory, self.baseline, "benchmark", self.fixtures)

    def test_inventory_mutation_not_accepted(self):
        self.inventory.write_text("{}", encoding="utf-8")
        with self.assertRaisesRegex(supervisor.SafetyStop, "CONTROLLED_INVENTORY_HASH_MISMATCH"):
            supervisor.load_controlled_cases(self.inventory, self.baseline, "benchmark", self.fixtures)

    def test_default_absolute_paths_not_silently_replaced(self):
        with self.assertRaises(supervisor.SafetyStop):
            supervisor.load_controlled_cases(self.inventory, self.baseline, "benchmark")

    def test_frozen_legacy_baseline_does_not_get_rewritten(self):
        before = self.baseline.read_bytes()
        supervisor.load_controlled_cases(self.inventory, self.baseline, "benchmark", self.fixtures)
        self.assertEqual(self.baseline.read_bytes(), before)

    def test_baseline_dispatch_exact_fifteen_fake_workers(self):
        output = self.root / "run"
        calls = []

        def fake_case(case, *unused):
            calls.append(copy.deepcopy(case))
            return {"id": case["id"], "status": "PASS", "fixtureSha256": case["fixtureSha256"],
                "result": {"masteryEligible": False, "calibrationStatus": "UNCALIBRATED"}}

        with patch.object(runner, "WindowsAPI", return_value=object()), \
                patch.object(runner, "WindowsMemoryMonitor", return_value=FakeMonitor()), \
                patch.object(runner.time, "sleep"), patch.object(runner, "_run_case", side_effect=fake_case):
            result = runner.run_baseline(self.inventory, self.baseline, self.fixtures, self.root, output)
        self.assertEqual(result["status"], "PASS")
        self.assertEqual(len(calls), 15)
        self.assertEqual([case["expectedText"] for case in calls], ["Expected " + str(i) for i in range(15)])
        self.assertEqual(result["measurementSource"], "CURRENT_HOST_POCKETSPHINX_RERUN")
        self.assertEqual(result["historicalBaseline"]["measurementSource"], "SAVED_PHASE_H")
        self.assertEqual(json.loads((output / "result.json").read_text())["measurementsCompleted"], 15)

    def test_baseline_failure_stops_without_retry(self):
        output = self.root / "failed-run"
        with patch.object(runner, "WindowsAPI", return_value=object()), \
                patch.object(runner, "WindowsMemoryMonitor", return_value=FakeMonitor()), \
                patch.object(runner.time, "sleep"), \
                patch.object(runner, "_run_case", return_value={"status": "FAIL", "error": "BASELINE_WORKER_FAILED"}) as worker:
            result = runner.run_baseline(self.inventory, self.baseline, self.fixtures, self.root, output)
        self.assertEqual(result["status"], "FAIL")
        self.assertEqual(result["error"], "BASELINE_WORKER_FAILED")
        self.assertEqual(worker.call_count, 1)
        self.assertTrue((output / "result.json").exists())

    def test_ram_preflight_never_launches_worker(self):
        output = self.root / "low-memory"
        with patch.object(runner, "WindowsAPI", return_value=object()), \
                patch.object(runner, "WindowsMemoryMonitor", return_value=FakeMonitor(1024)), \
                patch.object(runner.time, "sleep"), patch.object(runner, "_run_case") as worker:
            result = runner.run_baseline(self.inventory, self.baseline, self.fixtures, self.root, output)
        self.assertEqual(result["error"], "PORTABLE_BENCHMARK_REQUIRES_4_GIB_AVAILABLE")
        worker.assert_not_called()

    def test_existing_output_is_never_overwritten(self):
        output = self.root / "existing"
        output.mkdir()
        with self.assertRaises(FileExistsError):
            runner.run_baseline(self.inventory, self.baseline, self.fixtures, self.root, output)

    def test_isolated_dependency_path_replaces_inherited_pythonpath(self):
        with patch.dict(runner.os.environ, {"PYTHONPATH": "untrusted-old-path"}):
            environment = runner._worker_environment(self.root)
        self.assertEqual(environment["PYTHONPATH"], str(self.root))
        self.assertEqual(environment["PYTHONNOUSERSITE"], "1")

    def test_single_worker_is_assigned_before_payload_and_model_import_permission(self):
        audio = self.fixtures / "fixture-0.wav"
        value = {"status": "EVIDENCE_AVAILABLE", "masteryEligible": False,
            "calibrationStatus": "UNCALIBRATED", "evidence": {"timings": {"cpuTimeMs": 2}}}
        process = FakeProcess({"result": value, "elapsedMs": 5, "peakMemoryBytes": 90})
        job = FakeJob(process)
        case = {"id": "fixture-0", "fixtureSha256": supervisor.digest(audio),
            "audioPath": str(audio), "expectedText": "Expected 0"}
        budget = supervisor.experimental_budget([FakeMonitor().sample()] * 3)
        with patch.object(runner.subprocess, "Popen", return_value=process) as popen, \
                patch.object(runner, "WindowsJob", return_value=job):
            result = runner._run_case(case, self.root, FakeMonitor(), object(), budget)
        self.assertEqual(result["status"], "PASS")
        self.assertTrue(job.assigned_before_payload)
        self.assertEqual(set(json.loads(process.stdin.payload)), {"audioPath", "expectedText"})
        self.assertIn("--worker", popen.call_args.args[0])
        self.assertIn("-S", popen.call_args.args[0])
        self.assertNotIn("--fixtures", popen.call_args.args[0])
        self.assertEqual(result["release"]["activeProcessesAfterExit"], 0)


class FakeInput:
    def __init__(self, process):
        self.process, self.payload, self.closed = process, b"", False

    def write(self, value):
        if not self.process.assigned:
            raise AssertionError("Payload sent before Job assignment")
        self.payload += value

    def close(self):
        self.closed = True
        self.process.returncode = 0


class FakeProcess:
    def __init__(self, output):
        self.returncode, self.assigned = None, False
        self.stdin = FakeInput(self)
        self.stdout = io.BytesIO(json.dumps(output).encode() + b"\n")
        self.stderr = io.BytesIO()

    def poll(self):
        return self.returncode

    def wait(self, timeout):
        return self.returncode


class FakeJob:
    def __init__(self, process):
        self.process = process
        self.assigned_before_payload = False

    def assign(self, process):
        self.assigned_before_payload = not process.stdin.payload
        process.assigned = True
        return {"membershipVerified": True}

    def verify(self, process):
        return {"membershipVerified": True}

    def wait_empty(self):
        return {"activeProcesses": 0}

    def close(self):
        pass


class FakeMonitor:
    def __init__(self, available=8 * 1024 ** 3):
        self.available = available

    def sample(self, process=None):
        return {"availablePhysicalBytes": self.available, "commitHeadroomBytes": 8 * 1024 ** 3,
            "lowMemory": False, "pagesOutputPerSecond": 0}

    def close(self):
        pass


if __name__ == "__main__":
    unittest.main()
