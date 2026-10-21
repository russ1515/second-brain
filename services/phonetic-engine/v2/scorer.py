"""Model-independent, uncalibrated posterior contrasts on expected CTC regions.

Input is normalized log-posteriors from an explicitly loaded local phoneme model.
This module neither imports Transformers/Torch nor downloads/invokes a provider.
Raw ranking is scientific evidence, not calibrated correctness or certification.
"""

import math
import time

from .ctc_alignment import CTCExpectedAligner
from .errors import V2EvidenceError


class Wav2Vec2PhonemeScorer:
    def __init__(self, mapper, aligner=None):
        self.mapper = mapper
        self.aligner = aligner or CTCExpectedAligner()

    def score(self, log_posteriors, expectedSequence, frameStrideMs=20.0, contentStatus="UNKNOWN"):
        started = time.perf_counter()
        if contentStatus not in ("UNKNOWN", "MATCHED", "MISMATCH", "PARTIAL"):
            raise V2EvidenceError("CONTENT_EVIDENCE_STATUS_INVALID")
        self.mapper.validate_sequence(expectedSequence)
        flattened = []
        owners = []
        for index, expected in enumerate(expectedSequence):
            for model_token in expected["modelTokens"]:
                flattened.append(model_token["id"])
                owners.append(index)
        aligned_start = time.perf_counter()
        alignment = self.aligner.align(log_posteriors, flattened, self.mapper.blank_id, frameStrideMs)
        alignment_elapsed = (time.perf_counter() - aligned_start) * 1000
        if len(log_posteriors[0]) != len(self.mapper.vocabulary):
            raise V2EvidenceError("PHONEME_INVENTORY_POSTERIOR_MISMATCH")
        phonemic_tokens = sorted((token_id, symbol) for symbol, token_id in self.mapper.vocabulary.items()
                                 if token_id not in self.mapper.special_ids)
        evidence = []
        for index, expected in enumerate(expectedSequence):
            units = [segment for segment, owner in zip(alignment["segments"], owners) if owner == index]
            assigned = sorted(frame for unit in units for frame in unit["frameIndexes"])
            expected_tokens = {unit["tokenId"] for unit in units}
            expected_logs = [float(log_posteriors[frame][unit["tokenId"]])
                             for unit in units for frame in unit["frameIndexes"]]
            expected_mean = sum(expected_logs) / len(expected_logs)
            expected_posterior = sum(math.exp(value) for value in expected_logs) / len(expected_logs)
            candidates = []
            for token_id, symbol in phonemic_tokens:
                if token_id in expected_tokens:
                    continue
                values = [float(log_posteriors[frame][token_id]) for frame in assigned]
                mean_log = sum(value / len(values) for value in values)
                if not math.isfinite(mean_log):
                    # A literal zero-mass competitor has log=-inf. Do not put
                    # Infinity in the JSON contract or manufacture a finite GOP.
                    continue
                candidates.append({"phoneme": symbol,
                    "canonicalIds": self.mapper.canonical_ids_for_symbol(symbol),
                    "meanLogPosterior": mean_log,
                    "meanPosterior": sum(math.exp(value) for value in values) / len(values),
                    "confidence": None})
            candidates.sort(key=lambda candidate: (-candidate["meanLogPosterior"], candidate["phoneme"]))
            alternative = candidates[0] if candidates else None
            blank_mean = sum(float(log_posteriors[frame][self.mapper.blank_id]) for frame in assigned) / len(assigned)
            margin = expected_mean - alternative["meanLogPosterior"] if alternative else None
            relative_margin = expected_posterior - alternative["meanPosterior"] if alternative else None
            entropy = []
            for frame in assigned:
                row = log_posteriors[frame]
                entropy.append(-sum(math.exp(value) * value for value in row if math.isfinite(value)) / math.log(len(row)))
            tied = margin is not None and math.isclose(margin, 0.0, rel_tol=0.0, abs_tol=1e-12)
            blank_dominant = alternative is not None and blank_mean >= max(expected_mean, alternative["meanLogPosterior"])
            # Multi-token canonical phones need sequence-vs-sequence competition;
            # comparing a compound with one constant alternative would be invalid.
            comparison_supported = len(expected["modelTokens"]) == 1
            abstention = None
            if not comparison_supported:
                abstention = "COMPOUND_PHONEME_COMPETITION_NOT_VALIDATED"
            elif alternative is None:
                abstention = "NO_COMPARABLE_PHONEME_ALTERNATIVE"
            elif tied or blank_dominant:
                abstention = "INSUFFICIENT_ACOUSTIC_CONFIDENCE"
            elif margin < 0 and not alternative["canonicalIds"]:
                abstention = "ALTERNATIVE_PHONEME_MAPPING_UNSUPPORTED"
            elif margin < 0 and expected["canonicalId"] in alternative["canonicalIds"]:
                abstention = "ALLOPHONIC_VARIATION_NOT_EVALUATED"
            elif contentStatus in ("MISMATCH", "PARTIAL"):
                abstention = "CONTENT_MISMATCH" if contentStatus == "MISMATCH" else "INCOMPLETE_CONTENT"
            raw_candidate = comparison_supported and alternative is not None and margin < 0 and not tied and not blank_dominant
            candidate = raw_candidate and abstention is None
            if abstention:
                status = "LOW_CONFIDENCE"
            elif candidate:
                status = "CONTRAST_CANDIDATE_UNCALIBRATED"
            else:
                status = "EXPECTED_POSTERIOR_HIGHER_NOT_CERTIFIED"
            evidence.append({"index": index, "wordIndex": expected["wordIndex"],
                "canonicalId": expected["canonicalId"], "expectedPhoneme": expected["ipa"],
                "expectedArpabet": expected["arpabet"], "stress": expected["stress"],
                "startFrame": min(unit["startFrame"] for unit in units),
                "endFrame": max(unit["endFrame"] for unit in units),
                "startMs": min(unit["startMs"] for unit in units),
                "endMs": max(unit["endMs"] for unit in units),
                "rawScore": expected_mean, "rawScoreType": "MEAN_EXPECTED_LOG_POSTERIOR",
                "gopLikeScore": margin if comparison_supported else None,
                "marginToAlternative": margin if comparison_supported else None,
                "relativeMargin": relative_margin if comparison_supported else None,
                "expectedPosteriorMean": expected_posterior,
                "blankLogPosteriorMean": blank_mean if math.isfinite(blank_mean) else None,
                "normalizedPosteriorEntropyMean": sum(entropy) / len(entropy),
                "posteriorCandidates": candidates[:3], "observedPhoneme": None,
                "alternativeMappingSupported": bool(alternative and alternative["canonicalIds"]),
                "confidence": None, "diagnosticStatus": status,
                "rawWeakRegionCandidate": raw_candidate,
                "weakRegionCandidate": candidate, "abstentionReason": abstention,
                "confirmedPronunciationWeakness": False})
        words = []
        for word_index in sorted({expected["wordIndex"] for expected in expectedSequence}):
            phones = [phone for phone in evidence if phone["wordIndex"] == word_index]
            expected_word = next(item.get("word") for item in expectedSequence if item["wordIndex"] == word_index)
            words.append({"wordIndex": word_index, "word": expected_word,
                "phonemeIndexes": [phone["index"] for phone in phones],
                "startMs": min(phone["startMs"] for phone in phones),
                "endMs": max(phone["endMs"] for phone in phones),
                "candidatePhonemeIndexes": [phone["index"] for phone in phones if phone["weakRegionCandidate"]],
                "confirmedWeak": False, "confidence": None})
        candidates = [{"phonemeIndex": phone["index"], "wordIndex": phone["wordIndex"],
                       "canonicalId": phone["canonicalId"], "marginToAlternative": phone["marginToAlternative"],
                       "tentative": True, "confidence": None}
                      for phone in evidence if phone["weakRegionCandidate"]]
        return {"status": "ACOUSTIC_EVIDENCE_AVAILABLE", "engineVersion": "sb-phonetic-v2-ctc-research",
            "language": "en", "locale": "en-US", "calibrationStatus": "UNCALIBRATED",
            "masteryEligible": False, "confidence": None, "overallAcousticScore": None,
            "phonemes": evidence, "words": words, "alignment": alignment,
            "diagnostic": {"status": "CONTENT_MISMATCH" if contentStatus == "MISMATCH" else
                "INCOMPLETE_CONTENT" if contentStatus == "PARTIAL" else
                "EXPERIMENTAL_CONTRAST_CANDIDATES_NOT_CERTIFIED" if candidates else
                "INSUFFICIENT_ACOUSTIC_CONFIDENCE" if all(phone["abstentionReason"] for phone in evidence) else
                "PARTIAL_ACOUSTIC_EVIDENCE" if any(phone["abstentionReason"] for phone in evidence) else
                "EXPECTED_POSTERIOR_HIGHER_NOT_CERTIFIED",
                "weakRegionCandidates": candidates, "confirmedWeakPhonemes": [],
                "contentStatus": contentStatus, "contentEvidenceSource": "CALLER_EXISTING_COMPLETENESS_LAYER_NOT_PHONEME_GUESS",
                "abstentionCount": sum(phone["abstentionReason"] is not None for phone in evidence),
                "observedPhonemeClaims": 0, "confidence": None},
            "timings": {"alignmentElapsedMs": alignment_elapsed,
                "scorerTotalElapsedMs": (time.perf_counter() - started) * 1000}}
