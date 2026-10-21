"""Posterior mathematics and safe abstention; not acoustic/model acceptance."""

import json
import math
from pathlib import Path
import sys
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from v2.scorer import Wav2Vec2PhonemeScorer
from v2.errors import V2EvidenceError


def logs(rows):
    return [[math.log(value) if value else float("-inf") for value in row] for row in rows]


class SyntheticMapper:
    """Isolated interface fixture, deliberately not the real model inventory."""
    vocabulary = {"<pad>": 0, "a": 1, "b": 2, "c": 3}
    blank_id = 0
    special_ids = {0}

    def validate_sequence(self, sequence):
        if not sequence:
            raise V2EvidenceError("EXPECTED_PHONEME_SEQUENCE_INVALID")

    def canonical_ids_for_symbol(self, symbol):
        return ["fixture:" + symbol]


def expected(token=1, symbol="a", **overrides):
    return [{"canonicalId": "fixture:" + symbol, "arpabet": "AA", "stress": 1,
             "wordIndex": 0, "word": "synthetic", "ipa": symbol,
             "modelTokens": [{"id": token, "symbol": symbol}], **overrides}]


class PosteriorContrastTests(unittest.TestCase):
    def setUp(self):
        self.scorer = Wav2Vec2PhonemeScorer(SyntheticMapper())

    def test_expected_posterior_is_raw_evidence_not_mastery(self):
        result = self.scorer.score(logs([[0.01, 0.9, 0.05, 0.04]]), expected())
        phone = result["phonemes"][0]
        self.assertAlmostEqual(phone["rawScore"], math.log(0.9))
        self.assertAlmostEqual(phone["marginToAlternative"], math.log(0.9) - math.log(0.05))
        self.assertAlmostEqual(phone["relativeMargin"], 0.85)
        self.assertFalse(phone["weakRegionCandidate"])
        self.assertIsNone(phone["observedPhoneme"])
        self.assertIsNone(phone["confidence"])
        self.assertFalse(result["masteryEligible"])
        self.assertIsNone(result["overallAcousticScore"])

    def test_competing_phone_exposes_only_tentative_region(self):
        result = self.scorer.score(logs([[0.01, 0.05, 0.9, 0.04]]), expected())
        phone = result["phonemes"][0]
        self.assertLess(phone["marginToAlternative"], 0)
        self.assertEqual(phone["posteriorCandidates"][0]["phoneme"], "b")
        self.assertTrue(phone["weakRegionCandidate"])
        self.assertEqual(result["diagnostic"]["weakRegionCandidates"][0]["phonemeIndex"], 0)
        self.assertFalse(phone["confirmedPronunciationWeakness"])
        self.assertEqual(result["diagnostic"]["confirmedWeakPhonemes"], [])
        self.assertIsNone(phone["observedPhoneme"])

    def test_flat_tied_posteriors_abstain(self):
        result = self.scorer.score(logs([[0.25, 0.25, 0.25, 0.25]]), expected())
        self.assertEqual(result["phonemes"][0]["diagnosticStatus"], "LOW_CONFIDENCE")
        self.assertFalse(result["phonemes"][0]["weakRegionCandidate"])
        self.assertEqual(result["diagnostic"]["abstentionCount"], 1)

    def test_blank_dominance_abstains_without_zero_score(self):
        result = self.scorer.score(logs([[0.7, 0.1, 0.15, 0.05]]), expected())
        phone = result["phonemes"][0]
        self.assertEqual(phone["abstentionReason"], "INSUFFICIENT_ACOUSTIC_CONFIDENCE")
        self.assertTrue(phone["marginToAlternative"] < 0)
        self.assertFalse(phone["weakRegionCandidate"])
        self.assertIsNone(result["overallAcousticScore"])

    def test_external_content_mismatch_suppresses_pronunciation_claim(self):
        result = self.scorer.score(logs([[0.01, 0.05, 0.9, 0.04]]), expected(), contentStatus="MISMATCH")
        self.assertEqual(result["diagnostic"]["status"], "CONTENT_MISMATCH")
        self.assertTrue(result["phonemes"][0]["rawWeakRegionCandidate"])
        self.assertFalse(result["phonemes"][0]["weakRegionCandidate"])
        self.assertEqual(result["diagnostic"]["weakRegionCandidates"], [])

    def test_partial_content_never_becomes_full_completeness(self):
        result = self.scorer.score(logs([[0.01, 0.05, 0.9, 0.04]]), expected(), contentStatus="PARTIAL")
        self.assertEqual(result["diagnostic"]["status"], "INCOMPLETE_CONTENT")
        self.assertEqual(result["phonemes"][0]["abstentionReason"], "INCOMPLETE_CONTENT")

    def test_literal_zero_posteriors_do_not_produce_infinite_json_scores(self):
        result = self.scorer.score(logs([[0, 1, 0, 0]]), expected())
        self.assertIsNone(result["phonemes"][0]["gopLikeScore"])
        self.assertIsNone(result["phonemes"][0]["blankLogPosteriorMean"])
        json.dumps(result, allow_nan=False)

    def test_compound_canonical_phone_is_not_compared_to_a_single_token(self):
        sequence = expected(modelTokens=[{"id": 1, "symbol": "a"}, {"id": 2, "symbol": "b"}])
        result = self.scorer.score(logs([[0.01, 0.9, 0.05, 0.04], [0.01, 0.05, 0.9, 0.04]]), sequence)
        phone = result["phonemes"][0]
        self.assertIsNone(phone["gopLikeScore"])
        self.assertEqual(phone["abstentionReason"], "COMPOUND_PHONEME_COMPETITION_NOT_VALIDATED")

    def test_content_evidence_is_explicit_and_never_guessed(self):
        with self.assertRaisesRegex(V2EvidenceError, "CONTENT_EVIDENCE_STATUS_INVALID"):
            self.scorer.score(logs([[0.01, 0.9, 0.05, 0.04]]), expected(), contentStatus="pretend-match")

    def test_unmapped_competitor_retains_raw_evidence_but_abstains(self):
        class UnmappedCompetitor(SyntheticMapper):
            def canonical_ids_for_symbol(self, symbol):
                return [] if symbol == "b" else super().canonical_ids_for_symbol(symbol)
        result = Wav2Vec2PhonemeScorer(UnmappedCompetitor()).score(
            logs([[0.01, 0.05, 0.9, 0.04]]), expected())
        phone = result["phonemes"][0]
        self.assertTrue(phone["rawWeakRegionCandidate"])
        self.assertFalse(phone["weakRegionCandidate"])
        self.assertEqual(phone["abstentionReason"], "ALTERNATIVE_PHONEME_MAPPING_UNSUPPORTED")

    def test_same_canonical_allophone_is_not_declared_a_phoneme_error(self):
        class AllophonicCompetitor(SyntheticMapper):
            def canonical_ids_for_symbol(self, symbol):
                return ["fixture:a"] if symbol == "b" else super().canonical_ids_for_symbol(symbol)
        result = Wav2Vec2PhonemeScorer(AllophonicCompetitor()).score(
            logs([[0.01, 0.05, 0.9, 0.04]]), expected())
        phone = result["phonemes"][0]
        self.assertTrue(phone["rawWeakRegionCandidate"])
        self.assertFalse(phone["weakRegionCandidate"])
        self.assertEqual(phone["abstentionReason"], "ALLOPHONIC_VARIATION_NOT_EVALUATED")

    def test_mixed_abstention_does_not_claim_the_whole_sequence_has_expected_dominance(self):
        sequence = expected() + expected(token=2, symbol="b", wordIndex=1)
        posterior = logs([[0.01, 0.9, 0.05, 0.04], [0.7, 0.1, 0.15, 0.05]])
        result = self.scorer.score(posterior, sequence)
        self.assertEqual(result["diagnostic"]["status"], "PARTIAL_ACOUSTIC_EVIDENCE")
        self.assertEqual(result["diagnostic"]["abstentionCount"], 1)


if __name__ == "__main__":
    unittest.main()
