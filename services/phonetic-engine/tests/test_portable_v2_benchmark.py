"""Portable preparation tests: stdlib/fake inputs only, no model or host probe."""

import hashlib
import importlib.util
import io
import json
from pathlib import Path
from types import SimpleNamespace
import sys
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).resolve().parents[1] / "benchmark" / "run_benchmark.py"
spec = importlib.util.spec_from_file_location("portable_benchmark_test", SCRIPT)
b = importlib.util.module_from_spec(spec)
spec.loader.exec_module(b)


def lock():
    return {"python": {"version": "3.12.14"}, "benchmarkHostGuard": {
        "minAvailablePhysicalBytes": 4 * 1024**3, "prohibitedNodeSha256": "old-host"}}


def hardware(**overrides):
    return {"availablePhysicalBytes": 5 * 1024**3, "commitHeadroomBytes": 6 * 1024**3,
            "lowMemory": False, "pagesOutputPerSecond": 0, **overrides}


def validate(value=None, **overrides):
    options = {"node_hash": "new-host", "python_version": "3.12.14", "system": "Windows", "architecture": "AMD64"}
    options.update(overrides)
    return b.validate_host(lock(), value or hardware(), **options)


class HostTests(unittest.TestCase):
    def test_adequate_other_host_passes_preflight(self):
        validate()

    def test_current_pc_is_banned_even_with_large_ram(self):
        with self.assertRaisesRegex(b.BenchmarkStop, "CURRENT_PC_BENCHMARK_PROHIBITED"):
            validate(hardware(availablePhysicalBytes=64 * 1024**3), node_hash="old-host")

    def test_four_gib_available_is_exact_benchmark_only_boundary(self):
        validate(hardware(availablePhysicalBytes=4 * 1024**3))
        with self.assertRaisesRegex(b.BenchmarkStop, "MEMORY_INSUFFICIENT"):
            validate(hardware(availablePhysicalBytes=4 * 1024**3 - 1))

    def test_commit_low_memory_and_paging_fail_closed(self):
        for values in ({"commitHeadroomBytes": 4 * 1024**3 - 1}, {"lowMemory": True}, {"pagesOutputPerSecond": 0.1}):
            with self.subTest(values=values), self.assertRaises(b.BenchmarkStop):
                validate(hardware(**values))

    def test_unsupported_os_and_python_are_not_unprotected_fallbacks(self):
        for options in ({"system": "Linux"}, {"architecture": "ARM64"}, {"python_version": "3.12.1"}):
            with self.subTest(options=options), self.assertRaises(b.BenchmarkStop):
                validate(**options)


class PackageTests(unittest.TestCase):
    def test_source_whitelist_excludes_app_private_state_and_weights(self):
        files = b.source_files()
        self.assertIn("tests/run_local_acceptance.py", files)
        self.assertIn("v2/onnx_runtime.py", files)
        self.assertTrue(all(not name.startswith(("apps/", "data/")) for name in files))
        self.assertFalse(any(name.endswith((".onnx", ".bin", ".env", ".pyd")) for name in files))

    def test_original_inventory_and_gold_bytes_are_never_rewritten(self):
        with tempfile.TemporaryDirectory() as temporary:
            root = Path(temporary)
            cases, baseline = [], []
            for index in range(15):
                path = root / ("fixture-" + str(index) + ".wav")
                path.write_bytes(b"technical-fixture-" + str(index).encode())
                row = {"id": path.stem, "fixtureSha256": b.sha(path), "expectedText": "expected",
                       "audioPath": "C:/original/host/" + path.name}
                cases.append(row)
                baseline.append(row)
            baseline_path, inventory_path, dictionary = root / "baseline.json", root / "inventory.json", root / "cmu.dict"
            baseline_path.write_text(json.dumps({"cases": baseline}), encoding="utf-8")
            inventory_path.write_text(json.dumps({"cases": cases, "caseCount": 15,
                "controlledAlterationCount": 5, "baselineSha256": b.sha(baseline_path)}), encoding="utf-8")
            dictionary.write_bytes(b"synthetic-unit-test-only")
            original = inventory_path.read_bytes()
            with patch.object(b, "FROZEN_INVENTORY_SHA", b.sha(inventory_path)), \
                 patch.object(b, "FROZEN_BASELINE_SHA", b.sha(baseline_path)), \
                 patch.object(b, "DICTIONARY_SHA", b.sha(dictionary)):
                _, _, resolved = b.frozen_data(inventory_path, baseline_path, root, dictionary)
                self.assertEqual(len(resolved), 15)
                self.assertEqual(inventory_path.read_bytes(), original)
                (root / "fixture-0.wav").write_bytes(b"changed")
                with self.assertRaisesRegex(b.BenchmarkStop, "FIXTURE_HASH_MISMATCH"):
                    b.frozen_data(inventory_path, baseline_path, root, dictionary)

    def test_final_evidence_is_exclusive(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary) / "result.json"
            b.save(path, {"status": "NOT_RUN"})
            with self.assertRaises(FileExistsError):
                b.save(path, {"status": "PASS"})


