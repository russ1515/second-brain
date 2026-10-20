"""Bounded, local acoustic evidence. This module does not certify pronunciation.

No provider/network calls, HTTP listener, telemetry, audio persistence or transcript
logging are performed. Scores are raw HMM log likelihoods, never percentages.
"""

from __future__ import annotations

import array
import base64
import binascii
import functools
import hashlib
import importlib.metadata
import io
import json
import math
import os
from pathlib import Path
import re
import struct
import subprocess
import sys
import time
import unicodedata
import wave
from dataclasses import dataclass
from typing import Any, Callable


ENGINE_VERSION = "sb-phonetic-v1-pocketsphinx-5.0.4"
MAX_REQUEST_BYTES = 8 * 1024 * 1024
MAX_AUDIO_BYTES = 6 * 1024 * 1024
MAX_AUDIO_SECONDS = 30
MAX_EXPECTED_WORDS = 80
MAX_EXPECTED_CHARACTERS = 2000
MAX_OUTPUT_BYTES = 1024 * 1024
SAMPLE_RATE = 16000
MIN_AUDIO_SECONDS = 0.15
MAX_PHONEMES = 800
# Product aliases are mapped explicitly to a real model locale, never inferred
# from the teaching language or silently promoted to broader language coverage.
ENGLISH_US_PROFILE = {
    "language": "en", "modelLocale": "en-US",
    "modelRelativePath": "en-us/en-us",
    "dictionaryRelativePath": "en-us/cmudict-en-us.dict",
    "languageModelRelativePath": "en-us/en-us.lm.bin",
    "locales": {"en": "en-US", "en-US": "en-US"},
}
MODEL_PROFILES = {"en": ENGLISH_US_PROFILE, "en-US": ENGLISH_US_PROFILE}
MODEL_ARTIFACT_NAMES = ("feat.params", "mdef", "means", "noisedict", "sendump",
                        "transition_matrices", "variances")
# Identity of the pinned, locally audited 5.0.4 bundled English artifacts.
# These are integrity fingerprints, not secrets or pronunciation thresholds.
EXPECTED_MODEL_SHA256 = "1d60fb00c87c143d94a49ebd275f4aeec78996596b183655b8d01c3cdab20870"
EXPECTED_LEXICON_SHA256 = "b5ef92f6b9584f30fb8552acce799e5ff432d0b19bd81488a9a6b20a6bd2d644"
EXPECTED_LANGUAGE_MODEL_SHA256 = "db21d0642286677699e6dbc859d2e5395570222361999387ce60f6e1d01995d6"

# Broad US-English phonemic rendering of the model's ARPABET inventory. The
# stressless acoustic inventory cannot distinguish AH0/AH1 or ER0/ER1. IPA is
# canonical reference information, NOT a claim that these phones were observed.
ARPABET_IPA = {
    "AA": "ɑ", "AE": "æ", "AH": "ʌ", "AO": "ɔ", "AW": "aʊ",
    "AY": "aɪ", "B": "b", "CH": "tʃ", "D": "d", "DH": "ð",
    "EH": "ɛ", "ER": "ɝ", "EY": "eɪ", "F": "f", "G": "ɡ",
    "HH": "h", "IH": "ɪ", "IY": "i", "JH": "dʒ", "K": "k",
    "L": "l", "M": "m", "N": "n", "NG": "ŋ", "OW": "oʊ",
    "OY": "ɔɪ", "P": "p", "R": "ɹ", "S": "s", "SH": "ʃ",
    "T": "t", "TH": "θ", "UH": "ʊ", "UW": "u", "V": "v",
    "W": "w", "Y": "j", "Z": "z", "ZH": "ʒ",
}
FILLER_WORDS = {"<s>", "</s>", "<sil>", "[speech]", "[noise]"}
FILLER_PHONES = {"SIL", "+SPN+", "+NSN+"}


class EvidenceError(Exception):
    """Only fixed error codes may cross the service boundary."""

    def __init__(self, code: str, technical: bool = False):
        super().__init__(code)
        self.code = code
        self.technical = technical


@dataclass(frozen=True)
class ArtifactFingerprints:
    model_sha256: str
    lexicon_sha256: str
    manifest: tuple[tuple[str, int, str], ...]


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


@functools.lru_cache(maxsize=4)
def artifact_fingerprints(model_path: str, dictionary_path: str) -> ArtifactFingerprints:
    """Hash the selected immutable model files once per worker process.

    Aggregate = SHA256 of a sorted compact JSON [name, byteLength, SHA256] manifest.
    The model directory must remain read-only during the worker lifetime.
    """
    try:
        root = Path(model_path).resolve(strict=True)
        dictionary = Path(dictionary_path).resolve(strict=True)
        if not root.is_dir() or not dictionary.is_file():
            raise EvidenceError("MODEL_ARTIFACT_UNAVAILABLE", technical=True)
        manifest = []
        for name in MODEL_ARTIFACT_NAMES:
            candidate = root / name
            if not candidate.exists():
                continue
            resolved = candidate.resolve(strict=True)
            if resolved.parent != root or not resolved.is_file():
                raise EvidenceError("MODEL_ARTIFACT_INVALID", technical=True)
            manifest.append((name, resolved.stat().st_size, file_sha256(resolved)))
        if not any(name == "mdef" for name, _, _ in manifest) or not any(
                name in ("means", "sendump") for name, _, _ in manifest):
            raise EvidenceError("MODEL_ARTIFACT_UNAVAILABLE", technical=True)
        frozen_manifest = tuple(sorted(manifest))
        encoded = json.dumps(frozen_manifest, separators=(",", ":"), ensure_ascii=True).encode("ascii")
        return ArtifactFingerprints(hashlib.sha256(encoded).hexdigest(), file_sha256(dictionary), frozen_manifest)
    except EvidenceError:
        raise
    except (OSError, ValueError):
        raise EvidenceError("MODEL_ARTIFACT_UNAVAILABLE", technical=True) from None


