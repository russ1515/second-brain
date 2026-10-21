"""Pure report tests with invented numerical fixtures, never acoustic evidence."""

from copy import deepcopy
import importlib.util
from pathlib import Path
import unittest


SPEC = importlib.util.spec_from_file_location("portable_report", Path(__file__).parents[1] /
                                           "benchmark" / "portable_report.py")
REPORT = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(REPORT)


def comparison(offset=0):
    rows = []
    for index in range(5):
        rows.append({"id": f"altered-{index}", "category": "ALTERED_PHONEME", "state": "MEASURED",
            "fixtureSha256": str(index) * 64, "goldRegions": [{"role": "PRIMARY", "wordIndex": 0,
                "expectedPhoneIndex": index}], "caveats": ["SYNTHETIC_AUDIO_NOT_HUMAN_CALIBRATION"],
            "primaryRawCandidateLocalization": "YES", "primaryCandidateLocalization": "YES" if index < 2 else "NO",
            "primaryReliableLocalization": "NO", "rawCandidateRegions": [{"expectedPhoneIndex": index}],
            "candidateRegions": [{"expectedPhoneIndex": index}] if index < 2 else [], "confirmedRegions": [],
            "diagnosticAbstention": True, "phonemeAbstentionReasons": {"UNSUPPORTED": index},
            "timingsMs": {"preprocessingElapsedMs": 1, "warmInferenceElapsedMs": 20 + offset + index,
                "inferenceWasWarm": index != 0, "alignmentElapsedMs": 2,
                "scorerTotalElapsedMs": 5, "totalElapsedMs": 30 + offset + index}})
    rows.append({"id": "clean", "category": "REFERENCE", "state": "MEASURED", "fixtureSha256": "f" * 64,
        "goldRegions": [], "caveats": [], "primaryRawCandidateLocalization": "NOT_APPLICABLE",
        "primaryCandidateLocalization": "NOT_APPLICABLE", "primaryReliableLocalization": "NOT_APPLICABLE",
        "cleanReferenceRawCandidateFalsePositives": 3, "cleanReferenceCandidateFalsePositives": 1,
        "cleanReferenceConfirmedFalsePositives": 0, "diagnosticAbstention": True,
        "timingsMs": {"warmInferenceElapsedMs": 25 + offset, "inferenceWasWarm": True}})
    return {"baseline": {"correctPrimaryReliableLocalizations": 0, "controlledAlterations": 5},
        "v2": {"controlledAlterations": 5, "measuredControlledAlterations": 5, "measuredCases": 6,
            "correctPrimaryRawCandidateLocalizations": 5, "correctPrimaryCandidateLocalizations": 2,
            "correctPrimaryReliableLocalizations": 0, "referenceRawCandidateFalsePositives": 3,
            "referenceCandidateFalsePositives": 1, "referenceConfirmedFalsePositives": 0,
            "diagnosticAbstentions": 6}, "cases": rows, "masteryEligible": False,
        "calibrationStatus": "UNCALIBRATED", "paidCalls": 0}


