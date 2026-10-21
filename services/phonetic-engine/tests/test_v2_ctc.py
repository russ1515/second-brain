"""Pure posterior tests only; no model, package install, network or learner audio."""

import itertools
import math
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from v2.ctc_alignment import CTCExpectedAligner, logsumexp
from v2.errors import V2EvidenceError


def logs(rows):
    return [[math.log(value) if value else float("-inf") for value in row] for row in rows]


def collapse(path, blank=0):
    without_repeats = [value for index, value in enumerate(path) if not index or value != path[index - 1]]
    return [value for value in without_repeats if value != blank]


class ExpectedAlignmentTests(unittest.TestCase):
    def test_exact_target_spikes_have_expected_regions(self):
        posterior = logs([[0.9, 0.05, 0.05], [0.01, 0.98, 0.01],
                          [0.9, 0.05, 0.05], [0.01, 0.01, 0.98], [0.9, 0.05, 0.05]])
        result = CTCExpectedAligner().align(posterior, [1, 2], 0)
        self.assertEqual([segment["startFrame"] for segment in result["segments"]], [1, 3])
        self.assertEqual([segment["endFrame"] for segment in result["segments"]], [2, 4])
        self.assertFalse(result["masteryEligible"])
        self.assertIsNone(result["alignmentConfidence"])

    def test_forward_and_best_path_match_exhaustive_ctc_enumeration(self):
        posterior = logs([[0.4, 0.4, 0.2], [0.3, 0.4, 0.3],
                          [0.2, 0.3, 0.5], [0.4, 0.1, 0.5]])
        compatible = [sum(posterior[frame][label] for frame, label in enumerate(path))
                      for path in itertools.product(range(3), repeat=4) if collapse(path) == [1, 2]]
        result = CTCExpectedAligner().align(posterior, [1, 2], 0)
        self.assertAlmostEqual(result["bestPathLogLikelihood"], max(compatible))
        self.assertAlmostEqual(result["targetSequenceLogLikelihood"], logsumexp(compatible))
        self.assertAlmostEqual(result["bestPathConditionalPosterior"],
                               math.exp(max(compatible) - logsumexp(compatible)))

    def test_repeated_expected_labels_require_a_blank(self):
        with self.assertRaisesRegex(V2EvidenceError, "CTC_INSUFFICIENT_FRAMES"):
            CTCExpectedAligner().align(logs([[0.1, 0.9], [0.1, 0.9]]), [1, 1], 0)
        result = CTCExpectedAligner().align(logs([[0.01, 0.99], [0.99, 0.01], [0.01, 0.99]]), [1, 1], 0)
        self.assertEqual([segment["startFrame"] for segment in result["segments"]], [0, 2])
        self.assertEqual(collapse([0 if state % 2 == 0 else 1 for state in result["statePath"]]), [1, 1])

    def test_different_labels_can_transition_without_blank(self):
        result = CTCExpectedAligner().align(logs([[0.01, 0.98, 0.01], [0.01, 0.01, 0.98]]), [1, 2], 0)
        self.assertEqual(result["statePath"], [1, 3])

    def test_impossible_target_does_not_become_a_bad_pronunciation_score(self):
        with self.assertRaisesRegex(V2EvidenceError, "CTC_ALIGNMENT_UNAVAILABLE"):
            CTCExpectedAligner().align(logs([[1, 0], [1, 0]]), [1], 0)

    def test_flat_evidence_is_alignable_but_not_certified_confidence(self):
        result = CTCExpectedAligner().align(logs([[0.5, 0.5]] * 4), [1], 0)
        self.assertIsNone(result["alignmentConfidence"])
        self.assertLess(result["bestPathConditionalPosterior"], 1)
        self.assertIsNone(result["segments"][0]["confidence"])

    def test_numeric_and_shape_guards(self):
        for posterior in ([], [[0]], [[0, 0]], [[float("nan"), 0]], [[float("inf"), 0]],
                          [[False, 0]], [[0.1, -1]], [[-0.7, -0.7], [-0.7]]):
            with self.subTest(posterior=posterior), self.assertRaises(V2EvidenceError):
                CTCExpectedAligner().align(posterior, [1], 0)

    def test_expected_blank_id_and_timing_guards(self):
        posterior = logs([[0.4, 0.6]] * 3)
        for expected in ([], [0], [3], [True], ["1"]):
            with self.subTest(expected=expected), self.assertRaises(V2EvidenceError):
                CTCExpectedAligner().align(posterior, expected, 0)
        for blank in (True, -1, 3):
            with self.subTest(blank=blank), self.assertRaises(V2EvidenceError):
                CTCExpectedAligner().align(posterior, [1], blank)
        for timing in (0, -1, float("nan"), True):
            with self.subTest(timing=timing), self.assertRaises(V2EvidenceError):
                CTCExpectedAligner().align(posterior, [1], 0, timing)

    def test_dp_resource_bound(self):
        with self.assertRaisesRegex(V2EvidenceError, "ACOUSTIC_ALIGNMENT_LIMIT_EXCEEDED"):
            CTCExpectedAligner(max_cells=2).align(logs([[0.4, 0.6]]), [1], 0)


if __name__ == "__main__":
    unittest.main()
