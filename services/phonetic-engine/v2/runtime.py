"""Explicitly invoked, local-only V2 research runtime; never the beta scorer.

The model is not downloaded, imported or loaded on module import. Public weights
must be installed separately, pass immutable hashes and a local memory guard.
No tokenizer phonemizer, remote model code, provider, listener or audio file.
"""
from __future__ import annotations

import ctypes
import hashlib
import json
import math
import os
from pathlib import Path
import time

from phonetic_engine import AudioPreprocessor, EvidenceError, FluencyAnalyzer, G2PAdapter
from .errors import V2EvidenceError
from .mapper import CanonicalPhonemeMapper, expected_words_with_stress
from .scorer import Wav2Vec2PhonemeScorer

MODEL_REVISION = "ae45363bf3413b374fecd9dc8bc1df0e24c3b7f4"
MODEL_BYTES = 1263535127
MIN_AVAILABLE_MEMORY_BYTES = 3 * 1024 ** 3
MODEL_FILES = {
    "pytorch_model.bin": "3173bde9e9ce490fa0f989e413c42f25bc1820c020adc1e6b9b87025b3cfcc5e",
    "config.json": "4609fb49b7e1d28aecb2840da1926c40bd915bc6f1120a940afacf7159bbfb13",
    "preprocessor_config.json": "a2254a5b58f72cd4de3632f8eee64f3f098b7c1402128d2f419e7d00ae13e335",
    "vocab.json": "d732ab2456c0c017930001dc9af0b41b3b93d25b2eb9740bf9d925508d7d87d0",
}

