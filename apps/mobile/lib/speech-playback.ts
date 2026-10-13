/**
 * Keep the first synthesis deliberately short so narration can start without
 * waiting for an entire lesson. The remainder is still synthesized through the
 * same metered backend seam and can be prepared while the first segment plays.
 */
export const FIRST_AUDIO_TARGET_MS = 3_000;
export const FIRST_NARRATION_SEGMENT_MAX = 240;
/** Avoid turning a short greeting such as "Bonjour !" into a standalone clip.
 * A useful lead gives the one continuation request time to finish while that
 * lead is playing, without delaying the first audio until the whole lesson is
 * synthesized. */
export const FIRST_NARRATION_SEGMENT_MIN = 160;
// Common client ceiling aligned with the active OpenAI speech contract. The
// lead + remainder are therefore each independently valid provider inputs.
export const TTS_TEXT_MAX = 4_096;

export interface NarrationSegments {
  lead: string;
  tail: string | null;
}

export interface NarrationPlaybackOptions<T> {
  signal?: AbortSignal;
  requestId?: string;
  onFirstAudio?: () => void;
  waitUntilPlayable?: (signal?: AbortSignal) => Promise<void>;
  synthesize: (
    text: string,
    signal?: AbortSignal,
    requestId?: string,
  ) => Promise<T>;
  play: (
    result: T,
    onPlaybackStart?: () => void,
    signal?: AbortSignal,
  ) => Promise<void>;
}

export interface NarrationPauseGate {
  readonly paused: boolean;
  pause: () => boolean;
  resume: () => boolean;
  wait: (signal?: AbortSignal) => Promise<void>;
}

/**
 * Keep a pause request attached to the whole narration, including the short
 * periods where no platform player exists yet (initial synthesis and the gap
 * between two segments). This prevents a queued segment from starting by
 * itself after the learner pressed Pause.
 */
export function createNarrationPauseGate(): NarrationPauseGate {
  let paused = false;
  const waiters = new Set<() => void>();

  const release = () => {
    for (const waiter of [...waiters]) waiter();
  };

  return {
    get paused() {
      return paused;
    },
    pause() {
      if (paused) return false;
      paused = true;
      return true;
    },
    resume() {
      if (!paused) return false;
      paused = false;
      release();
      return true;
    },
    wait(signal?: AbortSignal) {
      if (!paused || signal?.aborted) return Promise.resolve();
      return new Promise<void>((resolve) => {
        let settled = false;
        const finish = () => {
          if (settled) return;
          settled = true;
          waiters.delete(finish);
          signal?.removeEventListener('abort', finish);
          resolve();
        };
        waiters.add(finish);
        signal?.addEventListener('abort', finish, { once: true });
        if (!paused || signal?.aborted) finish();
      });
    },
  };
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

  const window = normalized.slice(0, FIRST_NARRATION_SEGMENT_MAX);
  let boundary = -1;

  for (let index = 0; index < window.length; index += 1) {
    if (
      index + 1 >= FIRST_NARRATION_SEGMENT_MIN
      && /[.!?。！？।…]/u.test(window[index])
    ) {
      boundary = index + 1;
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

/**
 * Coordinate the two bounded synthesis requests and their ordered playback.
 *
 * The continuation starts as soon as the lead is available, before lead
 * playback begins. This removes the deterministic inter-segment stall that
 * previously occurred for every tail longer than an arbitrary threshold.
 * Rejections are captured immediately so a failed prefetch cannot become an
 * unhandled rejection while the lead is still playing.
 */
export async function playNarrationSegments<T>(
  text: string,
  options: NarrationPlaybackOptions<T>,
): Promise<void> {
  const { lead, tail } = narrationSegments(text);
  const leadRequestId = options.requestId ? `${options.requestId}:lead` : undefined;
  const tailRequestId = options.requestId ? `${options.requestId}:tail` : undefined;

  const first = await options.synthesize(
    lead,
    options.signal,
    leadRequestId,
  );
  if (options.signal?.aborted) return;

  const tailRequest = tail
    ? options.synthesize(tail, options.signal, tailRequestId).then(
        (value) => ({ ok: true as const, value }),
        (error: unknown) => ({ ok: false as const, error }),
      )
    : null;

  await options.waitUntilPlayable?.(options.signal);
  if (options.signal?.aborted) return;
  await options.play(first, options.onFirstAudio, options.signal);
  if (!tailRequest || options.signal?.aborted) return;

  const prepared = await tailRequest;
  if (!prepared.ok) throw prepared.error;
  if (options.signal?.aborted) return;
  await options.waitUntilPlayable?.(options.signal);
  if (options.signal?.aborted) return;
  await options.play(prepared.value, undefined, options.signal);
}