class PortableReportTests(unittest.TestCase):
    def test_prepare_without_host_never_becomes_an_acoustic_zero_result(self):
        result = REPORT.build_report([], [], status="NOT_RUN", error="HIGH_RAM_HOST_REQUIRED")
        self.assertEqual(result["quality"]["status"], "NOT_VERIFIED")
        self.assertEqual(result["cases"], [])
        self.assertIsNone(result["countsAcrossRepetitions"]["correctPrimaryReliableLocalizations"]["min"])
        self.assertEqual(result["timingsMs"]["totalElapsedMs"]["sampleCount"], 0)
        self.assertEqual(result["quality"]["int8QualityLossVsFp32"], "NOT_MEASURED")

    def test_three_runs_do_not_multiply_five_gold_cases_or_conflate_candidates(self):
        result = REPORT.build_report([], [comparison(0), comparison(10), comparison(20)], status="PASS")
        self.assertEqual(result["controlledGoldCases"], 5)
        self.assertEqual(result["repetitions"]["complete"], 3)
        stats = result["countsAcrossRepetitions"]
        self.assertEqual(stats["correctPrimaryRawCandidateLocalizations"]["perRepetition"], [5, 5, 5])
        self.assertEqual(stats["correctPrimaryCandidateLocalizations"]["perRepetition"], [2, 2, 2])
        self.assertEqual(stats["correctPrimaryReliableLocalizations"]["perRepetition"], [0, 0, 0])
        case = result["cases"][0]
        self.assertEqual(case["primaryRawCandidateLocalization"]["localizedRepetitions"], 3)
        self.assertEqual(case["primaryReliableLocalization"]["localizedRepetitions"], 0)
        self.assertEqual(case["timingsMs"]["totalElapsedMs"]["medianObserved"], 40)
        self.assertEqual(stats["referenceRawCandidateFalsePositives"]["perRepetition"], [3, 3, 3])
        self.assertEqual(stats["referenceCandidateFalsePositives"]["perRepetition"], [1, 1, 1])
        self.assertFalse(result["masteryEligible"])
        self.assertEqual(result["quality"]["diagnosisUsefulness"], "NOT_VERIFIED")

    def test_warm_split_uses_true_flag_not_list_position(self):
        source = comparison()
        source["cases"][0]["timingsMs"]["inferenceWasWarm"] = True
        source["cases"][1]["timingsMs"]["inferenceWasWarm"] = False
        del source["cases"][2]["timingsMs"]["inferenceWasWarm"]
        result = REPORT.build_report([], [source], status="PARTIAL_PASS")
        timing = result["timingsMs"]["sessionAndPosteriorElapsedMs"]
        self.assertEqual(timing["firstInference"]["min"], 21)
        self.assertEqual(timing["warmInference"]["min"], 20)
        self.assertEqual(timing["unknownWarmState"]["sampleCount"], 1)
        self.assertEqual(result["timingsMs"]["nativeModelInferenceOnly"]["status"], "NOT_SEPARATELY_MEASURED")

    def test_residual_is_labelled_overhead_not_invented_pure_gop(self):
        result = REPORT.build_report([], [comparison()], status="PARTIAL_PASS")
        residual = result["timingsMs"]["gopEvidenceAndScorerOverheadElapsedMs"]
        self.assertEqual(residual["sampleCount"], 5)
        self.assertEqual(residual["min"], 3)
        self.assertIn("NOT pure GOP", residual["definition"])

    def test_inconsistent_negative_residual_is_not_reported_as_a_measurement(self):
        source = comparison()
        source["cases"][0]["timingsMs"]["scorerTotalElapsedMs"] = 1
        result = REPORT.build_report([], [source], status="PARTIAL_PASS")
        self.assertEqual(result["timingsMs"]["gopEvidenceAndScorerOverheadElapsedMs"]["sampleCount"], 4)

    def test_phase_memory_is_child_observation_and_failed_peak_is_truncated(self):
        phase = {"phase": "load", "status": "FAIL", "modelLoad": "NOT_RUN", "error": "MEMORY_LIMIT",
            "resourceSamples": [{"child": {"workingSetBytes": 100, "peakWorkingSetBytes": 120}}],
            "release": {"processMemoryReleased": True}}
        result = REPORT.build_report([phase], [], status="FAIL")
        self.assertEqual(result["phases"][0]["memory"]["peakWorkingSetBytes"]["max"], 120)
        self.assertTrue(result["phases"][0]["memoryPeakMayBeTruncated"])
        self.assertEqual(result["modelLoadElapsedMs"]["status"], "NOT_MEASURED")

    def test_partial_case_errors_remain_visible_and_not_counted_as_success(self):
        source = comparison()
        source["cases"][0] = {"id": "altered-0", "category": "ALTERED_PHONEME", "state": "TECHNICAL_ERROR",
                                  "executionError": "FAILED"}
        source["v2"]["measuredCases"] = 5
        result = REPORT.build_report([], [source], status="FAIL")
        self.assertEqual(result["repetitions"]["complete"], 0)
        self.assertEqual(result["cases"][0]["state"], "TECHNICAL_ERROR")
        self.assertEqual(result["cases"][0]["repetitions"][0]["state"], "TECHNICAL_ERROR")

    def test_gold_changes_different_hashes_and_baseline_are_rejected(self):
        for mutate in (lambda row: row["v2"].update(controlledAlterations=6),
                       lambda row: row["baseline"].update(controlledAlterations=6),
                       lambda row: row["cases"][0].update(fixtureSha256="0" * 63 + "1"),
                       lambda row: row["cases"][0].update(goldRegions=[])):
            changed = comparison()
            mutate(changed)
            with self.assertRaises(ValueError):
                REPORT.build_report([], [comparison(), changed], status="FAIL")

    def test_max_three_repetitions_and_no_pass_from_two(self):
        with self.assertRaisesRegex(ValueError, "REPETITION_LIMIT"):
            REPORT.build_report([], [comparison()] * 4, status="FAIL")
        with self.assertRaisesRegex(ValueError, "THREE_COMPLETE"):
            REPORT.build_report([], [comparison()] * 2, status="PASS")
        with self.assertRaises(ValueError):
            REPORT.build_report([], [], status="PARTIAL_PASS")

    def test_case_set_cannot_be_expanded_or_reduced_between_repetitions(self):
        for added in (True, False):
            changed = comparison()
            if added:
                changed["cases"].append({"id": "new", "state": "NOT_RUN"})
            else:
                changed["cases"].pop()
            with self.assertRaisesRegex(ValueError, "CASE_SET_CHANGED"):
                REPORT.build_report([], [comparison(), changed], status="FAIL")

    def test_no_calibration_or_paid_call_can_be_smuggled_into_local_report(self):
        source = comparison()
        source["masteryEligible"] = True
        with self.assertRaisesRegex(ValueError, "UNCALIBRATED_BOUNDARY"):
            REPORT.build_report([], [source])
        with self.assertRaisesRegex(ValueError, "LOCAL_ONLY_BOUNDARY"):
            REPORT.build_report([{"paidCalls": 1}], [])

    def test_nonfinite_and_negative_numeric_observations_are_rejected(self):
        for value in (True, -1, float("inf"), float("nan")):
            with self.assertRaises(ValueError):
                REPORT.observed_summary([value])

    def test_input_payloads_are_not_mutated(self):
        source = comparison()
        original = deepcopy(source)
        result = REPORT.build_report([], [source], status="PARTIAL_PASS")
        result["cases"][0]["repetitions"][0]["rawCandidateRegions"].clear()
        self.assertEqual(source, original)


if __name__ == "__main__":
    unittest.main()