def file_hash(path):
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(4 * 1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()

def available_memory_bytes():
    """Read-only local resource check. Unknown resources are not assumed safe."""
    if os.name == "nt":
        class MemoryStatus(ctypes.Structure):
            _fields_ = [("length", ctypes.c_ulong), ("memoryLoad", ctypes.c_ulong),
                ("totalPhys", ctypes.c_ulonglong), ("availPhys", ctypes.c_ulonglong),
                ("totalPageFile", ctypes.c_ulonglong), ("availPageFile", ctypes.c_ulonglong),
                ("totalVirtual", ctypes.c_ulonglong), ("availVirtual", ctypes.c_ulonglong),
                ("availExtendedVirtual", ctypes.c_ulonglong)]
        status = MemoryStatus()
        status.length = ctypes.sizeof(status)
        if not ctypes.windll.kernel32.GlobalMemoryStatusEx(ctypes.byref(status)):
            return None
        return int(status.availPhys)
    try:
        import psutil
        return int(psutil.virtual_memory().available)
    except (ImportError, OSError):
        return None

def memory_observation():
    try:
        import psutil
        value = psutil.Process().memory_info()
        return {"residentBytes": int(value.rss),
            "peakResidentBytes": int(getattr(value, "peak_wset", value.rss))}
    except (ImportError, OSError):
        return {"residentBytes": None, "peakResidentBytes": None}

class LocalWav2Vec2Runtime:
    def __init__(self, model_dir, dictionary_path, threads=1):
        self.model_dir = Path(model_dir)
        self.dictionary_path = Path(dictionary_path)
        if threads != 1:
            raise V2EvidenceError("LOCAL_RESEARCH_CONCURRENCY_LIMIT")
        self.threads = threads
        self.model = None
        self.torch = None
        self.extractor = None
        self.mapper = None
        self.scorer = None
        self.load_metrics = None
        self._inference_count = 0

    def load(self):
        if self.model is not None:
            return self.load_metrics
        available = available_memory_bytes()
        # A resource guard, not a learner quota or prediction of measured RSS.
        if available is None or available < MIN_AVAILABLE_MEMORY_BYTES:
            error = V2EvidenceError("LOCAL_RESOURCE_MEMORY_INSUFFICIENT")
            error.resource = {"availableMemoryBytes": available,
                "requiredHeadroomBytes": MIN_AVAILABLE_MEMORY_BYTES,
                "measuredModelMemory": False}
            raise error
        if not self.model_dir.is_absolute() or not self.dictionary_path.is_absolute():
            raise V2EvidenceError("LOCAL_MODEL_PATH_REQUIRED")
        started = time.perf_counter()
        for name, expected_hash in MODEL_FILES.items():
            path = self.model_dir / name
            if path.is_symlink() or not path.is_file() or file_hash(path) != expected_hash:
                raise V2EvidenceError("LOCAL_MODEL_ARTIFACT_INVALID")
        if (self.model_dir / "pytorch_model.bin").stat().st_size != MODEL_BYTES:
            raise V2EvidenceError("LOCAL_MODEL_ARTIFACT_INVALID")
        hash_elapsed = (time.perf_counter() - started) * 1000
        if not self.dictionary_path.is_file():
            raise V2EvidenceError("LOCAL_LEXICON_UNAVAILABLE")
        os.environ["HF_HUB_OFFLINE"] = "1"
        os.environ["TRANSFORMERS_OFFLINE"] = "1"
        os.environ["HF_HUB_DISABLE_TELEMETRY"] = "1"
        os.environ["TOKENIZERS_PARALLELISM"] = "false"
        os.environ["OMP_NUM_THREADS"] = "1"
        os.environ["MKL_NUM_THREADS"] = "1"
        imports_started = time.perf_counter()
        import torch
        from transformers import Wav2Vec2FeatureExtractor, Wav2Vec2ForCTC
        if torch.__version__ != "2.8.0+cpu" or torch.version.cuda is not None:
            raise V2EvidenceError("LOCAL_CPU_RUNTIME_NOT_AUDITED")
        imports_elapsed = (time.perf_counter() - imports_started) * 1000
        torch.set_num_threads(1)
        torch.set_num_interop_threads(1)
        load_started = time.perf_counter()
        extractor = Wav2Vec2FeatureExtractor.from_pretrained(str(self.model_dir), local_files_only=True)
        # Never fall back to unsafe pickle loading or downloaded remote code.
        model = Wav2Vec2ForCTC.from_pretrained(str(self.model_dir), local_files_only=True,
            trust_remote_code=False, weights_only=True, torch_dtype=torch.float32,
            low_cpu_mem_usage=True, attn_implementation="eager")
        model.eval()
        model.requires_grad_(False)
        if model.config.vocab_size != 392 or model.config.pad_token_id != 0:
            raise V2EvidenceError("LOCAL_MODEL_INVENTORY_INVALID")
        with (self.model_dir / "vocab.json").open(encoding="utf-8") as stream:
            self.mapper = CanonicalPhonemeMapper(json.load(stream))
        self.scorer = Wav2Vec2PhonemeScorer(self.mapper)
        self.model, self.extractor, self.torch = model, extractor, torch
        self.load_metrics = {"model": "facebook/wav2vec2-lv-60-espeak-cv-ft",
            "revision": MODEL_REVISION, "weightsBytes": MODEL_BYTES,
            "weightsSha256": MODEL_FILES["pytorch_model.bin"],
            "lexiconSha256": file_hash(self.dictionary_path),
            "hashVerificationElapsedMs": hash_elapsed, "dependencyImportElapsedMs": imports_elapsed,
            "modelLoadElapsedMs": (time.perf_counter() - load_started) * 1000,
            "totalInitializationElapsedMs": (time.perf_counter() - started) * 1000,
            "threads": 1, "device": "cpu", "memory": memory_observation(),
            "availableMemoryBeforeLoadBytes": available, "paidCalls": 0}
        return self.load_metrics

    def expected_sequence(self, text):
        # Same CMUdict lexicon layer and token/OOV policy; retain its original
        # stress metadata for explicit AH0/ER0 mapping rather than guessing it.
        return self.mapper.map_words(expected_words_with_stress(text, self.dictionary_path))

    def assess(self, audio_bytes, expected_text, *, locale="en-US",
               baseline_completeness=None, baseline_fluency=None):
        if self.model is None:
            raise V2EvidenceError("LOCAL_MODEL_NOT_LOADED")
        if locale != "en-US":
            raise V2EvidenceError("LANGUAGE_OR_LOCALE_NOT_SUPPORTED")
        started, cpu_started = time.perf_counter(), time.process_time()
        preprocessing_started = time.perf_counter()
        try:
            prepared = AudioPreprocessor().prepare(audio_bytes)
        except EvidenceError as error:
            return {"status": "NOT_EVALUABLE", "error": error.code,
                "confidence": None, "masteryEligible": False, "calibrationStatus": "UNCALIBRATED",
                "phonemes": [], "words": [], "diagnostic": {"status": "LOW_CONFIDENCE",
                    "weakRegionCandidates": [], "confirmedWeakPhonemes": [], "confidence": None},
                "timings": {"preprocessingElapsedMs": (time.perf_counter() - preprocessing_started) * 1000,
                    "totalElapsedMs": (time.perf_counter() - started) * 1000,
                    "cpuTimeMs": (time.process_time() - cpu_started) * 1000}}
        preprocessing_ms = (time.perf_counter() - preprocessing_started) * 1000
        expected = self.expected_sequence(expected_text)
        import numpy as np
        samples = np.frombuffer(prepared.pcm16, dtype="<i2").astype(np.float32) / 32768.0
        inference_started = time.perf_counter()
        values = self.extractor(samples, sampling_rate=16000, return_tensors="pt", return_attention_mask=True)
        with self.torch.inference_mode():
            logits = self.model(**values).logits[0]
            log_posteriors = self.torch.log_softmax(logits.float(), dim=-1).cpu().tolist()
        inference_ms = (time.perf_counter() - inference_started) * 1000
        # Existing completeness signals stay independent. The frozen acceptance
        # runner must verify identical audio SHA/text before carrying them over.
        content = "UNKNOWN"
        if isinstance(baseline_completeness, dict) and baseline_completeness.get("status") == "EVIDENCE_AVAILABLE":
            expected_count = baseline_completeness.get("expectedCount")
            matched = baseline_completeness.get("matchedCount")
            if expected_count == len(G2PAdapter.tokenize(expected_text)) and isinstance(matched, int):
                # A secondary ASR substitution can also be the intended contrast
                # under test. Do not silently label it a missing phrase or a
                # confirmed phonetic error. Coarse missing-content signals stay
                # separate, with their original tentative provenance.
                omissions = baseline_completeness.get("omissions")
                content = "MISMATCH" if matched == 0 else "PARTIAL" if omissions else \
                    "MATCHED" if matched == expected_count else "UNKNOWN"
        frame_stride_ms = math.prod(self.model.config.conv_stride) * 1000.0 / 16000
        result = self.scorer.score(log_posteriors, expected, frameStrideMs=frame_stride_ms, contentStatus=content)
        result["completeness"] = baseline_completeness
        result["fluency"] = FluencyAnalyzer().analyze(result["words"], prepared)
        result["legacyFluencyBaseline"] = baseline_fluency
        result["legacyObservationProvenance"] = {
            "completeness": "CARRIED_FORWARD_ONLY_FOR_IDENTICAL_CONTROLLED_FIXTURE",
            "fluency": "EXISTING_TIMING_ANALYZER_ON_V2_ALIGNMENT",
            "legacyFluencyBaseline": "CARRIED_FORWARD_ONLY_FOR_IDENTICAL_CONTROLLED_FIXTURE"}
        result["audioRetained"] = False
        result["prosody"] = {"status": "NOT_IMPLEMENTED"}
        result["timings"].update({"preprocessingElapsedMs": preprocessing_ms,
            "warmInferenceElapsedMs": inference_ms, "totalElapsedMs": (time.perf_counter() - started) * 1000,
            "cpuTimeMs": (time.process_time() - cpu_started) * 1000,
            "inferenceWasWarm": self._inference_count > 0})
        self._inference_count += 1
        result["memory"] = memory_observation()
        return result