class FetchTests(unittest.TestCase):
    def manifest(self, payload):
        return {"artifacts": [{"path": "model_int8.onnx", "bytes": len(payload),
            "sha256": hashlib.sha256(payload).hexdigest(),
            "url": "https://huggingface.co/onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX/resolve/"
                   "c69750f5043e5e1f8a71ab95dd3b98338c280c92/onnx/model_int8.onnx"}]}

    @staticmethod
    def response(payload):
        result = io.BytesIO(payload)
        result.geturl = lambda: "https://public-cdn.example/artifact"
        return result

    def test_pinned_fetch_and_verified_cache_without_retry(self):
        payload, calls = b"small-fake-test-only", []
        def opener(*args, **kwargs):
            calls.append(1)
            return self.response(payload)
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            self.assertTrue(b.fetch_verified_model(directory, self.manifest(payload), opener)[0]["downloaded"])
            self.assertFalse(b.fetch_verified_model(directory, self.manifest(payload), opener)[0]["downloaded"])
            self.assertEqual(len(calls), 1)
            (directory / "model_int8.onnx").write_bytes(b"tampered")
            with self.assertRaisesRegex(b.BenchmarkStop, "CACHE_HASH_MISMATCH"):
                b.fetch_verified_model(directory, self.manifest(payload), opener)
            self.assertEqual(len(calls), 1)

    def test_oversize_download_aborts_without_publishing_cache(self):
        with tempfile.TemporaryDirectory() as temporary:
            directory = Path(temporary)
            with self.assertRaisesRegex(b.BenchmarkStop, "EXCEEDS_PINNED_SIZE"):
                b.fetch_verified_model(directory, self.manifest(b"abc"), lambda *a, **k: self.response(b"abcd"))
            self.assertFalse((directory / "model_int8.onnx").exists())
            self.assertTrue((directory / "model_int8.onnx.part").exists())

    def test_no_alternate_model_or_http_source(self):
        manifest = self.manifest(b"abc")
        manifest["artifacts"][0]["url"] = "http://not-authorized.example/weights"
        with tempfile.TemporaryDirectory() as temporary, self.assertRaisesRegex(b.BenchmarkStop, "SOURCE_NOT_PINNED"):
            b.fetch_verified_model(Path(temporary), manifest, lambda *a, **k: self.fail("network forbidden"))


class DependencyAndSmokeTests(unittest.TestCase):
    def test_dependency_metadata_validation_imports_no_native_package(self):
        expected = {"distributions": [{"name": "onnxruntime", "version": "1.23.2"}]}
        fake = SimpleNamespace(metadata={"Name": "onnxruntime"}, version="1.23.2")
        with patch.object(b.importlib.metadata, "distributions", return_value=[fake]):
            self.assertTrue(b.dependencies_match(Path("unused"), expected))
        self.assertNotIn("onnxruntime", sys.modules)
        self.assertNotIn("torch", sys.modules)

    def test_smoke_requires_real_posterior_alignment_and_phonemes(self):
        with tempfile.TemporaryDirectory() as temporary:
            path = Path(temporary)
            b.save(path / "case-1.json", {"result": {"status": "NOT_EVALUABLE", "masteryEligible": False}})
            with self.assertRaisesRegex(b.BenchmarkStop, "SMOKE_ACOUSTIC_OUTPUT_INVALID"):
                b.validate_smoke_result(path)

    def test_phase_failure_keeps_original_proof(self):
        proof = {"phase": "load", "status": "FAIL", "error": "PHYSICAL_RESERVE_REACHED"}
        failure = b.PhaseFailure("load", proof)
        self.assertIs(failure.proof, proof)
        self.assertEqual(str(failure), "BENCHMARK_PHASE_LOAD_FAILED")