@functools.lru_cache(maxsize=4)
def verified_language_model_sha256(path: str) -> str:
    try:
        actual = file_sha256(Path(path).resolve(strict=True))
    except (OSError, ValueError):
        raise EvidenceError("MODEL_ARTIFACT_UNAVAILABLE", technical=True) from None
    if actual != EXPECTED_LANGUAGE_MODEL_SHA256:
        raise EvidenceError("MODEL_ARTIFACT_INTEGRITY_FAILED", technical=True)
    return actual


def load_local_runtime(profile: dict[str, Any]) -> tuple[Any, str, str, str, ArtifactFingerprints]:
    """Read only pinned local artifacts. Never downloads or substitutes a model."""
    try:
        from pocketsphinx import Decoder, get_model_path
        if importlib.metadata.version("pocketsphinx") != "5.0.4":
            raise EvidenceError("ACOUSTIC_ENGINE_VERSION_UNSUPPORTED", technical=True)
    except ImportError:
        raise EvidenceError("ACOUSTIC_ENGINE_UNAVAILABLE", technical=True) from None
    model_path = get_model_path(profile["modelRelativePath"])
    dictionary_path = get_model_path(profile["dictionaryRelativePath"])
    language_model_path = get_model_path(profile["languageModelRelativePath"])
    fingerprints = artifact_fingerprints(model_path, dictionary_path)
    if (fingerprints.model_sha256 != EXPECTED_MODEL_SHA256
            or fingerprints.lexicon_sha256 != EXPECTED_LEXICON_SHA256):
        raise EvidenceError("MODEL_ARTIFACT_INTEGRITY_FAILED", technical=True)
    verified_language_model_sha256(language_model_path)
    return Decoder, model_path, dictionary_path, language_model_path, fingerprints


def insufficient_pronunciation_diagnostic() -> dict[str, Any]:
    """Forced reference alignment cannot prove a phone was spoken correctly.

Phase H controlled lexical contrasts demonstrated that some wrong sounds are
forced onto the expected phones. Raw likelihoods must not become weak-phone
warnings, 'stable' words, confidence percentages or a mastery decision.
"""
    return {"status": "INSUFFICIENT_ACOUSTIC_CONFIDENCE",
            "reason": "REFERENCE_ALIGNMENT_IS_NOT_A_PHONEME_DIAGNOSIS",
            "confidence": None, "weakEvidenceCount": 0,
            "weakWords": [], "weakPhonemes": [], "highConfidenceIssues": [],
            "wordQualityJudgementAvailable": False,
            "phonemeQualityJudgementAvailable": False}


def capabilities() -> dict[str, Any]:
    """Private readiness probe; no audio, inference, network or installation."""
    result = {"operation": "capabilities", "engineVersion": ENGINE_VERSION,
              "available": False, "capability": "PRACTICE_ONLY", "language": "en",
              "locale": "en-US", "calibrationStatus": "UNCALIBRATED",
              "masteryEligible": False,
              "diagnosticStatus": "INSUFFICIENT_ACOUSTIC_CONFIDENCE",
              "supportedFormats": [], "maxAudioSeconds": MAX_AUDIO_SECONDS}
    try:
        _, _, _, _, fingerprints = load_local_runtime(ENGLISH_US_PROFILE)
        result.update({"available": True, "capability": "ACOUSTIC_UNCALIBRATED",
                       "modelArtifactSha256": fingerprints.model_sha256,
                       "lexiconSha256": fingerprints.lexicon_sha256,
                       "supportedFormats": ["audio/wav", "audio/x-wav"]})
        converter = os.environ.get("PHONETIC_FFMPEG_EXECUTABLE")
        if converter and Path(converter).is_absolute() and Path(converter).is_file():
            result["supportedFormats"].extend(["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg"])
    except EvidenceError as error:
        result["errors"] = [{"code": error.code}]
    except Exception:
        result["errors"] = [{"code": "ACOUSTIC_ENGINE_UNAVAILABLE"}]
    return result


@dataclass(frozen=True)
class PreparedAudio:
    pcm16: bytes
    duration_ms: float
    source_sample_rate: int
    source_channels: int
    rms_dbfs: float
    peak: float
    clipped_fraction: float
    conversion: str

    def evidence(self) -> dict[str, Any]:
        return {
            "durationMs": round(self.duration_ms, 3),
            "sampleRate": SAMPLE_RATE,
            "channels": 1,
            "sourceSampleRate": self.source_sample_rate,
            "sourceChannels": self.source_channels,
            "rmsDbfs": round(self.rms_dbfs, 3),
            "peak": round(self.peak, 6),
            "clippedFraction": round(self.clipped_fraction, 6),
            "conversion": self.conversion,
        }


