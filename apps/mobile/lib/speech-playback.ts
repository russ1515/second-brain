/**
 * Keep the first synthesis deliberately short so narration can start without
 * waiting for an entire lesson. The remainder is still synthesized through the
 * same metered backend seam and can be prepared while the first segment plays.
 */
export const FIRST_AUDIO_TARGET_MS = 3_000;
export const FIRST_NARRATION_SEGMENT_MAX = 240;
/** Only a genuinely light continuation may start while the lead is playing.
 * Longer remainders are requested after the lead, so Stop/navigation does not
 * leave a large speculative provider call running in the background. */
export const LIGHT_PREFETCH_MAX = 800;
// Common client ceiling aligned with the active OpenAI speech contract. The
// lead + remainder are therefore each independently valid provider inputs.
export const TTS_TEXT_MAX = 4_096;

export interface NarrationSegments {
  lead: string;
  tail: string | null;
}

/**
 * Produce at most two provider requests for one explicit learner action.
 *
 * Prefer a complete sentence, including punctuation used by non-Latin writing
 * systems. If no sentence boundary is available, use a word boundary. The
 * existing API limit is enforced before the first (billable) request so a long
 * unsupported input cannot create a paid partial narration.
 */
export function narrationSegments(text: string): NarrationSegments {
  const normalized = text.trim();
  if (!normalized) throw new Error('TTS_TEXT_REQUIRED');
  if (normalized.length > TTS_TEXT_MAX) throw new Error('TTS_TEXT_TOO_LONG');
  if (normalized.length <= FIRST_NARRATION_SEGMENT_MAX) {
    return { lead: normalized, tail: null };
  }

  const window = normalized.slice(0, FIRST_NARRATION_SEGMENT_MAX + 1);
  let boundary = -1;

  for (let index = 0; index < window.length; index += 1) {
    if (/[.!?。！？।…]/u.test(window[index])) {
      boundary = index + 1;
      break;
    }
  }

  if (boundary < 1) {
    const wordBoundary = window.lastIndexOf(' ', FIRST_NARRATION_SEGMENT_MAX);
    boundary = wordBoundary > 0
      ? wordBoundary
      : FIRST_NARRATION_SEGMENT_MAX;
  }

  const lead = normalized.slice(0, boundary).trim();
  const tail = normalized.slice(boundary).trim();
  return { lead, tail: tail || null };
}
