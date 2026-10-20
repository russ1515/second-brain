"""Opt-in offline browser-container normalization, not a real microphone test.

Use an explicitly approved local FFmpeg binary and authorized technical WAV.
Compressed containers are generated in memory and never saved as recordings.
The runtime dependency policy remains unchanged: no install, PATH lookup, or
network access in the engine. The local FFmpeg licence must be audited before
any binary redistribution; this test does not bundle or deploy the executable.
"""

import array
import base64
import io
import math
import os
from pathlib import Path
import subprocess
import sys
import unittest
import wave
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from phonetic_engine import AudioPreprocessor, EvidenceError, PhoneticEngine, capabilities

FFMPEG_PATH = os.environ.get("PHONETIC_TEST_FFMPEG_PATH")
WAV_PATH = os.environ.get("PHONETIC_TEST_WAV_PATH")


def synthetic_tone(seconds):
    output = io.BytesIO()
    samples = array.array("h", (round(6000 * math.sin(index * 2 * math.pi * 220 / 16000))
                                for index in range(round(seconds * 16000))))
    if sys.byteorder != "little":
        samples.byteswap()
    with wave.open(output, "wb") as writer:
        writer.setnchannels(1)
        writer.setsampwidth(2)
        writer.setframerate(16000)
        writer.writeframes(samples.tobytes())
    return output.getvalue()


def encode_in_memory(binary, container):
    command = [FFMPEG_PATH, "-nostdin", "-hide_banner", "-loglevel", "error",
               "-protocol_whitelist", "pipe", "-i", "pipe:0", "-vn"]
    if container in ("webm", "ogg"):
        command += ["-c:a", "libopus"]
    elif container == "mp4":
        command += ["-c:a", "aac", "-movflags", "frag_keyframe+empty_moov+default_base_moof"]
    else:
        raise ValueError("Unsupported technical fixture container")
    command += ["-f", container, "pipe:1"]
    completed = subprocess.run(command, input=binary, stdout=subprocess.PIPE,
                               stderr=subprocess.PIPE, timeout=20, check=True, shell=False)
    if not completed.stdout:
        raise AssertionError("Fixture encoder produced no bytes")
    return completed.stdout


@unittest.skipUnless(FFMPEG_PATH and WAV_PATH,
                     "Explicit approved FFmpeg and authorized technical WAV not supplied")
class BrowserContainerTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        if not Path(FFMPEG_PATH).is_absolute() or not Path(FFMPEG_PATH).is_file():
            raise AssertionError("Explicit local absolute FFmpeg path required")
        cls.wav = Path(WAV_PATH).read_bytes()
        cls.compressed = {name: encode_in_memory(cls.wav, name) for name in ("webm", "ogg", "mp4")}

    def require_native_test_environment(self):
        # A separately approved converter context may not be allowed to read the
        # isolated native dependency directory. That is an explicit integration
        # prerequisite, not a successful model test. Do not change ACLs or copy
        # native dependencies to evade it. Once import works, version/fingerprint,
        # readiness or assessment defects must fail normally, never be skipped.
        try:
            from pocketsphinx import Decoder
        except (ImportError, PermissionError):
            self.skipTest("BLOCKED_ENVIRONMENT: converter context cannot import the isolated native dependency")

    def test_webm_opus_normalizes_with_existing_preprocessor(self):
        result = AudioPreprocessor(FFMPEG_PATH).prepare(self.compressed["webm"])
        self.assertEqual(result.conversion, "CONFIGURED_FFMPEG_PCM16")
        self.assertEqual(result.evidence()["sampleRate"], 16000)
        self.assertEqual(result.evidence()["channels"], 1)
        self.assertGreater(result.duration_ms, 150)
        self.assertEqual(len(result.pcm16) % 2, 0)

    def test_ogg_opus_normalizes_with_existing_preprocessor(self):
        result = AudioPreprocessor(FFMPEG_PATH).prepare(self.compressed["ogg"])
        self.assertEqual(result.conversion, "CONFIGURED_FFMPEG_PCM16")
        self.assertGreater(result.duration_ms, 150)
        self.assertEqual(len(result.pcm16) % 2, 0)

    def test_fragmented_mp4_aac_normalizes_with_existing_preprocessor(self):
        result = AudioPreprocessor(FFMPEG_PATH).prepare(self.compressed["mp4"])
        self.assertEqual(result.conversion, "CONFIGURED_FFMPEG_PCM16")
        self.assertGreater(result.duration_ms, 150)
        self.assertEqual(len(result.pcm16) % 2, 0)

    def test_compressed_audio_not_supported_without_explicit_converter(self):
        with self.assertRaisesRegex(EvidenceError, "UNSUPPORTED_AUDIO_FORMAT"):
            AudioPreprocessor().prepare(self.compressed["webm"])

    def test_corrupt_container_is_not_silently_accepted(self):
        with self.assertRaisesRegex(EvidenceError, "AUDIO_CONVERSION_FAILED"):
            AudioPreprocessor(FFMPEG_PATH).prepare(b"\x1a\x45\xdf\xa3corrupt-technical-webm")

    def test_compressed_too_short_rejected(self):
        with self.assertRaisesRegex(EvidenceError, "AUDIO_TOO_SHORT"):
            AudioPreprocessor(FFMPEG_PATH).prepare(encode_in_memory(synthetic_tone(0.05), "webm"))

    def test_compressed_too_long_rejected_not_silently_truncated(self):
        with self.assertRaisesRegex(EvidenceError, "AUDIO_TOO_LONG"):
            AudioPreprocessor(FFMPEG_PATH).prepare(encode_in_memory(synthetic_tone(31), "webm"))

    def test_converter_timeout_returns_safe_code(self):
        with patch("phonetic_engine.subprocess.run", side_effect=subprocess.TimeoutExpired("private-converter", 20)):
            with self.assertRaisesRegex(EvidenceError, "AUDIO_CONVERSION_FAILED"):
                AudioPreprocessor(FFMPEG_PATH).prepare(self.compressed["webm"])

    def test_capabilities_only_advertises_configured_container_support(self):
        self.require_native_test_environment()
        with patch.dict(os.environ, {"PHONETIC_FFMPEG_EXECUTABLE": FFMPEG_PATH}):
            result = capabilities()
        self.assertTrue(result["available"])
        self.assertIn("audio/webm", result["supportedFormats"])
        self.assertIn("audio/ogg", result["supportedFormats"])
        self.assertIn("audio/mp4", result["supportedFormats"])
        self.assertFalse(result["masteryEligible"])

    @unittest.skipUnless(os.environ.get("PHONETIC_TEST_RUN_COMPRESSED_ALIGNMENT") == "1",
                         "Optional one real compressed-fixture alignment not enabled")
    def test_one_real_webm_acoustic_alignment_is_still_uncalibrated(self):
        self.require_native_test_environment()
        result = PhoneticEngine(AudioPreprocessor(FFMPEG_PATH)).evaluate({
            "targetLanguage": "en", "expectedText": os.environ["PHONETIC_TEST_EXPECTED_TEXT"],
            "audioBase64": base64.b64encode(self.compressed["webm"]).decode("ascii")})
        self.assertEqual(result["status"], "EVIDENCE_AVAILABLE", result["errors"])
        self.assertTrue(result["phonemes"])
        self.assertEqual(result["evidence"]["audio"]["conversion"], "CONFIGURED_FFMPEG_PCM16")
        self.assertEqual(result["evidence"]["pronunciationDiagnostic"]["status"],
                         "INSUFFICIENT_ACOUSTIC_CONFIDENCE")
        self.assertFalse(result["masteryEligible"])
        self.assertIsNone(result["accuracyScore"])


if __name__ == "__main__":
    unittest.main()