class AudioPreprocessor:
    """Decode bounded PCM WAV; optional explicitly configured ffmpeg only.

    Limits are technical CPU/memory guards, not product quotas. WAV metadata is
    checked before frames are read. Uncompressed audio never uses ffmpeg.
    """

    def __init__(self, ffmpeg_executable: str | None = None):
        self.ffmpeg_executable = ffmpeg_executable

    def prepare(self, audio_bytes: bytes) -> PreparedAudio:
        if not audio_bytes or len(audio_bytes) > MAX_AUDIO_BYTES:
            raise EvidenceError("AUDIO_SIZE_INVALID")
        if audio_bytes[:4] == b"RIFF" and audio_bytes[8:12] == b"WAVE":
            return self._wav(audio_bytes)
        if not self.ffmpeg_executable:
            raise EvidenceError("UNSUPPORTED_AUDIO_FORMAT")
        return self._converted(audio_bytes)

    def _wav(self, data: bytes) -> PreparedAudio:
        try:
            with wave.open(io.BytesIO(data), "rb") as reader:
                channels, width, rate, frames, compression, _ = reader.getparams()
                if compression != "NONE" or width not in (1, 2, 3, 4):
                    raise EvidenceError("UNSUPPORTED_WAV_ENCODING")
                if not 1 <= channels <= 8 or not 8000 <= rate <= 192000:
                    raise EvidenceError("UNSUPPORTED_AUDIO_CONFIGURATION")
                if frames < math.ceil(rate * MIN_AUDIO_SECONDS):
                    raise EvidenceError("AUDIO_TOO_SHORT")
                if frames > rate * MAX_AUDIO_SECONDS:
                    raise EvidenceError("AUDIO_TOO_LONG")
                expected_bytes = frames * channels * width
                if expected_bytes > MAX_AUDIO_BYTES:
                    raise EvidenceError("AUDIO_SIZE_INVALID")
                raw = reader.readframes(frames + 1)
                if len(raw) != expected_bytes:
                    raise EvidenceError("AUDIO_CORRUPT")
        except EvidenceError:
            raise
        except (wave.Error, EOFError, ValueError, struct.error, OverflowError):
            raise EvidenceError("AUDIO_CORRUPT") from None
        values = self._pcm_values(raw, width)
        if channels > 1:
            values = [sum(values[i:i + channels]) / channels
                      for i in range(0, len(values), channels)]
        if rate != SAMPLE_RATE:
            values = self._resample(values, rate)
        return self._finish(values, rate, channels, "PCM_WAV")

    @staticmethod
    def _pcm_values(raw: bytes, width: int) -> list[float]:
        if width == 1:
            return [(value - 128) / 128.0 for value in raw]
        if width in (2, 4):
            values = array.array("h" if width == 2 else "i")
            values.frombytes(raw)
            if sys.byteorder != "little":
                values.byteswap()
            divisor = float(1 << (width * 8 - 1))
            return [value / divisor for value in values]
        return [int.from_bytes(raw[i:i + 3], "little", signed=True) / 8388608.0
                for i in range(0, len(raw), 3)]

    @staticmethod
    def _resample(values: list[float], rate: int) -> list[float]:
        # A bounded linear interpolator avoids a heavyweight runtime dependency.
        # Resampling is recorded; it is not evidence of pronunciation quality.
        size = max(1, round(len(values) * SAMPLE_RATE / rate))
        result = []
        for index in range(size):
            source = index * rate / SAMPLE_RATE
            left = min(int(source), len(values) - 1)
            right = min(left + 1, len(values) - 1)
            result.append(values[left] + (source - left) * (values[right] - values[left]))
        return result

    def _converted(self, data: bytes) -> PreparedAudio:
        executable = Path(self.ffmpeg_executable or "")
        if not executable.is_absolute() or not executable.is_file():
            raise EvidenceError("AUDIO_CONVERTER_CONFIGURATION_INVALID", technical=True)
        # No shell, URL, filesystem input, arbitrary arguments or remote protocols.
        # The +20ms sentinel detects duration overflow instead of silently truncating.
        command = [str(executable), "-nostdin", "-hide_banner", "-loglevel", "quiet",
                   "-protocol_whitelist", "pipe", "-i", "pipe:0", "-vn", "-t",
                   str(MAX_AUDIO_SECONDS + 0.02), "-ac", "1", "-ar", str(SAMPLE_RATE),
                   "-f", "s16le", "-acodec", "pcm_s16le", "pipe:1"]
        try:
            converted = subprocess.run(command, input=data, stdout=subprocess.PIPE,
                                       stderr=subprocess.DEVNULL, timeout=20,
                                       shell=False, check=False)
        except (OSError, subprocess.TimeoutExpired):
            raise EvidenceError("AUDIO_CONVERSION_FAILED") from None
        if converted.returncode or not converted.stdout or len(converted.stdout) % 2:
            raise EvidenceError("AUDIO_CONVERSION_FAILED")
        if len(converted.stdout) > MAX_AUDIO_SECONDS * SAMPLE_RATE * 2:
            raise EvidenceError("AUDIO_TOO_LONG")
        values = self._pcm_values(converted.stdout, 2)
        return self._finish(values, SAMPLE_RATE, 1, "CONFIGURED_FFMPEG_PCM16")

    @staticmethod
    def _finish(values: list[float], source_rate: int, channels: int,
                conversion: str) -> PreparedAudio:
        if len(values) < MIN_AUDIO_SECONDS * SAMPLE_RATE:
            raise EvidenceError("AUDIO_TOO_SHORT")
        if len(values) > MAX_AUDIO_SECONDS * SAMPLE_RATE:
            raise EvidenceError("AUDIO_TOO_LONG")
        peak = max(abs(value) for value in values)
        rms = math.sqrt(sum(value * value for value in values) / len(values))
        # Reject digital silence / effectively empty recordings, not quiet accents.
        if peak < 0.0001 or rms < 0.00001:
            raise EvidenceError("AUDIO_SILENT")
        clipped = sum(abs(value) >= 0.999 for value in values) / len(values)
        samples = array.array("h", (max(-32768, min(32767, round(value * 32768)))
                                    for value in values))
        if sys.byteorder != "little":
            samples.byteswap()
        return PreparedAudio(samples.tobytes(), len(values) * 1000 / SAMPLE_RATE,
                             source_rate, channels, 20 * math.log10(rms), peak,
                             clipped, conversion)


