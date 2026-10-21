"""Separate local CPU ONNX INT8 experiment; no FP32 guard or product changes.

Loading is explicit and requires a parent's independently enforced OS memory
confinement attestation. No arbitrary new available-RAM threshold is substituted
for the unchanged FP32 3 GiB guard. This module imports no native model runtime
on import, downloads nothing, writes no audio, and never advances its own phase.
"""

from __future__ import annotations

import gc
import json
import math
from pathlib import Path
import re
import threading
import time

from phonetic_engine import AudioPreprocessor, EvidenceError, FluencyAnalyzer, G2PAdapter
from .errors import V2EvidenceError
from .mapper import CanonicalPhonemeMapper, expected_words_with_stress
from .runtime import available_memory_bytes, file_hash, memory_observation
from .scorer import Wav2Vec2PhonemeScorer

ONNX_BYTES = 317_712_780
ONNX_SHA256 = "74174710e34035bbb7f611601d016c32fc575de7a6f53b1078107dc10a84e7ae"
VOCAB_SHA256 = "d732ab2456c0c017930001dc9af0b41b3b93d25b2eb9740bf9d925508d7d87d0"
ORT_VERSION = "1.23.2"
PHASE_INFERENCE_LIMITS = {"load": 0, "tiny": 1, "benchmark": 15}


