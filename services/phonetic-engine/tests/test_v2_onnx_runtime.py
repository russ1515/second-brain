"""Fake CPU session tests: no ONNX runtime import, weights or real inference."""

import array
import importlib.util
import inspect
import json
import math
from pathlib import Path
from types import SimpleNamespace
import sys
import tempfile
import unittest
from unittest.mock import Mock, patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from v2.onnx_runtime import LocalOnnxInt8Runtime, ONNX_BYTES, ONNX_SHA256, VOCAB_SHA256
from v2.errors import V2EvidenceError


def guard(stage, phase):
    return {"verified": True, "osMemoryLimitEnforced": True, "phase": phase}


class FakeOptions:
    def __init__(self):
        self.entries = {}

    def add_session_config_entry(self, name, value):
        self.entries[name] = value


class FakeSession:
    def __init__(self):
        self.run = Mock(return_value=["synthetic-logits"])
        self.providers = ["CPUExecutionProvider"]
        self.inputs = [SimpleNamespace(name="input_values", type="tensor(float)", shape=[1, "length"]),
                       SimpleNamespace(name="attention_mask", type="tensor(int64)", shape=[1, "length"])]
        self.outputs = [SimpleNamespace(name="logits", type="tensor(float)", shape=[1, "frames", 392])]

    def get_providers(self):
        return self.providers

    def get_inputs(self):
        return self.inputs

    def get_outputs(self):
        return self.outputs


class FakeOrt:
    __version__ = "1.23.2"
    SessionOptions = FakeOptions
    ExecutionMode = SimpleNamespace(ORT_SEQUENTIAL="sequential")
    GraphOptimizationLevel = SimpleNamespace(ORT_DISABLE_ALL="disabled")

    def __init__(self):
        self.session = FakeSession()
        self.InferenceSession = Mock(return_value=self.session)
        self.disable_telemetry_events = Mock()

    def get_available_providers(self):
        # Presence of another installed provider must not enable its use.
        return ["CPUExecutionProvider", "UnrequestedProvider"]


def build_runtime(phase="load", **kwargs):
    options = {"phase": phase, "safety_guard": guard, "provenance_verified": True,
               "metadata_hashes": {"config.json": "a" * 64, "preprocessor_config.json": "b" * 64}}
    options.update(kwargs)
    return LocalOnnxInt8Runtime(str(Path.cwd() / "technical-no-model"), str(Path.cwd() / "technical.dict"), **options)


def fake_artifacts(runtime):
    runtime.model_config = {"conv_stride": [5, 2, 2, 2, 2, 2, 2]}
    runtime.processor_config = {"do_normalize": True, "return_attention_mask": True}
    runtime.mapper = object()
    runtime.scorer = Mock()
    runtime.scorer.score.return_value = {"words": [], "phonemes": [], "confidence": None,
        "calibrationStatus": "UNCALIBRATED", "masteryEligible": False, "timings": {}}
    return {"weightsSha256": ONNX_SHA256, "vocabSha256": VOCAB_SHA256}