class G2PAdapter:
    """Canonical lexicon adapter; no invented fallback for out-of-vocabulary words.

    Dictionary lookup is honestly labelled LEXICON_ONLY rather than a universal
    neural G2P implementation. OOV is not evaluable in this first adapter.
    """

    def __init__(self, dictionary_path: Path):
        self.dictionary_path = dictionary_path
        self.entries: dict[str, tuple[str, ...]] = {}

    def _load(self) -> None:
        if self.entries:
            return
        try:
            with self.dictionary_path.open(encoding="utf-8") as dictionary:
                for line in dictionary:
                    if line.startswith((";", "#")):
                        continue
                    fields = line.strip().split()
                    if len(fields) < 2:
                        continue
                    word = fields[0].lower()
                    if re.search(r"\(\d+\)$", word):
                        continue
                    self.entries[word] = tuple(re.sub(r"\d$", "", phone)
                                               for phone in fields[1:])
        except (OSError, UnicodeError):
            raise EvidenceError("LEXICON_UNAVAILABLE", technical=True) from None
        if not self.entries:
            raise EvidenceError("LEXICON_UNAVAILABLE", technical=True)

    @staticmethod
    def tokenize(text: str) -> list[str]:
        text = unicodedata.normalize("NFKC", text).replace("’", "'").lower()
        return re.findall(r"[^\W_]+(?:'[^\W_]+)*", text, flags=re.UNICODE)

    def convert(self, text: str) -> list[dict[str, Any]]:
        self._load()
        words = self.tokenize(text)
        if not words or len(words) > MAX_EXPECTED_WORDS:
            raise EvidenceError("EXPECTED_TEXT_INVALID")
        result = []
        for word in words:
            phones = self.entries.get(word)
            if not phones or any(phone not in ARPABET_IPA for phone in phones):
                raise EvidenceError("EXPECTED_WORD_OUT_OF_VOCABULARY")
            result.append({"word": word, "arpabet": list(phones),
                           "ipa": [ARPABET_IPA[phone] for phone in phones]})
        if sum(len(word["arpabet"]) for word in result) > MAX_PHONEMES:
            raise EvidenceError("EXPECTED_TEXT_TOO_COMPLEX")
        return result


class PhoneticAligner:
    """Real two-pass word and phone alignment, no transcription-confidence score."""

    def __init__(self, decoder_factory: Callable[..., Any], model_path: str,
                 dictionary_path: str):
        self.decoder_factory = decoder_factory
        self.model_path = model_path
        self.dictionary_path = dictionary_path

    def align(self, audio: PreparedAudio, targets: list[dict[str, Any]]) -> list[dict[str, Any]]:
        try:
            decoder = self.decoder_factory(hmm=self.model_path, dict=self.dictionary_path,
                                           lm=None, samprate=SAMPLE_RATE,
                                           loglevel="FATAL")
            # Verified against the actual pinned 5.0.4 binary's public API.
            decoder.set_align_text(" ".join(word["word"] for word in targets))
            for subword in (False, True):
                if subword:
                    decoder.set_alignment()
                decoder.start_utt()
                decoder.process_raw(audio.pcm16, full_utt=True)
                decoder.end_utt()
            alignment = decoder.get_alignment()
            if alignment is None:
                raise EvidenceError("ALIGNMENT_UNAVAILABLE")
            result = []
            frame_limit = math.ceil(audio.duration_ms / 10) + 3
            for word in alignment:
                if word.name.lower() in FILLER_WORDS:
                    continue
                phones = []
                for phone in word:
                    if phone.name in FILLER_PHONES:
                        continue
                    symbol = re.sub(r"\d$", "", phone.name)
                    if symbol not in ARPABET_IPA:
                        raise EvidenceError("ALIGNMENT_PHONE_UNSUPPORTED")
                    if phone.duration <= 0 or phone.start < 0 or phone.start + phone.duration > frame_limit:
                        raise EvidenceError("ALIGNMENT_TIMING_INVALID")
                    phones.append({"name": symbol, "start": int(phone.start),
                                   "duration": int(phone.duration), "score": int(phone.score)})
                if word.duration <= 0 or not phones:
                    raise EvidenceError("ALIGNMENT_TIMING_INVALID")
                result.append({"word": re.sub(r"\(\d+\)$", "", word.name.lower()),
                               "start": int(word.start), "duration": int(word.duration),
                               "score": int(word.score), "phones": phones})
            if len(result) != len(targets) or [word["word"] for word in result] != [word["word"] for word in targets]:
                raise EvidenceError("ALIGNMENT_TARGET_MISMATCH")
            if sum(len(word["phones"]) for word in result) > MAX_PHONEMES:
                raise EvidenceError("ALIGNMENT_TOO_LARGE")
            return result
        except EvidenceError:
            raise
        except (RuntimeError, ValueError, TypeError, OverflowError):
            raise EvidenceError("ALIGNMENT_UNAVAILABLE") from None