class OrchestrationTests(unittest.TestCase):
    def options(self, root):
        return SimpleNamespace(verify_only=False, output_dir=str(root / "new-output"),
            cache_dir=str(root / "cache"), repetitions=3)

    def test_current_host_stop_happens_before_any_hardware_or_model_probe(self):
        with tempfile.TemporaryDirectory() as temporary, \
             patch.object(b, "verify_package", return_value={"sourceSha": "a" * 40}), \
             patch.object(b.platform, "node", return_value="prohibited-test-host"), \
             patch.object(b, "hardware_snapshot") as probe:
            original_read = b.read
            def read(path):
                if Path(path).name == "environment.lock.json":
                    value = lock()
                    value["benchmarkHostGuard"]["prohibitedNodeSha256"] = hashlib.sha256(b"prohibited-test-host").hexdigest()
                    return value
                return original_read(path)
            with patch.object(b, "read", side_effect=read):
                result = b.execute(self.options(Path(temporary)))
            self.assertEqual(result["error"], "CURRENT_PC_BENCHMARK_PROHIBITED")
            probe.assert_not_called()
            proof = original_read(result["report"])
            self.assertEqual(proof["phases"], [])
            self.assertIsNone(proof["timingsMs"]["totalElapsedMs"]["min"])

    def test_failed_load_is_preserved_and_never_followed_by_smoke_or_retry(self):
        failed = {"phase": "load", "status": "FAIL", "modelLoad": "NOT_RUN",
            "paidCalls": 0, "error": "MEMORY_RESERVE_REACHED",
            "resourceSamples": [{"child": {"peakWorkingSetBytes": 12345}}],
            "release": {"processMemoryReleased": True}}
        with tempfile.TemporaryDirectory() as temporary, \
             patch.object(b, "verify_package", return_value={"sourceSha": "a" * 40}), \
             patch.object(b.platform, "node", return_value="other-technical-host"), \
             patch.object(b.platform, "python_version", return_value="3.12.14"), \
             patch.object(b.platform, "system", return_value="Windows"), \
             patch.object(b.platform, "machine", return_value="AMD64"), \
             patch.object(b, "hardware_snapshot", return_value=hardware()), \
             patch.object(b, "prepare_dependencies", return_value="FAKE_UNIT_TEST_ONLY"), \
             patch.object(b, "fetch_verified_model", return_value=[]), \
             patch.object(b, "run_phase", side_effect=b.PhaseFailure("load", failed)) as phases:
            result = b.execute(self.options(Path(temporary)))
            phases.assert_called_once()
            self.assertEqual(phases.call_args.args[0], "load")
            proof = b.read(result["report"])
            self.assertEqual(result["status"], "FAIL")
            self.assertEqual(proof["phases"][0]["error"], "MEMORY_RESERVE_REACHED")
            self.assertTrue(proof["phases"][0]["memoryPeakMayBeTruncated"])
            self.assertEqual(proof["phases"][0]["memory"]["peakWorkingSetBytes"]["max"], 12345)
            self.assertEqual(proof["repetitions"]["observed"], 0)

    def test_fresh_comparison_failure_still_writes_final_report_without_more_work(self):
        from test_portable_v2_report import comparison
        fake_baseline = SimpleNamespace(run_baseline=lambda *a: {"status": "PASS", "cases": []})
        def fake_phase(phase, destination, *a, **k):
            destination.mkdir()
            if phase == "benchmark":
                b.save(destination / "comparison.json", comparison())
            return {"phase": phase, "status": "PASS", "modelLoad": "PASS", "measurementsCompleted": 1,
                    "paidCalls": 0, "release": {"processMemoryReleased": True}}
        with tempfile.TemporaryDirectory() as temporary, \
             patch.object(b, "verify_package", return_value={"sourceSha": "a" * 40}), \
             patch.object(b.platform, "node", return_value="other-technical-host"), \
             patch.object(b.platform, "python_version", return_value="3.12.14"), \
             patch.object(b.platform, "system", return_value="Windows"), \
             patch.object(b.platform, "machine", return_value="AMD64"), \
             patch.object(b, "hardware_snapshot", return_value=hardware()), \
             patch.object(b, "prepare_dependencies", return_value="FAKE_UNIT_TEST_ONLY"), \
             patch.object(b, "fetch_verified_model", return_value=[]), \
             patch.object(b, "run_phase", side_effect=fake_phase) as phases, \
             patch.object(b, "assert_smoke"), patch.object(b, "validate_smoke_result"), \
             patch.object(b, "measured_comparison", side_effect=ValueError("fake aggregation failure")), \
             patch.dict(sys.modules, {"portable_baseline": fake_baseline}):
            result = b.execute(self.options(Path(temporary)))
            self.assertEqual(phases.call_count, 5)
            self.assertEqual([row.args[0] for row in phases.call_args_list], ["load", "tiny", "benchmark", "benchmark", "benchmark"])
            proof = b.read(result["report"])
            self.assertEqual(proof["status"], "FAIL")
            self.assertEqual(proof["error"], "CURRENT_HOST_COMPARISON_FAILED")
            self.assertEqual(proof["repetitions"]["observed"], 3)
            self.assertEqual(proof["currentHostSideBySideStatus"], "FAILED_EVIDENCE_PRESERVED")


if __name__ == "__main__":
    unittest.main()