class OnnxBoundaryTests(unittest.TestCase):
    def load_fake(self, runtime):
        ort = FakeOrt()
        with patch.object(runtime, "_verify_artifacts", side_effect=lambda: fake_artifacts(runtime)), \
                patch.object(runtime, "_load_dependencies", return_value=(ort, SimpleNamespace(__version__="fake-numpy"))), \
                patch("v2.onnx_runtime.available_memory_bytes", return_value=123), \
                patch("v2.onnx_runtime.memory_observation", return_value={"residentBytes": 5, "peakResidentBytes": 5}):
            metrics = runtime.load()
        return ort, metrics

    def test_provenance_and_confinement_precede_native_import(self):
        for kwargs, code in (({"provenance_verified": False}, "ONNX_MODEL_PROVENANCE_REQUIRED"),
                             ({"safety_guard": None}, "ONNX_OS_MEMORY_CONFINEMENT_REQUIRED"),
                             ({"safety_guard": lambda stage, phase: {"verified": True, "phase": phase}},
                              "ONNX_OS_MEMORY_CONFINEMENT_REQUIRED")):
            runtime = build_runtime(**kwargs)
            with patch.object(runtime, "_load_dependencies") as dependency:
                with self.assertRaisesRegex(V2EvidenceError, code):
                    runtime.load()
                dependency.assert_not_called()

    def test_cpu_options_are_fixed_and_load_performs_no_audio_inference(self):
        runtime = build_runtime()
        ort, metrics = self.load_fake(runtime)
        options = ort.InferenceSession.call_args.kwargs["sess_options"]
        self.assertEqual(ort.InferenceSession.call_args.kwargs["providers"], ["CPUExecutionProvider"])
        self.assertFalse(options.enable_cpu_mem_arena)
        self.assertFalse(options.enable_mem_pattern)
        self.assertFalse(options.enable_profiling)
        self.assertEqual(options.graph_optimization_level, "disabled")
        self.assertEqual(options.execution_mode, "sequential")
        self.assertEqual((options.intra_op_num_threads, options.inter_op_num_threads), (1, 1))
        self.assertEqual(options.entries["session.disable_prepacking"], "1")
        ort.disable_telemetry_events.assert_called_once()
        ort.session.run.assert_not_called()
        self.assertEqual(metrics["audioInferencesDuringLoad"], 0)
        # No replacement fixed-RAM minimum was inferred from a made-up observation.
        self.assertEqual(metrics["availableMemoryBeforeLoadBytes"], 123)

    def test_load_phase_can_never_infer_or_advance_itself(self):
        runtime = build_runtime()
        ort, _ = self.load_fake(runtime)
        with self.assertRaisesRegex(V2EvidenceError, "ONNX_LOAD_PHASE_INFERENCE_FORBIDDEN"):
            runtime.assess(b"technical", "technical")
        with self.assertRaises(AttributeError):
            runtime.phase = "benchmark"
        ort.session.run.assert_not_called()

    def test_load_is_idempotent_but_closed_child_runtime_cannot_reload(self):
        runtime = build_runtime()
        ort, metrics = self.load_fake(runtime)
        self.assertIs(runtime.load(), metrics)
        ort.InferenceSession.assert_called_once()
        runtime.close()
        self.assertIsNone(runtime.session)
        with self.assertRaisesRegex(V2EvidenceError, "ONNX_EXPERIMENT_TERMINATED"):
            runtime.load()

    def test_unapproved_version_provider_and_signature_fail_without_inference(self):
        for alteration, code in (("version", "ONNX_CPU_RUNTIME_NOT_AUDITED"),
                                 ("provider", "ONNX_CPU_PROVIDER_MISMATCH"),
                                 ("signature", "ONNX_MODEL_IO_SIGNATURE_UNSUPPORTED")):
            runtime, ort = build_runtime(), FakeOrt()
            if alteration == "version":
                ort.__version__ = "unapproved"
            elif alteration == "provider":
                ort.session.providers = ["UnrequestedProvider"]
            else:
                ort.session.outputs[0].shape = [1, "frames", 400]
            with patch.object(runtime, "_verify_artifacts", side_effect=lambda: fake_artifacts(runtime)), \
                    patch.object(runtime, "_load_dependencies", return_value=(ort, object())):
                with self.assertRaisesRegex(V2EvidenceError, code):
                    runtime.load()
            ort.session.run.assert_not_called()

    def test_artifact_errors_prevent_dependency_import_and_never_read_fp32_weights(self):
        runtime = build_runtime()
        with patch.object(runtime, "_load_dependencies") as dependency:
            with self.assertRaisesRegex(V2EvidenceError, "LOCAL_MODEL_ARTIFACT_INVALID"):
                runtime.load()
            dependency.assert_not_called()
        self.assertEqual(ONNX_BYTES, 317712780)
        self.assertEqual(ONNX_SHA256, "74174710e34035bbb7f611601d016c32fc575de7a6f53b1078107dc10a84e7ae")

    def test_native_load_error_has_only_safe_code_and_no_retry(self):
        runtime, ort = build_runtime(), FakeOrt()
        ort.InferenceSession.side_effect = RuntimeError("private-path-or-native-detail")
        with patch.object(runtime, "_verify_artifacts", side_effect=lambda: fake_artifacts(runtime)), \
                patch.object(runtime, "_load_dependencies", return_value=(ort, object())):
            with self.assertRaisesRegex(V2EvidenceError, "^ONNX_SESSION_LOAD_FAILED$"):
                runtime.load()
        with self.assertRaisesRegex(V2EvidenceError, "ONNX_EXPERIMENT_TERMINATED"):
            runtime.load()
        ort.InferenceSession.assert_called_once()

    def assess_fake(self, runtime):
        prepared = SimpleNamespace(pcm16=b"00", duration_ms=300)
        with patch("v2.onnx_runtime.AudioPreprocessor") as preprocessor, \
                patch.object(runtime, "expected_sequence", return_value=["expected"]), \
                patch.object(runtime, "_prepare_input", return_value={"input_values": "synthetic-values"}), \
                patch.object(runtime, "_posteriors", return_value=([[0.0]], [1, 1, 392])):
            preprocessor.return_value.prepare.return_value = prepared
            return runtime.assess(b"synthetic-only", "technical")

    def test_tiny_phase_has_one_call_and_benchmark_has_fifteen_no_automatic_retry(self):
        for phase, count in (("tiny", 1), ("benchmark", 15)):
            with self.subTest(phase=phase):
                runtime = build_runtime(phase)
                ort, _ = self.load_fake(runtime)
                for _ in range(count):
                    result = self.assess_fake(runtime)
                    self.assertFalse(result["masteryEligible"])
                    self.assertFalse(result["audioRetained"])
                with self.assertRaisesRegex(V2EvidenceError, "ONNX_PHASE_INFERENCE_LIMIT_REACHED"):
                    self.assess_fake(runtime)
                self.assertEqual(ort.session.run.call_count, count)

    def test_native_inference_failure_consumes_tiny_call_and_cannot_retry(self):
        runtime = build_runtime("tiny")
        ort, _ = self.load_fake(runtime)
        ort.session.run.side_effect = RuntimeError("native-sensitive-message")
        with self.assertRaisesRegex(V2EvidenceError, "^ONNX_INFERENCE_FAILED$"):
            self.assess_fake(runtime)
        with self.assertRaisesRegex(V2EvidenceError, "ONNX_MODEL_NOT_LOADED"):
            self.assess_fake(runtime)
        ort.session.run.assert_called_once()

    def test_lost_confinement_terminates_the_child_runtime_without_a_retry(self):
        runtime = build_runtime("tiny")
        ort, _ = self.load_fake(runtime)
        runtime.safety_guard = lambda stage, phase: {"verified": False}
        with self.assertRaisesRegex(V2EvidenceError, "ONNX_OS_MEMORY_CONFINEMENT_REQUIRED"):
            self.assess_fake(runtime)
        runtime.safety_guard = guard
        with self.assertRaisesRegex(V2EvidenceError, "ONNX_MODEL_NOT_LOADED"):
            self.assess_fake(runtime)
        ort.session.run.assert_not_called()

    def test_concurrency_and_invalid_phase_cannot_expand_execution(self):
        for kwargs in ({"threads": 2}, {"threads": True}, {"phase": "automatic"}):
            with self.assertRaises(V2EvidenceError):
                build_runtime(**kwargs)
        runtime = build_runtime()
        runtime._lock.acquire()
        try:
            with self.assertRaisesRegex(V2EvidenceError, "LOCAL_RESEARCH_CONCURRENCY_LIMIT"):
                runtime.load()
        finally:
            runtime._lock.release()

    def test_no_fp32_native_imports_hub_download_or_fixed_ram_guard(self):
        import v2.onnx_runtime as module
        source = inspect.getsource(module)
        for forbidden in ("import torch", "import transformers", "from transformers", "from_pretrained",
                          "phonemizer", "MIN_AVAILABLE_MEMORY_BYTES", "http://", "https://"):
            self.assertNotIn(forbidden, source)
        import v2.runtime as fp32
        self.assertEqual(fp32.MIN_AVAILABLE_MEMORY_BYTES, 3 * 1024 ** 3)