class Normalizer:
    """Technical duration normalization, not a cross-phone quality scale."""

    @staticmethod
    def per_frame(raw_score: int, duration: int) -> float:
        if duration <= 0 or not isinstance(raw_score, int):
            raise EvidenceError("ALIGNMENT_SCORE_INVALID")
        return raw_score / duration


class AcousticPhonemeScorer:
    def __init__(self, normalizer: Normalizer | None = None):
        self.normalizer = normalizer or Normalizer()

    def score(self, alignment: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
        words, phonemes = [], []
        for word_index, word in enumerate(alignment):
            indexes = []
            for phone in word["phones"]:
                index = len(phonemes)
                indexes.append(index)
                phonemes.append({
                    "index": index, "wordIndex": word_index,
                    "expectedPhoneme": ARPABET_IPA[phone["name"]],
                    "expectedArpabet": phone["name"],
                    "observed": None, "bestAlternative": None,
                    "startMs": phone["start"] * 10,
                    "endMs": (phone["start"] + phone["duration"]) * 10,
                    "rawAcousticScore": phone["score"],
                    "rawAcousticScorePerFrame": self.normalizer.per_frame(phone["score"], phone["duration"]),
                    "confidence": None,
                })
            words.append({"index": word_index, "word": word["word"],
                          "startMs": word["start"] * 10,
                          "endMs": (word["start"] + word["duration"]) * 10,
                          "rawAcousticScore": word["score"],
                          "rawAcousticScorePerFrame": self.normalizer.per_frame(word["score"], word["duration"]),
                          "confidence": None, "phonemeIndexes": indexes})
        return words, phonemes


class CompletenessAnalyzer:
    """Secondary ASR word comparison; tentative completeness, not phonetic quality."""

    def __init__(self, decoder_factory: Callable[..., Any], model_path: str,
                 dictionary_path: str, language_model_path: str):
        self.decoder_factory = decoder_factory
        self.paths = {"hmm": model_path, "dict": dictionary_path, "lm": language_model_path}

    @staticmethod
    def compare(expected: list[str], observed: list[str]) -> dict[str, Any]:
        rows, cols = len(expected) + 1, len(observed) + 1
        distance = [[0] * cols for _ in range(rows)]
        for i in range(rows):
            distance[i][0] = i
        for j in range(cols):
            distance[0][j] = j
        for i in range(1, rows):
            for j in range(1, cols):
                distance[i][j] = min(distance[i - 1][j] + 1,
                                     distance[i][j - 1] + 1,
                                     distance[i - 1][j - 1] + (expected[i - 1] != observed[j - 1]))
        omissions, insertions, substitutions = [], [], []
        matches, i, j = 0, len(expected), len(observed)
        while i or j:
            if i and j and distance[i][j] == distance[i - 1][j - 1] + (expected[i - 1] != observed[j - 1]):
                if expected[i - 1] == observed[j - 1]:
                    matches += 1
                else:
                    substitutions.append({"expectedIndex": i - 1, "expectedWord": expected[i - 1],
                                          "observedIndex": j - 1, "observedWord": observed[j - 1]})
                i, j = i - 1, j - 1
            elif i and distance[i][j] == distance[i - 1][j] + 1:
                omissions.append({"expectedIndex": i - 1, "expectedWord": expected[i - 1]})
                i -= 1
            else:
                insertions.append({"observedIndex": j - 1, "observedWord": observed[j - 1]})
                j -= 1
        return {"status": "EVIDENCE_AVAILABLE", "method": "SECONDARY_ASR_WORD_ALIGNMENT",
                "tentative": True, "qualityScore": None, "confidence": None,
                "observedWords": observed, "expectedCount": len(expected),
                "observedCount": len(observed), "matchedCount": matches,
                "omissions": list(reversed(omissions)), "insertions": list(reversed(insertions)),
                "substitutions": list(reversed(substitutions))}

    def analyze(self, audio: PreparedAudio, expected: list[str]) -> dict[str, Any]:
        try:
            decoder = self.decoder_factory(**self.paths, samprate=SAMPLE_RATE, loglevel="FATAL")
            decoder.start_utt()
            decoder.process_raw(audio.pcm16, full_utt=True)
            decoder.end_utt()
            hypothesis = decoder.hyp()
            if hypothesis is None:
                return {"status": "NOT_EVALUABLE", "reason": "SECONDARY_ASR_NO_HYPOTHESIS",
                        "tentative": True, "qualityScore": None, "confidence": None}
            observed = [re.sub(r"\(\d+\)$", "", word)
                        for word in G2PAdapter.tokenize(hypothesis.hypstr)]
            if len(observed) > MAX_EXPECTED_WORDS * 3:
                return {"status": "NOT_EVALUABLE", "reason": "SECONDARY_ASR_OUTPUT_TOO_LARGE",
                        "tentative": True, "qualityScore": None, "confidence": None}
            return self.compare(expected, observed)
        except (RuntimeError, ValueError, TypeError, OSError):
            return {"status": "NOT_EVALUABLE", "reason": "SECONDARY_ASR_UNAVAILABLE",
                    "tentative": True, "qualityScore": None, "confidence": None}


class FluencyAnalyzer:
    """Observable alignment timing only, no CEFR assessment or fluency grade."""

    def analyze(self, words: list[dict[str, Any]], audio: PreparedAudio,
                learner_level: str | None = None) -> dict[str, Any]:
        if not words:
            return {"status": "NOT_EVALUABLE", "reason": "TIMINGS_UNAVAILABLE", "qualityScore": None}
        pauses = []
        for left, right in zip(words, words[1:]):
            gap = max(0, right["startMs"] - left["endMs"])
            if gap >= 250:
                pauses.append({"startMs": left["endMs"], "durationMs": gap})
        span_ms = words[-1]["endMs"] - words[0]["startMs"]
        return {"status": "EVIDENCE_AVAILABLE", "method": "FORCED_ALIGNMENT_TIMINGS",
                "tentative": True, "qualityScore": None, "confidence": None,
                "wordCountSource": "EXPECTED_ALIGNED_WORDS", "alignedWordCount": len(words),
                "wordsPerMinute": round(len(words) * 60000 / span_ms, 3) if span_ms > 0 else None,
                "speechSpanMs": span_ms, "recordingDurationMs": round(audio.duration_ms, 3),
                "pauseThresholdMs": 250, "pauseCount": len(pauses),
                "totalPauseMs": sum(pause["durationMs"] for pause in pauses),
                "pauses": pauses, "learnerLevel": learner_level, "levelJudgement": None}


class ProsodyAnalyzer:
    def analyze(self, _audio: PreparedAudio) -> dict[str, Any]:
        return {"status": "NOT_IMPLEMENTED", "qualityScore": None, "confidence": None,
                "reason": "NO_VALIDATED_PROSODY_MODEL"}


class Calibrator:
    def apply(self, _result: dict[str, Any]) -> dict[str, Any]:
        return {"calibrationStatus": "UNCALIBRATED", "masteryEligible": False,
                "confidence": None, "overallAcousticScore": None,
                "accuracyScore": None, "completenessScore": None,
                "fluencyScore": None, "prosodyScore": None}


def tentative_descriptors(completeness: dict[str, Any], fluency: dict[str, Any],
                          learner_level: str | None) -> list[dict[str, Any]]:
    """Measured/ASR observations only. Never infer correctness or a grade."""
    result = [{"code": "POSSIBLE_OMITTED_WORD", "wordIndex": omission["expectedIndex"],
               "tentative": True} for omission in completeness.get("omissions", [])]
    if (completeness.get("status") == "EVIDENCE_AVAILABLE"
            and completeness.get("expectedCount", 0) > 0
            and completeness.get("matchedCount") == 0):
        result.append({"code": "POSSIBLE_PHRASE_MISMATCH", "tentative": True,
                       "qualityJudgement": None})
    for pause in fluency.get("pauses", []):
        if pause["durationMs"] > 1500:
            result.append({"code": "EXCESSIVE_INTERNAL_PAUSE", "startMs": pause["startMs"],
                "durationMs": pause["durationMs"], "thresholdMs": 1500,
                "learnerLevel": learner_level, "tentative": True, "qualityJudgement": None})
    return result


def empty_result(request: dict[str, Any] | None = None) -> dict[str, Any]:
    request = request or {}
    expected_text = request.get("expectedText")
    language = request.get("targetLanguage", request.get("language"))
    language = language if isinstance(language, str) and re.fullmatch(r"[A-Za-z-]{2,35}", language) else None
    locale = request.get("locale", "en-US" if language in ("en", "en-US") else None)
    locale = locale if isinstance(locale, str) and re.fullmatch(r"[A-Za-z-]{2,35}", locale) else None
    result = {"status": "NOT_EVALUABLE", "language": language, "locale": locale,
              "engineVersion": ENGINE_VERSION,
              "expectedText": expected_text if isinstance(expected_text, str) and len(expected_text) <= MAX_EXPECTED_CHARACTERS else None,
              "words": [], "phonemes": [], "errors": [], "evidence": {},
              "capability": "PRACTICE_ONLY"}
    result.update(Calibrator().apply(result))
    return result


class PhoneticEngine:
    def __init__(self, preprocessor: AudioPreprocessor | None = None):
        self.preprocessor = preprocessor or AudioPreprocessor(os.environ.get("PHONETIC_FFMPEG_EXECUTABLE"))

    @staticmethod
    def _profile(request: dict[str, Any]) -> dict[str, Any]:
        target = request.get("targetLanguage", request.get("language"))
        language = request.get("language", target)
        if not isinstance(target, str) or not isinstance(language, str):
            raise EvidenceError("LANGUAGE_OR_LOCALE_NOT_SUPPORTED")
        profile = MODEL_PROFILES.get(target)
        if profile is None or MODEL_PROFILES.get(language) is not profile:
            raise EvidenceError("LANGUAGE_OR_LOCALE_NOT_SUPPORTED")
        locale = request.get("locale", profile["modelLocale"])
        if not isinstance(locale, str) or profile["locales"].get(locale) != profile["modelLocale"]:
            raise EvidenceError("LANGUAGE_OR_LOCALE_NOT_SUPPORTED")
        return profile

    @staticmethod
    def _validate(request: dict[str, Any]) -> tuple[str, str | None]:
        PhoneticEngine._profile(request)
        text = request.get("expectedText")
        if not isinstance(text, str) or not text.strip() or len(text) > MAX_EXPECTED_CHARACTERS:
            raise EvidenceError("EXPECTED_TEXT_INVALID")
        if len(G2PAdapter.tokenize(text)) > MAX_EXPECTED_WORDS:
            raise EvidenceError("EXPECTED_TEXT_TOO_COMPLEX")
        for key in ("lessonId", "exerciseId", "learnerLevel"):
            value = request.get(key)
            if value is not None and (not isinstance(value, str) or len(value) > 200):
                raise EvidenceError("CONTEXT_INVALID")
        return text, request.get("learnerLevel")

    def evaluate(self, request: dict[str, Any]) -> dict[str, Any]:
        start = time.monotonic()
        cpu_start = time.process_time()
        result = empty_result(request)
        timings = result["evidence"].setdefault("timings", {})
        try:
            text, learner_level = self._validate(request)
            encoded = request.get("audioBase64")
            if not isinstance(encoded, str) or len(encoded) > MAX_REQUEST_BYTES:
                raise EvidenceError("AUDIO_BASE64_INVALID")
            try:
                audio_bytes = base64.b64decode(encoded, validate=True)
            except (ValueError, binascii.Error):
                raise EvidenceError("AUDIO_BASE64_INVALID") from None
            preprocessing_start = time.monotonic()
            try:
                audio = self.preprocessor.prepare(audio_bytes)
            finally:
                timings["preprocessingElapsedMs"] = round((time.monotonic() - preprocessing_start) * 1000, 3)
            result["evidence"]["audio"] = audio.evidence()
            # Imported only after the untrusted audio's bounded header checks.
            profile = self._profile(request)
            runtime_start = time.monotonic()
            Decoder, model_path, dictionary_path, language_model_path, fingerprints = load_local_runtime(profile)
            timings["runtimeReadinessElapsedMs"] = round((time.monotonic() - runtime_start) * 1000, 3)
            targets = G2PAdapter(Path(dictionary_path)).convert(text)
            result["language"], result["locale"] = profile["language"], profile["modelLocale"]
            result["evidence"]["model"] = {"locale": profile["modelLocale"], "g2pMethod": "CMUDICT_LEXICON_ONLY",
                "modelArtifactSha256": fingerprints.model_sha256,
                "lexiconSha256": fingerprints.lexicon_sha256,
                "oovPolicy": "NOT_EVALUABLE", "wordCount": len(targets),
                "ipaScope": "BROAD_US_ENGLISH_STRESSLESS", "stressEvaluated": False}
            # Independent completeness evidence survives a failed forced
            # alignment, which is common for genuinely shortened utterances.
            completeness_start = time.monotonic()
            result["evidence"]["completeness"] = CompletenessAnalyzer(
                Decoder, model_path, dictionary_path, language_model_path).analyze(
                    audio, [target["word"] for target in targets])
            timings["completenessElapsedMs"] = round((time.monotonic() - completeness_start) * 1000, 3)
            result["errors"].extend(tentative_descriptors(result["evidence"]["completeness"], {}, learner_level))
            align_start = time.monotonic()
            try:
                alignment = PhoneticAligner(Decoder, model_path, dictionary_path).align(audio, targets)
            finally:
                timings["alignmentElapsedMs"] = round((time.monotonic() - align_start) * 1000, 3)
            words, phonemes = AcousticPhonemeScorer().score(alignment)
            result["words"], result["phonemes"] = words, phonemes
            result["evidence"]["model"].update({"alignmentMethod": "TWO_PASS_HMM_FORCED_ALIGNMENT",
                "referenceOnly": True, "frameRate": 100,
                "rawScoreType": "HMM_ACOUSTIC_LOG_LIKELIHOOD_INTEGER",
                "observedPhonemesAvailable": False, "alternativePhonemesAvailable": False})
            result["evidence"]["alignmentQuality"] = {
                "status": "REFERENCE_ALIGNMENT_ONLY", "referenceFullyAligned": True,
                "confidence": None, "qualityScore": None,
                "referenceWordCount": len(targets), "alignedWordCount": len(words),
                "referencePhonemeCount": sum(len(target["arpabet"]) for target in targets),
                "alignedPhonemeCount": len(phonemes)}
            result["evidence"]["normalization"] = {"method": "RAW_LOG_SCORE_DIVIDED_BY_FRAME_COUNT",
                "crossPhonemeComparable": False, "percentage": False,
                "calibrated": False, "qualityJudgementAvailable": False}
            result["evidence"]["fluency"] = FluencyAnalyzer().analyze(words, audio, learner_level)
            result["evidence"]["prosody"] = ProsodyAnalyzer().analyze(audio)
            # Fixed descriptors point to measured but uncertain observations.
            # Secondary ASR is fallible; these never become scores or failures.
            result["errors"].extend(tentative_descriptors({}, result["evidence"]["fluency"], learner_level))
            result["status"] = "EVIDENCE_AVAILABLE"
            result["capability"] = "ACOUSTIC_UNCALIBRATED"
            result.update(Calibrator().apply(result))
        except EvidenceError as error:
            result["status"] = "TECHNICAL_ERROR" if error.technical else "NOT_EVALUABLE"
            result["capability"] = "PRACTICE_ONLY"
            result["errors"] = [{"code": error.code}] + result["errors"]
            # Never expose a partially usable phone/word score on failed analysis.
            result["words"], result["phonemes"] = [], []
        except Exception:
            # No exception details: native errors may contain transcripts or paths.
            result["status"] = "TECHNICAL_ERROR"
            result["capability"] = "PRACTICE_ONLY"
            result["errors"] = [{"code": "ACOUSTIC_ENGINE_INTERNAL_ERROR"}]
            result["words"], result["phonemes"] = [], []
        result["evidence"]["pronunciationDiagnostic"] = insufficient_pronunciation_diagnostic()
        result["evidence"].setdefault("timings", {})["totalElapsedMs"] = round((time.monotonic() - start) * 1000, 3)
        result["evidence"]["timings"]["cpuTimeMs"] = round((time.process_time() - cpu_start) * 1000, 3)
        return result


def apply_process_limits() -> dict[str, Any]:
    """Hard limits in the private POSIX child only, never in the API process."""
    if os.name != "posix":
        return {"platform": os.name, "cpuSeconds": None, "addressSpaceBytes": None,
                "hardMemoryLimitEnforced": False}
    try:
        import resource
        for kind, maximum in ((resource.RLIMIT_CPU, 25), (resource.RLIMIT_AS, 512 * 1024 * 1024)):
            soft, hard = resource.getrlimit(kind)
            limits = [maximum] + [value for value in (soft, hard) if value != resource.RLIM_INFINITY]
            limit = min(limits)
            resource.setrlimit(kind, (limit, limit))
        cpu_limit = resource.getrlimit(resource.RLIMIT_CPU)[0]
        memory_limit = resource.getrlimit(resource.RLIMIT_AS)[0]
        return {"platform": "posix", "cpuSeconds": cpu_limit,
                "addressSpaceBytes": memory_limit, "hardMemoryLimitEnforced": True}
    except (ImportError, AttributeError, OSError, ValueError):
        raise EvidenceError("PROCESS_LIMITS_UNAVAILABLE", technical=True) from None


def main() -> int:
    """One bounded request / response over private stdio; no long-running listener."""
    try:
        process_limits = apply_process_limits()
        raw = sys.stdin.buffer.read(MAX_REQUEST_BYTES + 1)
        if len(raw) > MAX_REQUEST_BYTES:
            raise EvidenceError("REQUEST_TOO_LARGE")
        try:
            request = json.loads(raw.decode("utf-8"))
        except (ValueError, UnicodeError, RecursionError):
            raise EvidenceError("REQUEST_INVALID") from None
        if not isinstance(request, dict):
            raise EvidenceError("REQUEST_INVALID")
        if request.get("operation") == "capabilities":
            result = capabilities()
        elif request.get("operation") is not None:
            raise EvidenceError("REQUEST_OPERATION_UNSUPPORTED")
        else:
            result = PhoneticEngine().evaluate(request)
        result.setdefault("evidence", {}).setdefault("timings", {})["processLimits"] = process_limits
    except EvidenceError as error:
        result = empty_result()
        result["status"] = "TECHNICAL_ERROR" if error.technical else "NOT_EVALUABLE"
        result["errors"] = [{"code": error.code}]
    encoded = json.dumps(result, ensure_ascii=False, allow_nan=False, separators=(",", ":")).encode("utf-8")
    if len(encoded) > MAX_OUTPUT_BYTES:
        result = empty_result()
        result["status"] = "TECHNICAL_ERROR"
        result["errors"] = [{"code": "RESULT_TOO_LARGE"}]
        encoded = json.dumps(result, separators=(",", ":")).encode("utf-8")
    sys.stdout.buffer.write(encoded + b"\n")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