class LocalOnnxInt8Runtime:
    def __init__(self, model_dir, dictionary_path, *, phase="load", threads=1,
                 safety_guard=None, provenance_verified=False, metadata_hashes=None):
        if isinstance(threads, bool) or threads != 1:
            raise V2EvidenceError("LOCAL_RESEARCH_CONCURRENCY_LIMIT")
        if not isinstance(phase, str) or phase not in PHASE_INFERENCE_LIMITS:
            raise V2EvidenceError("ONNX_EXPERIMENTAL_PHASE_INVALID")
        if metadata_hashes is not None and not isinstance(metadata_hashes, dict):
            raise V2EvidenceError("ONNX_AUDITED_METADATA_REQUIRED")
        self.model_dir = Path(model_dir)
        self.dictionary_path = Path(dictionary_path)
        self._phase = phase
        self.threads = threads
        self.safety_guard = safety_guard
        self.provenance_verified = provenance_verified
        self.metadata_hashes = dict(metadata_hashes or {})
        self.session = None
        self.np = None
        self.ort = None
        self.mapper = None
        self.scorer = None
        self.processor_config = None
        self.model_config = None
        self.load_metrics = None
        self._input_names = None
        self._lock = threading.Lock()
        self._inference_count = 0
        self._closed = False
        self._failed = False

    @property
    def phase(self):
        return self._phase

    def _guard(self, stage):
        if not callable(self.safety_guard):
            self._failed = True
            raise V2EvidenceError("ONNX_OS_MEMORY_CONFINEMENT_REQUIRED")
        try:
            proof = self.safety_guard(stage, self.phase)
        except Exception:
            self._failed = True
            raise V2EvidenceError("ONNX_OS_MEMORY_CONFINEMENT_REQUIRED") from None
        if (not isinstance(proof, dict) or proof.get("verified") is not True
                or proof.get("osMemoryLimitEnforced") is not True or proof.get("phase") != self.phase):
            self._failed = True
            raise V2EvidenceError("ONNX_OS_MEMORY_CONFINEMENT_REQUIRED")
        return {"verified": True, "osMemoryLimitEnforced": True, "phase": self.phase,
                "stage": stage}

    def _verify_artifacts(self):
        if not self.model_dir.is_absolute() or not self.dictionary_path.is_absolute():
            raise V2EvidenceError("LOCAL_MODEL_PATH_REQUIRED")
        required = {"config.json", "preprocessor_config.json"}
        if (not required.issubset(self.metadata_hashes)
                or any(not isinstance(name, str) or not re.fullmatch(r"[a-z_]+\.json", name)
                       or not isinstance(digest, str) or not re.fullmatch(r"[a-f0-9]{64}", digest)
                       for name, digest in self.metadata_hashes.items())
                or "vocab.json" in self.metadata_hashes and self.metadata_hashes["vocab.json"] != VOCAB_SHA256):
            raise V2EvidenceError("ONNX_AUDITED_METADATA_REQUIRED")
        expected = {**self.metadata_hashes, "vocab.json": VOCAB_SHA256, "model_int8.onnx": ONNX_SHA256}
        for name, digest in expected.items():
            path = self.model_dir / name
            if path.is_symlink() or not path.is_file():
                raise V2EvidenceError("LOCAL_MODEL_ARTIFACT_INVALID")
            size = path.stat().st_size
            if (name == "model_int8.onnx" and size != ONNX_BYTES) or (name != "model_int8.onnx" and size > 65536):
                raise V2EvidenceError("LOCAL_MODEL_ARTIFACT_INVALID")
            if file_hash(path) != digest:
                raise V2EvidenceError("LOCAL_MODEL_ARTIFACT_INVALID")
        if not self.dictionary_path.is_file() or self.dictionary_path.is_symlink():
            raise V2EvidenceError("LOCAL_LEXICON_UNAVAILABLE")
        try:
            config = json.loads((self.model_dir / "config.json").read_text(encoding="utf-8"))
            processor = json.loads((self.model_dir / "preprocessor_config.json").read_text(encoding="utf-8"))
            vocabulary = json.loads((self.model_dir / "vocab.json").read_text(encoding="utf-8"))
        except (OSError, ValueError, UnicodeError):
            raise V2EvidenceError("ONNX_PROCESSOR_CONFIG_INVALID") from None
        if (not isinstance(config, dict) or config.get("model_type") != "wav2vec2"
                or config.get("vocab_size") != 392 or config.get("pad_token_id") != 0
                or not isinstance(config.get("conv_stride"), list)
                or not config["conv_stride"] or any(isinstance(value, bool) or not isinstance(value, int)
                    or value <= 0 for value in config["conv_stride"])):
            raise V2EvidenceError("ONNX_MODEL_CONFIG_INVALID")
        if (not isinstance(processor, dict) or processor.get("feature_extractor_type") != "Wav2Vec2FeatureExtractor"
                or processor.get("sampling_rate") != 16000 or processor.get("feature_size") != 1
                or processor.get("padding_value") != 0.0 or processor.get("padding_side", "right") != "right"
                or not isinstance(processor.get("do_normalize"), bool)
                or not isinstance(processor.get("return_attention_mask"), bool)):
            raise V2EvidenceError("ONNX_PROCESSOR_CONFIG_INVALID")
        if not isinstance(vocabulary, dict) or len(vocabulary) != 392:
            raise V2EvidenceError("ONNX_MODEL_CONFIG_INVALID")
        self.mapper = CanonicalPhonemeMapper(vocabulary)
        self.scorer = Wav2Vec2PhonemeScorer(self.mapper)
        self.model_config, self.processor_config = config, processor
        return {"weightsSha256": ONNX_SHA256, "vocabSha256": VOCAB_SHA256,
                "metadataHashes": dict(self.metadata_hashes), "lexiconSha256": file_hash(self.dictionary_path)}

    @staticmethod
    def _load_dependencies():
        # Reached only after approved provenance, exact local pins and OS guard.
        import numpy as np
        import onnxruntime as ort
        return ort, np

    def load(self):
        if not self._lock.acquire(blocking=False):
            raise V2EvidenceError("LOCAL_RESEARCH_CONCURRENCY_LIMIT")
        try:
            if self._closed or self._failed:
                raise V2EvidenceError("ONNX_EXPERIMENT_TERMINATED")
            if self.session is not None:
                return self.load_metrics
            if self.provenance_verified is not True:
                raise V2EvidenceError("ONNX_MODEL_PROVENANCE_REQUIRED")
            guard = self._guard("before_hash_verification")
            started = time.perf_counter()
            before_available, before_memory = available_memory_bytes(), memory_observation()
            hashes = self._verify_artifacts()
            hash_ms = (time.perf_counter() - started) * 1000
            self._guard("before_native_import")
            imported = time.perf_counter()
            try:
                ort, np = self._load_dependencies()
            except (ImportError, OSError):
                raise V2EvidenceError("ONNX_RUNTIME_UNAVAILABLE") from None
            if ort.__version__ != ORT_VERSION:
                raise V2EvidenceError("ONNX_CPU_RUNTIME_NOT_AUDITED")
            if "CPUExecutionProvider" not in ort.get_available_providers():
                raise V2EvidenceError("ONNX_CPU_PROVIDER_UNAVAILABLE")
            ort.disable_telemetry_events()
            options = ort.SessionOptions()
            options.intra_op_num_threads = options.inter_op_num_threads = 1
            options.execution_mode = ort.ExecutionMode.ORT_SEQUENTIAL
            options.graph_optimization_level = ort.GraphOptimizationLevel.ORT_DISABLE_ALL
            options.enable_cpu_mem_arena = False
            options.enable_mem_pattern = False
            options.enable_profiling = False
            options.log_severity_level = 4
            options.add_session_config_entry("session.disable_prepacking", "1")
            options.add_session_config_entry("session.intra_op.allow_spinning", "0")
            options.add_session_config_entry("session.inter_op.allow_spinning", "0")
            import_ms = (time.perf_counter() - imported) * 1000
            self._guard("before_session_load")
            loading = time.perf_counter()
            try:
                session = ort.InferenceSession(str(self.model_dir / "model_int8.onnx"),
                    sess_options=options, providers=["CPUExecutionProvider"])
            except Exception:
                raise V2EvidenceError("ONNX_SESSION_LOAD_FAILED") from None
            if session.get_providers() != ["CPUExecutionProvider"]:
                raise V2EvidenceError("ONNX_CPU_PROVIDER_MISMATCH")
            inputs = {item.name: item for item in session.get_inputs()}
            outputs = {item.name: item for item in session.get_outputs()}
            if ("input_values" not in inputs or set(inputs) - {"input_values", "attention_mask"}
                    or inputs["input_values"].type != "tensor(float)" or len(inputs["input_values"].shape) != 2
                    or "attention_mask" in inputs and (inputs["attention_mask"].type != "tensor(int64)"
                        or len(inputs["attention_mask"].shape) != 2)
                    or "logits" not in outputs or outputs["logits"].type != "tensor(float)"
                    or len(outputs["logits"].shape) != 3
                    or isinstance(outputs["logits"].shape[-1], int) and outputs["logits"].shape[-1] != 392):
                raise V2EvidenceError("ONNX_MODEL_IO_SIGNATURE_UNSUPPORTED")
            self._guard("after_session_load")
            self.session, self.ort, self.np = session, ort, np
            self._input_names = frozenset(inputs)
            self.load_metrics = {"model": "onnx-community/wav2vec2-lv-60-espeak-cv-ft-ONNX",
                "variant": "model_int8.onnx", "weightsBytes": ONNX_BYTES, **hashes,
                "phase": self.phase, "inferenceLimit": PHASE_INFERENCE_LIMITS[self.phase],
                "onnxruntimeVersion": ort.__version__, "numpyVersion": getattr(np, "__version__", None),
                "providers": session.get_providers(), "threads": 1,
                "memoryOptions": {"cpuArena": False, "memoryPattern": False,
                    "graphOptimization": "ORT_DISABLE_ALL", "disablePrepacking": True},
                "hashVerificationElapsedMs": hash_ms, "dependencyImportElapsedMs": import_ms,
                "modelLoadElapsedMs": (time.perf_counter() - loading) * 1000,
                "totalInitializationElapsedMs": (time.perf_counter() - started) * 1000,
                "availableMemoryBeforeLoadBytes": before_available,
                "availableMemoryAfterLoadBytes": available_memory_bytes(),
                "memoryBefore": before_memory, "memoryAfterLoad": memory_observation(),
                "confinement": guard, "audioInferencesDuringLoad": 0, "paidCalls": 0}
            return self.load_metrics
        except Exception:
            self._failed = True
            self.session = self.ort = self.np = None
            raise
        finally:
            self._lock.release()

    def expected_sequence(self, text):
        if self.session is None or self.mapper is None:
            raise V2EvidenceError("ONNX_MODEL_NOT_LOADED")
        return self.mapper.map_words(expected_words_with_stress(text, self.dictionary_path))

    def _prepare_input(self, pcm16):
        np = self.np
        values = np.frombuffer(pcm16, dtype="<i2").astype(np.float32) / np.float32(32768.0)
        if self.processor_config["do_normalize"]:
            # Same zero-mean/unit-variance feature-extractor arithmetic, with its
            # numeric epsilon. This is not a pedagogical/confidence threshold.
            values = (values - values.mean()) / np.sqrt(values.var() + np.float32(1e-7))
        values = values.reshape(1, -1).astype(np.float32, copy=False)
        result = {"input_values": values}
        if "attention_mask" in self._input_names:
            result["attention_mask"] = np.ones(values.shape, dtype=np.int64)
        return result

    def _posteriors(self, native_output):
        np = self.np
        logits = np.asarray(native_output)
        if len(logits.shape) != 3 or logits.shape[0] != 1 or not 1 <= logits.shape[1] <= 4000 or logits.shape[2] != 392:
            raise V2EvidenceError("ONNX_POSTERIOR_SHAPE_INVALID")
        if not np.isfinite(logits).all():
            raise V2EvidenceError("ONNX_POSTERIOR_VALUE_INVALID")
        values = logits[0].astype(np.float32, copy=False)
        shifted = values - values.max(axis=-1, keepdims=True)
        log_probabilities = shifted - np.log(np.exp(shifted).sum(axis=-1, keepdims=True))
        return log_probabilities.tolist(), list(logits.shape)

    def assess(self, audio_bytes, expected_text, *, locale="en-US",
               baseline_completeness=None, baseline_fluency=None):
        if self.phase == "load":
            raise V2EvidenceError("ONNX_LOAD_PHASE_INFERENCE_FORBIDDEN")
        if self.session is None or self._closed or self._failed:
            raise V2EvidenceError("ONNX_MODEL_NOT_LOADED")
        if locale != "en-US":
            raise V2EvidenceError("LANGUAGE_OR_LOCALE_NOT_SUPPORTED")
        if not self._lock.acquire(blocking=False):
            raise V2EvidenceError("LOCAL_RESEARCH_CONCURRENCY_LIMIT")
        try:
            if self._inference_count >= PHASE_INFERENCE_LIMITS[self.phase]:
                raise V2EvidenceError("ONNX_PHASE_INFERENCE_LIMIT_REACHED")
            self._guard("before_audio_preprocessing")
            started, cpu_started = time.perf_counter(), time.process_time()
            preprocessing_started = time.perf_counter()
            try:
                prepared = AudioPreprocessor().prepare(audio_bytes)
            except EvidenceError as error:
                return {"status": "NOT_EVALUABLE", "error": error.code,
                    "confidence": None, "masteryEligible": False, "calibrationStatus": "UNCALIBRATED",
                    "phonemes": [], "words": [], "diagnostic": {"status": "LOW_CONFIDENCE",
                        "weakRegionCandidates": [], "confirmedWeakPhonemes": [], "confidence": None},
                    "audioRetained": False, "timings": {"preprocessingElapsedMs":
                        (time.perf_counter() - preprocessing_started) * 1000,
                        "totalElapsedMs": (time.perf_counter() - started) * 1000,
                        "cpuTimeMs": (time.process_time() - cpu_started) * 1000}}
            expected = self.expected_sequence(expected_text)
            feed = self._prepare_input(prepared.pcm16)
            preprocessing_ms = (time.perf_counter() - preprocessing_started) * 1000
            self._guard("before_inference")
            self._inference_count += 1  # Consumed even if native execution fails; no automatic retry.
            inference_started = time.perf_counter()
            try:
                output = self.session.run(["logits"], feed)
            except Exception:
                self._failed = True
                raise V2EvidenceError("ONNX_INFERENCE_FAILED") from None
            self._guard("after_inference")
            if not isinstance(output, (list, tuple)) or len(output) != 1:
                raise V2EvidenceError("ONNX_POSTERIOR_SHAPE_INVALID")
            log_posteriors, output_shape = self._posteriors(output[0])
            inference_ms = (time.perf_counter() - inference_started) * 1000
            content = "UNKNOWN"
            if isinstance(baseline_completeness, dict) and baseline_completeness.get("status") == "EVIDENCE_AVAILABLE":
                count, matched = baseline_completeness.get("expectedCount"), baseline_completeness.get("matchedCount")
                if count == len(G2PAdapter.tokenize(expected_text)) and isinstance(matched, int):
                    content = "MISMATCH" if matched == 0 else "PARTIAL" if baseline_completeness.get("omissions") else \
                        "MATCHED" if matched == count else "UNKNOWN"
            result = self.scorer.score(log_posteriors, expected,
                frameStrideMs=math.prod(self.model_config["conv_stride"]) * 1000.0 / 16000,
                contentStatus=content)
            result["completeness"] = baseline_completeness
            result["fluency"] = FluencyAnalyzer().analyze(result["words"], prepared)
            result["legacyFluencyBaseline"] = baseline_fluency
            result["legacyObservationProvenance"] = {
                "completeness": "CARRIED_FORWARD_ONLY_FOR_IDENTICAL_CONTROLLED_FIXTURE",
                "fluency": "EXISTING_TIMING_ANALYZER_ON_V2_ALIGNMENT",
                "legacyFluencyBaseline": "CARRIED_FORWARD_ONLY_FOR_IDENTICAL_CONTROLLED_FIXTURE"}
            result["audioRetained"] = False
            result["prosody"] = {"status": "NOT_IMPLEMENTED"}
            result["onnxOutputShape"] = output_shape
            result["timings"].update({"preprocessingElapsedMs": preprocessing_ms,
                "warmInferenceElapsedMs": inference_ms, "totalElapsedMs": (time.perf_counter() - started) * 1000,
                "cpuTimeMs": (time.process_time() - cpu_started) * 1000,
                "inferenceWasWarm": self._inference_count > 1})
            result["memory"] = memory_observation()
            self._guard("after_scoring")
            return result
        finally:
            self._lock.release()

    def close(self):
        if not self._lock.acquire(blocking=False):
            raise V2EvidenceError("LOCAL_RESEARCH_CONCURRENCY_LIMIT")
        try:
            self.session = self.ort = self.np = self.mapper = self.scorer = None
            self._closed = True
            gc.collect()
        finally:
            self._lock.release()