@unittest.skipUnless(importlib.util.find_spec("numpy"), "Approved NumPy dependency not visible in this test context")
class NumpyPreprocessingTests(unittest.TestCase):
    def test_manual_normalization_matches_independent_scalar_reference_and_mask(self):
        import numpy as np
        runtime = build_runtime("tiny")
        runtime.np = np
        runtime.processor_config = {"do_normalize": True}
        runtime._input_names = frozenset({"input_values", "attention_mask"})
        samples = [-30000, -10000, 0, 10000, 30000]
        binary = array.array("h", samples)
        if sys.byteorder != "little":
            binary.byteswap()
        feed = runtime._prepare_input(binary.tobytes())
        floats = [value / 32768.0 for value in samples]
        mean = sum(floats) / len(floats)
        variance = sum((value - mean) ** 2 for value in floats) / len(floats)
        expected = [(value - mean) / math.sqrt(variance + 1e-7) for value in floats]
        self.assertEqual(feed["input_values"].dtype, np.float32)
        self.assertEqual(feed["input_values"].shape, (1, 5))
        for actual, value in zip(feed["input_values"][0].tolist(), expected):
            self.assertAlmostEqual(actual, value, places=6)
        self.assertEqual(feed["attention_mask"].dtype, np.int64)
        self.assertEqual(feed["attention_mask"].tolist(), [[1] * 5])
        runtime._input_names = frozenset({"input_values"})
        self.assertNotIn("attention_mask", runtime._prepare_input(binary.tobytes()))

    def test_manual_log_softmax_has_392_normalized_output_tokens_and_rejects_nonfinite(self):
        import numpy as np
        runtime = build_runtime("tiny")
        runtime.np = np
        logits = np.zeros((1, 2, 392), dtype=np.float32)
        logits[0, 0, 17] = 2
        log_probabilities, shape = runtime._posteriors(logits)
        self.assertEqual(shape, [1, 2, 392])
        for row in log_probabilities:
            self.assertAlmostEqual(sum(math.exp(value) for value in row), 1.0, places=5)
        logits[0, 0, 17] = float("nan")
        with self.assertRaisesRegex(V2EvidenceError, "ONNX_POSTERIOR_VALUE_INVALID"):
            runtime._posteriors(logits)
        with self.assertRaisesRegex(V2EvidenceError, "ONNX_POSTERIOR_SHAPE_INVALID"):
            runtime._posteriors(np.zeros((1, 1, 391), dtype=np.float32))


if __name__ == "__main__":
    unittest.main()
