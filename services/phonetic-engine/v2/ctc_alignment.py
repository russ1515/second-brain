"""Bounded expected-label CTC alignment, not free-running text recognition.

CTC topology follows Graves et al. (2006), section 4.1:
https://www.cs.toronto.edu/~graves/icml_2006.pdf

Viterbi chooses the most likely allowed alignment. The forward recurrence also
sums all target-compatible paths in log space. Neither quantity establishes that
the learner pronounced the target correctly. In particular a forced path can
exist for wrong or noisy audio. No pedagogical threshold appears here.
"""

from array import array
import math
from numbers import Real

from .errors import V2EvidenceError

NEG_INF = float("-inf")
MAX_ALIGNMENT_CELLS = 4_000_000
MAX_POSTERIOR_CELLS = 8_192_000
MAX_TARGET_TOKENS = 800
MAX_POSTERIOR_FRAMES = 4000
MAX_VOCABULARY_SIZE = 4096


def logsumexp(values):
    values = tuple(values)
    maximum = max(values, default=NEG_INF)
    if maximum == NEG_INF:
        return NEG_INF
    return maximum + math.log(sum(math.exp(value - maximum) for value in values))


def validate_log_posteriors(rows):
    """Require normalized log-softmax rows with bounded rectangular shape.

    Tolerance is numeric round-off only, not a confidence/scoring threshold.
    The caller must explicitly convert its native tensor to this pure contract.
    """
    if not isinstance(rows, (list, tuple)) or not 1 <= len(rows) <= MAX_POSTERIOR_FRAMES:
        raise V2EvidenceError("ACOUSTIC_POSTERIOR_SHAPE_INVALID")
    if not isinstance(rows[0], (list, tuple)) or not 2 <= len(rows[0]) <= MAX_VOCABULARY_SIZE:
        raise V2EvidenceError("ACOUSTIC_POSTERIOR_SHAPE_INVALID")
    width = len(rows[0])
    if len(rows) * width > MAX_POSTERIOR_CELLS:
        raise V2EvidenceError("ACOUSTIC_POSTERIOR_LIMIT_EXCEEDED")
    for row in rows:
        if not isinstance(row, (list, tuple)) or len(row) != width:
            raise V2EvidenceError("ACOUSTIC_POSTERIOR_SHAPE_INVALID")
        if any(isinstance(value, bool) or not isinstance(value, Real)
               or math.isnan(value) or value == float("inf") or value > 0.000001 for value in row):
            raise V2EvidenceError("ACOUSTIC_POSTERIOR_VALUE_INVALID")
        if not math.isclose(sum(math.exp(value) for value in row), 1.0, rel_tol=0.0001, abs_tol=0.0001):
            raise V2EvidenceError("ACOUSTIC_POSTERIOR_NOT_NORMALIZED")
    return len(rows), width


