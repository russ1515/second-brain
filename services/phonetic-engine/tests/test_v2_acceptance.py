"""Tests for the V2 test harness: no model, provider or audio generation."""

import hashlib
import json
from pathlib import Path
import tempfile
import unittest
import wave

from run_v2_acceptance import (comparison_report, evaluate_case, execute_runtime,
                               fixture_inventory, summary, write_json_exclusive)


class InventoryTests(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.root = Path(self.directory.name)
        self.baseline = self.root / "baseline.json"
        self.addCleanup(self.directory.cleanup)

    def make_case(self, case_id, category="REFERENCE", manipulation=None):
        target = self.root / (case_id + ".wav")
        with wave.open(str(target), "wb") as audio:
            audio.setnchannels(1)
            audio.setsampwidth(2)
            audio.setframerate(16000)
            audio.writeframes(b"\0\0" * 1600)
        return {"id": case_id, "category": category, "expectedText": "Technical target",
                "syntheticText": "Technical target", "expectedManipulatedRegion": manipulation,
                "fixtureSha256": hashlib.sha256(target.read_bytes()).hexdigest(),
                "result": {"masteryEligible": False, "calibrationStatus": "UNCALIBRATED", "confidence": None,
                           "phonemes": [{"index": 0, "wordIndex": 0, "expectedArpabet": "TH",
                                         "expectedPhoneme": "θ"},
                                        {"index": 1, "wordIndex": 0, "expectedArpabet": "T",
                                         "expectedPhoneme": "t"}]}}

    def store(self, rows):
        self.baseline.write_text(json.dumps({"cases": rows}), encoding="utf-8")

    def test_inventory_does_not_require_or_import_a_model(self):
        row = self.make_case("reference")
        self.store([row])
        result = fixture_inventory(self.baseline, self.root)
        self.assertEqual(result["caseCount"], 1)
        self.assertEqual(result["referenceCount"], 1)
        self.assertEqual(result["cases"][0]["fixtureSha256"], row["fixtureSha256"])
        self.assertEqual(result["cases"][0]["audio"]["durationMs"], 100)
        self.assertFalse(result["masteryEligible"])

    def test_changed_audio_is_rejected_not_rebaselined(self):
        row = self.make_case("reference")
        self.store([row])
        (self.root / "reference.wav").write_bytes(b"different audio")
        with self.assertRaisesRegex(ValueError, "CONTROLLED_FIXTURE_HASH_MISMATCH"):
            fixture_inventory(self.baseline, self.root)

    def test_primary_and_secondary_manipulations_remain_explicit(self):
        row = self.make_case("altered", "ALTERED_WORD_PHONEMES", {
            "wordIndex": 0, "expectedArpabet": "TH", "intentionalAlternative": "S",
            "alsoFinal": "T_TO_S", "syntheticLexicalRenderingUnverified": True})
        self.store([row])
        case = fixture_inventory(self.baseline, self.root)["cases"][0]
        self.assertEqual([region["expectedPhoneIndex"] for region in case["goldRegions"]], [0, 1])
        self.assertIn("MULTIPLE_PHONEME_AND_LEXICAL_CHANGES_NOT_ISOLATED", case["caveats"])
        self.assertIn("INTENDED_SUBSTITUTION_NOT_INDEPENDENTLY_LISTENED", case["caveats"])

    def test_missing_or_ambiguous_gold_phone_cannot_be_silently_dropped(self):
        row = self.make_case("altered", "ALTERED_PHONEME", {"wordIndex": 0, "expectedArpabet": "UNKNOWN"})
        self.store([row])
        with self.assertRaisesRegex(ValueError, "CONTROLLED_PRIMARY_PHONE_NOT_UNIQUE"):
            fixture_inventory(self.baseline, self.root)

    def test_non_aligned_cases_reuse_expected_sequence_not_manipulated_audio_decoding(self):
        reference = self.make_case("reference")
        partial = self.make_case("partial", "PARTIAL_PHRASE", {"omittedWordIndexes": [1]})
        partial["result"]["phonemes"] = []
        self.store([reference, partial])
        case = fixture_inventory(self.baseline, self.root)["cases"][1]
        self.assertEqual(case["expectedSequenceSourceCase"], "reference")
        self.assertEqual(len(case["expectedSequence"]), 2)

    def test_frozen_files_are_not_silently_overwritten(self):
        target = self.root / "inventory.json"
        write_json_exclusive(target, {"first": True})
        with self.assertRaises(FileExistsError):
            write_json_exclusive(target, {"first": False})
        self.assertEqual(json.loads(target.read_text()), {"first": True})

    def test_min_median_max_has_sample_count_and_no_fake_p95(self):
        self.assertEqual(summary([5, 1, 9]), {"sampleCount": 3, "min": 1, "medianObserved": 5, "max": 9})
        self.assertIsNone(summary([]))

    def result(self, *, candidates=None, confirmed=None, word_index=0, raw_score=-100):
        return {"calibrationStatus": "UNCALIBRATED", "masteryEligible": False, "confidence": None,
                "diagnosticStatus": "INSUFFICIENT_ACOUSTIC_CONFIDENCE",
                "phonemes": [{"index": 0, "wordIndex": word_index, "expectedPhoneme": "θ",
                              "canonicalId": "cmu:TH", "rawScore": raw_score, "marginToAlternative": -2,
                              "confidence": None, "observedPhoneme": None}],
                "weakRegionCandidates": candidates or [], "confirmedWeakPhonemes": confirmed or []}

    def altered_case(self):
        row = self.make_case("altered", "ALTERED_PHONEME", {"wordIndex": 0, "expectedArpabet": "TH", "intentionalAlternative": "S"})
        self.store([row])
        return fixture_inventory(self.baseline, self.root)["cases"][0]

    def test_raw_negative_score_is_not_automatically_a_localized_error(self):
        case = self.altered_case()
        result = evaluate_case(case, self.result(raw_score=-999999))
        self.assertEqual(result["primaryCandidateLocalization"], "NO")
        self.assertEqual(result["primaryReliableLocalization"], "NO")
        self.assertTrue(result["diagnosticAbstention"])

    def test_candidate_hit_is_reported_separately_from_reliable_diagnosis(self):
        result = evaluate_case(self.altered_case(), self.result(candidates=[0]))
        self.assertEqual(result["primaryCandidateLocalization"], "YES")
        self.assertEqual(result["primaryReliableLocalization"], "NO")
        self.assertIsNone(result["candidateRegions"][0]["confidence"])

    def test_actual_scorer_candidate_objects_use_their_declared_phoneme_index(self):
        result = self.result(candidates=[{"phonemeIndex": 0, "wordIndex": 0,
                                         "canonicalId": "cmu:TH", "confidence": None}])
        observed = evaluate_case(self.altered_case(), result)
        self.assertEqual(observed["primaryCandidateLocalization"], "YES")
        self.assertEqual(observed["primaryReliableLocalization"], "NO")
        result["weakRegionCandidates"][0]["wordIndex"] = 8
        with self.assertRaisesRegex(ValueError, "V2_DIAGNOSTIC_WORD_INDEX_INCONSISTENT"):
            evaluate_case(self.altered_case(), result)

    def test_correct_phone_index_in_wrong_word_does_not_count(self):
        result = evaluate_case(self.altered_case(), self.result(candidates=[0], word_index=5))
        self.assertEqual(result["primaryCandidateLocalization"], "NO")
        self.assertEqual(len(result["unrelatedCandidateRegions"]), 1)

    def test_all_candidate_warnings_on_clean_reference_count_even_with_null_confidence(self):
        self.store([self.make_case("reference")])
        case = fixture_inventory(self.baseline, self.root)["cases"][0]
        result = evaluate_case(case, self.result(candidates=[0]))
        self.assertEqual(result["cleanReferenceCandidateFalsePositives"], 1)
        self.assertEqual(result["cleanReferenceConfirmedFalsePositives"], 0)
        self.assertTrue(result["diagnosticAbstention"])

    def test_filtered_unknown_alternative_does_not_hide_raw_reference_noise(self):
        self.store([self.make_case("reference")])
        case = fixture_inventory(self.baseline, self.root)["cases"][0]
        observation = self.result()
        observation["phonemes"][0]["rawWeakRegionCandidate"] = True
        observation["phonemes"][0]["abstentionReason"] = "UNKNOWN_ALTERNATIVE"
        observed = evaluate_case(case, observation)
        self.assertEqual(observed["cleanReferenceCandidateFalsePositives"], 0)
        self.assertEqual(observed["cleanReferenceRawCandidateFalsePositives"], 1)
        self.assertEqual(observed["phonemeAbstentionCount"], 1)
        self.assertEqual(observed["phonemeAbstentionReasons"], {"UNKNOWN_ALTERNATIVE": 1})

    def test_word_only_warning_cannot_be_upgraded_to_phone_localization(self):
        with self.assertRaisesRegex(ValueError, "V2_DIAGNOSTIC_REGION_INDEX_INVALID"):
            evaluate_case(self.altered_case(), self.result(candidates=[{"wordIndex": 0}]))

    def test_mastery_or_calibration_boundary_is_never_relaxed_by_the_harness(self):
        result = self.result()
        result["masteryEligible"] = True
        with self.assertRaisesRegex(ValueError, "V2_UNCALIBRATED_BOUNDARY_VIOLATED"):
            evaluate_case(self.altered_case(), result)

    def test_comparison_rejects_a_different_audio_hash_and_missing_cases_remain_not_run(self):
        row = self.make_case("reference")
        self.store([row])
        inventory = fixture_inventory(self.baseline, self.root)
        baseline = json.loads(self.baseline.read_text())
        report = comparison_report(inventory, baseline, [])
        self.assertEqual(report["cases"][0]["state"], "NOT_RUN")
        with self.assertRaisesRegex(ValueError, "V2_MEASUREMENT_FIXTURE_HASH_MISMATCH"):
            comparison_report(inventory, baseline, [{"id": row["id"], "fixtureSha256": "0" * 64,
                                                    "result": self.result()}])

    def test_fake_runtime_protocol_loads_once_and_never_receives_gold_or_spoken_text(self):
        row = self.make_case("reference")
        row["result"]["evidence"] = {"completeness": {"method": "HISTORICAL_ASR", "omissions": []},
                                      "fluency": {"pauseCount": 0}}
        self.store([row])
        inventory = fixture_inventory(self.baseline, self.root)
        baseline = json.loads(self.baseline.read_text())
        expected_result = self.result()
        calls = []

        class FakeRuntime:
            def load(self):
                calls.append("load")
                return {"fixtureOnly": True}

            def assess(self, audio, expected_text, **kwargs):
                calls.append((audio, expected_text, kwargs))
                return expected_result

        output = self.root / "mock-protocol-report.json"
        report = execute_runtime(inventory, baseline, FakeRuntime(), output)
        self.assertEqual(calls[0], "load")
        self.assertEqual(len(calls), 2)
        self.assertEqual(calls[1][1], "Technical target")
        self.assertEqual(set(calls[1][2]), {"locale", "baseline_completeness", "baseline_fluency"})
        self.assertEqual(calls[1][2]["baseline_completeness"]["method"], "HISTORICAL_ASR")
        self.assertTrue(report["cases"][0]["preservedObservations"]["notNewScorerProof"])
        self.assertEqual(report["v2"]["measuredCases"], 1)
        with self.assertRaises(FileExistsError):
            execute_runtime(inventory, baseline, FakeRuntime(), output)
        self.assertEqual(len(calls), 2)

    def test_memory_guard_load_failure_is_persisted_without_retry_or_fixture_inference(self):
        self.store([self.make_case("reference")])
        inventory = fixture_inventory(self.baseline, self.root)
        baseline = json.loads(self.baseline.read_text())
        calls = []

        class BlockedRuntime:
            def load(self):
                calls.append("load")
                raise RuntimeError("BLOCKED_LOCAL_MEMORY")

            def assess(self, *args, **kwargs):
                raise AssertionError("must not infer after load failure")

        output = self.root / "mock-memory-block.json"
        report = execute_runtime(inventory, baseline, BlockedRuntime(), output)
        self.assertEqual(calls, ["load"])
        self.assertEqual(report["runtimeBlocked"], "BLOCKED_LOCAL_MEMORY")
        self.assertFalse(report["modelLoadedOnce"])
        self.assertEqual(report["cases"][0]["state"], "NOT_RUN")
        self.assertEqual(report["baseline"]["measuredCases"], 1)


if __name__ == "__main__":
    unittest.main()
