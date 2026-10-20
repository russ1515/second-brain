import array
import base64
import io
import json
import math
import os
from pathlib import Path
import struct
import subprocess
import sys
import tempfile
import unittest
import wave
from dataclasses import FrozenInstanceError
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from phonetic_engine import (AcousticPhonemeScorer, AudioPreprocessor, Calibrator,
                            CompletenessAnalyzer, EvidenceError, FluencyAnalyzer,
                            G2PAdapter, MAX_AUDIO_BYTES, MAX_AUDIO_SECONDS,
                            MAX_REQUEST_BYTES, Normalizer, PhoneticAligner,
                            PhoneticEngine, PreparedAudio, ProsodyAnalyzer,
                            empty_result, tentative_descriptors, artifact_fingerprints,
                            capabilities, insufficient_pronunciation_diagnostic,
                            load_local_runtime)


def pcm_wav(seconds=0.4, rate=16000, channels=1, width=2, silence=False):
    stream = io.BytesIO()
    with wave.open(stream, "wb") as writer:
        writer.setnchannels(channels)
        writer.setsampwidth(width)
        writer.setframerate(rate)
        samples = []
        for index in range(round(seconds * rate)):
            value = 0 if silence else int(8000 * math.sin(index * math.tau * 440 / rate))
            samples.extend([value] * channels)
        if width == 2:
            data = array.array("h", samples)
            if sys.byteorder != "little":
                data.byteswap()
            writer.writeframes(data.tobytes())
        elif width == 1:
            writer.writeframes(bytes((max(0, min(255, value // 256 + 128)) for value in samples)))
        else:
            writer.writeframes(b"".join(int(value << (8 * (width - 2))).to_bytes(width, "little", signed=True)
                                      for value in samples))
    return stream.getvalue()


class AudioTests(unittest.TestCase):
    def test_pcm_mono_is_real_bounded_audio(self):
        prepared = AudioPreprocessor().prepare(pcm_wav())
        self.assertEqual(len(prepared.pcm16), 12800)
        self.assertEqual(prepared.duration_ms, 400)
        self.assertEqual(prepared.evidence()["sampleRate"], 16000)
        self.assertGreater(prepared.peak, 0.2)

    def test_stereo_and_resampling(self):
        prepared = AudioPreprocessor().prepare(pcm_wav(rate=48000, channels=2))
        self.assertEqual(prepared.source_channels, 2)
        self.assertEqual(prepared.source_sample_rate, 48000)
        self.assertEqual(len(prepared.pcm16), 12800)

    def test_integer_widths(self):
        for width in (1, 2, 3, 4):
            with self.subTest(width=width):
                self.assertEqual(len(AudioPreprocessor().prepare(pcm_wav(width=width)).pcm16), 12800)

    def test_silence_is_not_evaluable(self):
        with self.assertRaisesRegex(EvidenceError, "AUDIO_SILENT"):
            AudioPreprocessor().prepare(pcm_wav(silence=True))

    def test_corrupt_and_truncated(self):
        with self.assertRaisesRegex(EvidenceError, "AUDIO_CORRUPT"):
            AudioPreprocessor().prepare(pcm_wav()[:-7])
        with self.assertRaisesRegex(EvidenceError, "UNSUPPORTED_AUDIO_FORMAT"):
            AudioPreprocessor().prepare(b"not audio")

    def test_duration_guard_checks_header_before_read(self):
        data = bytearray(pcm_wav())
        struct.pack_into("<I", data, 40, int((MAX_AUDIO_SECONDS + 1) * 16000 * 2))
        with self.assertRaisesRegex(EvidenceError, "AUDIO_TOO_LONG"):
            AudioPreprocessor().prepare(bytes(data))

    def test_size_and_short_guard(self):
        with self.assertRaisesRegex(EvidenceError, "AUDIO_SIZE_INVALID"):
            AudioPreprocessor().prepare(b"a" * (MAX_AUDIO_BYTES + 1))
        with self.assertRaisesRegex(EvidenceError, "AUDIO_TOO_SHORT"):
            AudioPreprocessor().prepare(pcm_wav(seconds=0.05))

    def test_converter_not_implicitly_located(self):
        with self.assertRaisesRegex(EvidenceError, "AUDIO_CONVERTER_CONFIGURATION_INVALID"):
            AudioPreprocessor("ffmpeg").prepare(b"compressed recording")


class G2PTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.dictionary = Path(self.directory.name) / "cmu-test.dict"
        self.dictionary.write_text("hello HH AH L OW\nworld W ER L D\nhello(2) HH EH L OW\n", encoding="utf-8")
        self.adapter = G2PAdapter(self.dictionary)

    def tearDown(self):
        self.directory.cleanup()

    def test_real_lexicon_not_letter_mapping(self):
        result = self.adapter.convert("Hello, world!")
        self.assertEqual(result[0]["arpabet"], ["HH", "AH", "L", "OW"])
        self.assertEqual(result[0]["ipa"], ["h", "ʌ", "l", "oʊ"])
        self.assertEqual(result[1]["word"], "world")

    def test_oov_and_digits_not_guessed(self):
        for text in ("inventednonsensetoken", "hello 123"):
            with self.subTest(text=text):
                with self.assertRaisesRegex(EvidenceError, "EXPECTED_WORD_OUT_OF_VOCABULARY"):
                    self.adapter.convert(text)

    def test_missing_lexicon_is_technical_error(self):
        with self.assertRaisesRegex(EvidenceError, "LEXICON_UNAVAILABLE"):
            G2PAdapter(Path(self.directory.name) / "absent").convert("hello")

    def test_model_and_lexicon_fingerprints_are_cached_immutable_sha256(self):
        model = Path(self.directory.name) / "model"
        model.mkdir()
        (model / "mdef").write_bytes(b"technical test model definition")
        (model / "means").write_bytes(b"technical test acoustic values")
        fingerprints = artifact_fingerprints(str(model), str(self.dictionary))
        self.assertRegex(fingerprints.model_sha256, r"^[a-f0-9]{64}$")
        self.assertRegex(fingerprints.lexicon_sha256, r"^[a-f0-9]{64}$")
        self.assertIs(fingerprints, artifact_fingerprints(str(model), str(self.dictionary)))
        self.assertEqual([row[0] for row in fingerprints.manifest], ["mdef", "means"])
        with self.assertRaises(FrozenInstanceError):
            fingerprints.model_sha256 = "changed"

    def test_missing_model_does_not_gain_an_identity(self):
        with self.assertRaisesRegex(EvidenceError, "MODEL_ARTIFACT_UNAVAILABLE"):
            artifact_fingerprints(self.directory.name, str(self.dictionary))


class Entry:
    def __init__(self, name, start, duration, score, children=()):
        self.name, self.start, self.duration, self.score = name, start, duration, score
        self.children = children

    def __iter__(self):
        return iter(self.children)


class FakeDecoder:
    instances = []

    def __init__(self, **config):
        self.events = []
        self.config = config
        self.instances.append(self)

    def set_align_text(self, text):
        self.events.append("set_align_text")

    def start_utt(self):
        self.events.append("start")

    def process_raw(self, audio, full_utt):
        self.events.append("process")

    def end_utt(self):
        self.events.append("end")

    def set_alignment(self):
        self.events.append("set_alignment")

    def get_alignment(self):
        return [Entry("hello", 0, 35, -900,
                      [Entry("HH", 0, 10, -200), Entry("AH", 10, 10, -300),
                       Entry("L", 20, 5, -100), Entry("OW", 25, 10, -300)])]


class AcousticTests(unittest.TestCase):
    def test_raw_alignment_never_becomes_a_weak_phoneme_claim(self):
        diagnostic = insufficient_pronunciation_diagnostic()
        self.assertEqual(diagnostic["status"], "INSUFFICIENT_ACOUSTIC_CONFIDENCE")
        self.assertEqual(diagnostic["weakEvidenceCount"], 0)
        self.assertEqual(diagnostic["weakWords"], [])
        self.assertEqual(diagnostic["weakPhonemes"], [])
        self.assertEqual(diagnostic["highConfidenceIssues"], [])
        self.assertIsNone(diagnostic["confidence"])
        self.assertFalse(diagnostic["wordQualityJudgementAvailable"])
        self.assertFalse(diagnostic["phonemeQualityJudgementAvailable"])

    def test_two_pass_protocol_and_raw_scores(self):
        audio = AudioPreprocessor().prepare(pcm_wav())
        alignment = PhoneticAligner(FakeDecoder, "model", "dict").align(audio, [{"word": "hello"}])
        self.assertEqual(FakeDecoder.instances[-1].events,
                         ["set_align_text", "start", "process", "end", "set_alignment", "start", "process", "end"])
        words, phones = AcousticPhonemeScorer().score(alignment)
        self.assertEqual(phones[0]["expectedPhoneme"], "h")
        self.assertEqual(phones[0]["rawAcousticScore"], -200)
        self.assertEqual(phones[0]["rawAcousticScorePerFrame"], -20)
        self.assertIsNone(phones[0]["observed"])
        self.assertIsNone(phones[0]["bestAlternative"])
        self.assertIsNone(phones[0]["confidence"])
        self.assertEqual(words[0]["phonemeIndexes"], [0, 1, 2, 3])

    def test_invalid_duration_never_becomes_score(self):
        with self.assertRaisesRegex(EvidenceError, "ALIGNMENT_SCORE_INVALID"):
            Normalizer.per_frame(-200, 0)

    def test_calibrator_does_not_fabricate_certification(self):
        result = Calibrator().apply({"rawAcousticScore": -5})
        self.assertEqual(result["calibrationStatus"], "UNCALIBRATED")
        self.assertFalse(result["masteryEligible"])
        self.assertTrue(all(result[key] is None for key in
                            ("confidence", "overallAcousticScore", "accuracyScore",
                             "completenessScore", "fluencyScore", "prosodyScore")))

    def test_incorrect_reference_shape_rejected(self):
        with self.assertRaisesRegex(EvidenceError, "ALIGNMENT_TARGET_MISMATCH"):
            PhoneticAligner(FakeDecoder, "model", "dict").align(
                AudioPreprocessor().prepare(pcm_wav()), [{"word": "different"}])

    def test_word_edit_alignment_and_no_grade(self):
        result = CompletenessAnalyzer.compare(["one", "two", "three"], ["one", "four"])
        self.assertEqual(result["matchedCount"], 1)
        self.assertEqual(len(result["omissions"]), 1)
        self.assertEqual(len(result["substitutions"]), 1)
        self.assertTrue(result["tentative"])
        self.assertIsNone(result["qualityScore"])
        inserted = CompletenessAnalyzer.compare(["one"], ["one", "two"])
        self.assertEqual(inserted["insertions"][0]["observedWord"], "two")

    def test_fluency_is_timing_not_grade(self):
        result = FluencyAnalyzer().analyze([
            {"startMs": 0, "endMs": 500}, {"startMs": 900, "endMs": 1400}],
            AudioPreprocessor().prepare(pcm_wav(seconds=1.5)), "A1")
        self.assertEqual(result["pauseCount"], 1)
        self.assertEqual(result["totalPauseMs"], 400)
        self.assertEqual(result["learnerLevel"], "A1")
        self.assertIsNone(result["qualityScore"])
        self.assertIsNone(result["levelJudgement"])

    def test_prosody_explicitly_missing(self):
        result = ProsodyAnalyzer().analyze(AudioPreprocessor().prepare(pcm_wav()))
        self.assertEqual(result["status"], "NOT_IMPLEMENTED")
        self.assertIsNone(result["qualityScore"])

    def test_descriptors_remain_tentative_without_quality_or_level_grade(self):
        result = tentative_descriptors({"omissions": [{"expectedIndex": 2}]},
            {"pauses": [{"startMs": 500, "durationMs": 1700},
                        {"startMs": 3000, "durationMs": 1500}]}, "A1")
        self.assertEqual(len(result), 2)
        self.assertEqual(result[0], {"code": "POSSIBLE_OMITTED_WORD", "wordIndex": 2, "tentative": True})
        self.assertEqual(result[1]["code"], "EXCESSIVE_INTERNAL_PAUSE")
        self.assertIsNone(result[1]["qualityJudgement"])

    def test_total_phrase_mismatch_is_not_a_pronunciation_grade(self):
        result = tentative_descriptors({"status": "EVIDENCE_AVAILABLE", "expectedCount": 4,
                                       "matchedCount": 0}, {}, "A1")
        self.assertEqual(result, [{"code": "POSSIBLE_PHRASE_MISMATCH", "tentative": True,
                                   "qualityJudgement": None}])
        self.assertEqual(tentative_descriptors({"status": "NOT_EVALUABLE"}, {}, None), [])


class ContractTests(unittest.TestCase):
    def test_readiness_failure_does_not_claim_an_available_engine(self):
        with patch("phonetic_engine.load_local_runtime", side_effect=EvidenceError(
                "MODEL_ARTIFACT_INTEGRITY_FAILED", technical=True)):
            result = capabilities()
        self.assertFalse(result["available"])
        self.assertEqual(result["capability"], "PRACTICE_ONLY")
        self.assertEqual(result["errors"], [{"code": "MODEL_ARTIFACT_INTEGRITY_FAILED"}])
        self.assertEqual(result["supportedFormats"], [])
        self.assertFalse(result["masteryEligible"])

    def test_readiness_uses_only_explicit_existing_converter(self):
        from phonetic_engine import ArtifactFingerprints, EXPECTED_MODEL_SHA256, EXPECTED_LEXICON_SHA256
        fingerprints = ArtifactFingerprints(EXPECTED_MODEL_SHA256, EXPECTED_LEXICON_SHA256, ())
        with patch("phonetic_engine.load_local_runtime", return_value=(None, "model", "dict", "lm", fingerprints)):
            with patch.dict(os.environ, {"PHONETIC_FFMPEG_EXECUTABLE": "ffmpeg"}):
                result = capabilities()
        self.assertTrue(result["available"])
        self.assertEqual(result["supportedFormats"], ["audio/wav", "audio/x-wav"])
        self.assertEqual(result["diagnosticStatus"], "INSUFFICIENT_ACOUSTIC_CONFIDENCE")
        self.assertEqual(result["maxAudioSeconds"], 30)
        self.assertEqual(result["modelArtifactSha256"], EXPECTED_MODEL_SHA256)

    def test_preprocessing_failure_still_has_stage_timing_and_safe_diagnostic(self):
        result = PhoneticEngine().evaluate({"language": "en", "expectedText": "Hello",
            "audioBase64": base64.b64encode(pcm_wav(silence=True)).decode("ascii")})
        self.assertEqual(result["status"], "NOT_EVALUABLE")
        self.assertGreaterEqual(result["evidence"]["timings"]["preprocessingElapsedMs"], 0)
        self.assertEqual(result["evidence"]["pronunciationDiagnostic"]["status"],
                         "INSUFFICIENT_ACOUSTIC_CONFIDENCE")

    def test_unknown_cli_operation_is_not_an_evaluation(self):
        completed = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] / "phonetic_engine.py")],
            input=b'{"operation":"unknown"}', capture_output=True, check=True)
        self.assertEqual(json.loads(completed.stdout)["errors"], [{"code": "REQUEST_OPERATION_UNSUPPORTED"}])
        self.assertEqual(completed.stderr, b"")

    def test_generic_english_locale_is_explicit_model_alias(self):
        self.assertEqual(PhoneticEngine._validate({"language": "en", "locale": "en",
                                                  "expectedText": "Hello"}), ("Hello", None))

    def test_other_language_and_en_gb_not_silently_english_us(self):
        for target in ("fr", "ln", "en-GB", "ja"):
            result = PhoneticEngine().evaluate({"language": target, "expectedText": "Hello"})
            self.assertEqual(result["status"], "NOT_EVALUABLE")
            self.assertEqual(result["errors"][0]["code"], "LANGUAGE_OR_LOCALE_NOT_SUPPORTED")
            self.assertFalse(result["masteryEligible"])
            self.assertEqual(result["capability"], "PRACTICE_ONLY")
            self.assertEqual(result["language"], target)

    def test_bad_audio_before_model_loading(self):
        result = PhoneticEngine().evaluate({"language": "en", "expectedText": "Hello",
                                           "audioBase64": "not-base64"})
        self.assertEqual(result["status"], "NOT_EVALUABLE")
        self.assertEqual(result["errors"][0]["code"], "AUDIO_BASE64_INVALID")

    def test_empty_and_oversized_text(self):
        for text in ("", "a" * 2001, "a " * 81):
            result = PhoneticEngine().evaluate({"language": "en", "expectedText": text})
            self.assertEqual(result["status"], "NOT_EVALUABLE")

    def test_cli_malformed_has_only_safe_code(self):
        completed = subprocess.run([sys.executable, str(Path(__file__).resolve().parents[1] / "phonetic_engine.py")],
                                   input=b"not-json-sensitive", capture_output=True, check=True)
        result = json.loads(completed.stdout)
        self.assertEqual(result["errors"], [{"code": "REQUEST_INVALID"}])
        self.assertEqual(completed.stderr, b"")
        self.assertNotIn(b"not-json-sensitive", completed.stdout)

    def test_empty_contract_never_passes_mastery(self):
        result = empty_result()
        self.assertFalse(result["masteryEligible"])
        self.assertEqual(result["words"], [])
        self.assertIsNone(result["accuracyScore"])


@unittest.skipUnless(os.environ.get("PHONETIC_TEST_WAV_PATH") and os.environ.get("PHONETIC_TEST_EXPECTED_TEXT"),
                     "Authorized technical speech fixture not supplied")
class RealModelTests(unittest.TestCase):
    def test_real_acoustic_alignment_still_not_certification(self):
        data = Path(os.environ["PHONETIC_TEST_WAV_PATH"]).read_bytes()
        result = PhoneticEngine().evaluate({
            "language": "en", "locale": "en-US",
            "expectedText": os.environ["PHONETIC_TEST_EXPECTED_TEXT"],
            "audioBase64": base64.b64encode(data).decode("ascii"),
        })
        self.assertEqual(result["status"], "EVIDENCE_AVAILABLE", result["errors"])
        self.assertTrue(result["words"])
        self.assertTrue(result["phonemes"])
        self.assertFalse(result["masteryEligible"])
        self.assertEqual(result["calibrationStatus"], "UNCALIBRATED")
        self.assertRegex(result["evidence"]["model"]["modelArtifactSha256"], r"^[a-f0-9]{64}$")
        self.assertRegex(result["evidence"]["model"]["lexiconSha256"], r"^[a-f0-9]{64}$")
        self.assertTrue(all(phone["observed"] is None and phone["confidence"] is None
                            for phone in result["phonemes"]))


if __name__ == "__main__":
    unittest.main()