class CTCExpectedAligner:
    def __init__(self, max_cells=MAX_ALIGNMENT_CELLS):
        if isinstance(max_cells, bool) or not isinstance(max_cells, int) or not 1 <= max_cells <= MAX_ALIGNMENT_CELLS:
            raise V2EvidenceError("ACOUSTIC_ALIGNMENT_LIMIT_INVALID")
        self.max_cells = max_cells

    def align(self, log_posteriors, expected_token_ids, blank_id, frame_duration_ms=20.0):
        frames, width = validate_log_posteriors(log_posteriors)
        if isinstance(blank_id, bool) or not isinstance(blank_id, int) or not 0 <= blank_id < width:
            raise V2EvidenceError("CTC_BLANK_TOKEN_INVALID")
        if (not isinstance(expected_token_ids, (list, tuple))
                or not 1 <= len(expected_token_ids) <= MAX_TARGET_TOKENS
                or any(isinstance(token, bool) or not isinstance(token, int)
                       or not 0 <= token < width or token == blank_id for token in expected_token_ids)):
            raise V2EvidenceError("CTC_EXPECTED_SEQUENCE_INVALID")
        if (isinstance(frame_duration_ms, bool) or not isinstance(frame_duration_ms, Real)
                or not math.isfinite(frame_duration_ms) or frame_duration_ms <= 0):
            raise V2EvidenceError("CTC_FRAME_TIMING_INVALID")
        required_frames = len(expected_token_ids) + sum(
            left == right for left, right in zip(expected_token_ids, expected_token_ids[1:]))
        if frames < required_frames:
            raise V2EvidenceError("CTC_INSUFFICIENT_FRAMES")
        labels = [blank_id]
        for token in expected_token_ids:
            labels.extend((token, blank_id))
        states = len(labels)
        if frames * states > self.max_cells:
            raise V2EvidenceError("ACOUSTIC_ALIGNMENT_LIMIT_EXCEEDED")
        # Only backpointers retain T x S entries; likelihood rows are rolling.
        # The 800-target bound keeps state indices safely below uint16 sentinel.
        unreachable = 65535
        predecessors = [array("H", [unreachable]) * states for _ in range(frames)]
        best = [NEG_INF] * states
        forward = [NEG_INF] * states
        best[0] = forward[0] = float(log_posteriors[0][blank_id])
        best[1] = forward[1] = float(log_posteriors[0][labels[1]])
        for frame in range(1, frames):
            next_best = [NEG_INF] * states
            next_forward = [NEG_INF] * states
            for state, label in enumerate(labels):
                previous_states = [state]
                if state:
                    previous_states.append(state - 1)
                if state >= 2 and label != blank_id and label != labels[state - 2]:
                    previous_states.append(state - 2)
                previous_state = max(previous_states, key=lambda index: best[index])
                emission = float(log_posteriors[frame][label])
                next_best[state] = best[previous_state] + emission
                next_forward[state] = logsumexp(forward[index] for index in previous_states) + emission
                if next_best[state] != NEG_INF:
                    predecessors[frame][state] = previous_state
            best, forward = next_best, next_forward
        final_states = (states - 1, states - 2)
        final_state = max(final_states, key=lambda index: best[index])
        best_path_log_likelihood = best[final_state]
        target_log_likelihood = logsumexp(forward[index] for index in final_states)
        if best_path_log_likelihood == NEG_INF or target_log_likelihood == NEG_INF:
            raise V2EvidenceError("CTC_ALIGNMENT_UNAVAILABLE")
        path = [final_state]
        for frame in range(frames - 1, 0, -1):
            final_state = predecessors[frame][final_state]
            if final_state == unreachable:
                raise V2EvidenceError("CTC_ALIGNMENT_UNAVAILABLE")
            path.append(final_state)
        path.reverse()
        segments = []
        for index, token_id in enumerate(expected_token_ids):
            state = index * 2 + 1
            assigned = [frame for frame, path_state in enumerate(path) if path_state == state]
            if not assigned:
                raise V2EvidenceError("CTC_ALIGNMENT_TARGET_MISSING")
            logs = [float(log_posteriors[frame][token_id]) for frame in assigned]
            segments.append({"targetIndex": index, "tokenId": token_id,
                "startFrame": assigned[0], "endFrame": assigned[-1] + 1,
                "startMs": assigned[0] * frame_duration_ms,
                "endMs": (assigned[-1] + 1) * frame_duration_ms,
                "frameIndexes": assigned, "meanExpectedLogPosterior": sum(logs) / len(logs),
                "meanExpectedPosterior": sum(math.exp(value) for value in logs) / len(logs),
                "confidence": None})
        conditional_path_probability = min(1.0, math.exp(best_path_log_likelihood - target_log_likelihood))
        return {"method": "EXPECTED_PHONEME_CTC_VITERBI_AND_FORWARD",
            "frameCount": frames, "frameDurationMs": frame_duration_ms,
            "segments": segments, "statePath": path,
            "bestPathLogLikelihood": best_path_log_likelihood,
            "targetSequenceLogLikelihood": target_log_likelihood,
            "bestPathConditionalPosterior": conditional_path_probability,
            "alignmentConfidence": None,
            "confidenceInterpretation": "PATH_POSTERIOR_CONDITIONAL_ON_EXPECTED_SEQUENCE_NOT_PRONUNCIATION_CONFIDENCE",
            "calibrationStatus": "UNCALIBRATED", "masteryEligible": False}
