import { synthesize } from './speech-api';
import type { SynthesisResult } from '@second-brain/shared';
import { tr } from './i18n';
import { LIGHT_PREFETCH_MAX, narrationSegments } from './speech-playback';

export { synthesize };

export const PLAYBACK_SUPPORTED = typeof Audio !== 'undefined';

/** Only one voice at a time — starting a new line must cut the previous one,
 *  not talk over it. */
type ActivePlayback = {
  audio: HTMLAudioElement;
  finish: (error?: Error) => void;
};

let current: ActivePlayback | null = null;
let activeNarration: AbortController | null = null;

export interface SpeakLifecycle {
  signal?: AbortSignal;
  /** Stable for a slow-start retry of the same learner action. */
  requestId?: string;
  /** Measured from the explicit `speak` call until the browser begins playback. */
  onFirstAudio?: (latencyMs: number) => void;
}

export function stopSpeaking(): void {
  activeNarration?.abort();
  activeNarration = null;
  stopPlayback();
}

function stopPlayback(): void {
  const active = current;
  current = null;
  if (!active) return;
  active.audio.pause();
  active.audio.src = '';
  active.finish();
}

export function pauseSpeaking(): boolean {
  if (!current || current.audio.paused) return false;
  current.audio.pause();
  return true;
}

export async function resumeSpeaking(): Promise<boolean> {
  if (!current || !current.audio.paused) return false;
  await current.audio.play();
  return true;
}

/**
 * Have the teacher read `text` aloud.
 *
 * Resolves when playback FINISHES, so callers can keep a speaking indicator
 * honest instead of clearing it the moment the request returns.
 */
export async function speak(
  text: string,
  language?: string,
  lifecycle: SpeakLifecycle = {},
): Promise<void> {
  const { lead, tail } = narrationSegments(text);
  stopSpeaking();
  const narration = new AbortController();
  activeNarration = narration;
  const cancel = () => narration.abort();
  lifecycle.signal?.addEventListener('abort', cancel, { once: true });
  if (lifecycle.signal?.aborted) narration.abort();

  const startedAt = Date.now();
  const leadRequestId = lifecycle.requestId ? `${lifecycle.requestId}:lead` : undefined;
  const tailRequestId = lifecycle.requestId ? `${lifecycle.requestId}:tail` : undefined;
  let tailRequest: Promise<{ value: SynthesisResult | null; error: unknown }> | null = null;
  let firstAudioReported = false;
  const onFirstAudio = () => {
    if (firstAudioReported || narration.signal.aborted) return;
    firstAudioReported = true;
    lifecycle.onFirstAudio?.(Date.now() - startedAt);
  };

  try {
    const first = await synthesize(lead, language, narration.signal, leadRequestId);
    if (narration.signal.aborted) return;
    // One bounded continuation only. Starting it after the lead is ready keeps
    // the first provider call prioritised while hiding most of the next wait.
    if (tail && tail.length <= LIGHT_PREFETCH_MAX) {
      tailRequest = synthesize(tail, language, narration.signal, tailRequestId).then(
        (value) => ({ value, error: null }),
        (error) => ({ value: null, error }),
      );
    }
    await playSynthesisSegment(first, onFirstAudio, narration.signal);
    if (!tail || narration.signal.aborted) return;
    const prepared = await (tailRequest ?? synthesize(
      tail,
      language,
      narration.signal,
      tailRequestId,
    ).then(
      (value) => ({ value, error: null }),
      (error) => ({ value: null, error }),
    ));
    if (prepared.error) throw prepared.error;
    const remainder = prepared.value;
    if (!remainder) throw new Error(tr('voice.error.playback'));
    if (narration.signal.aborted) return;
    await playSynthesisSegment(remainder, undefined, narration.signal);
  } catch (error) {
    // `stopSpeaking()` also owns cancellations triggered by logout/account
    // replacement. They are an expected lifecycle event, not a playback error
    // that should leak into the next learner's UI.
    if (!narration.signal.aborted) throw error;
  } finally {
    lifecycle.signal?.removeEventListener('abort', cancel);
    if (activeNarration === narration) activeNarration = null;
  }
}

/** Play an already-metered voice-turn synthesis without issuing a second TTS
 * request. Oral modes use this after `/tutor/.../voice?speak=true`. */
export async function playSynthesis(result: SynthesisResult): Promise<void> {
  stopSpeaking();
  const narration = new AbortController();
  activeNarration = narration;
  try {
    await playSynthesisSegment(result, undefined, narration.signal);
  } finally {
    if (activeNarration === narration) activeNarration = null;
  }
}

async function playSynthesisSegment(
  result: SynthesisResult,
  onPlaybackStart?: () => void,
  signal?: AbortSignal,
): Promise<void> {
  stopPlayback();
  if (signal?.aborted) return;

  const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (current?.audio === audio) current = null;
      audio.onended = null;
      audio.onerror = null;
      audio.onplaying = null;
      signal?.removeEventListener('abort', cancel);
      if (error) reject(error);
      else resolve();
    };
    const cancel = () => {
      audio.pause();
      audio.src = '';
      finish();
    };
    let started = false;
    const markStarted = () => {
      if (started) return;
      started = true;
      onPlaybackStart?.();
    };
    current = { audio, finish };
    audio.onplaying = markStarted;
    audio.onended = () => finish();
    audio.onerror = () => finish(new Error(tr('voice.error.playback')));
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) {
      cancel();
      return;
    }
    audio.play()
      .then(markStarted)
      .catch((e) => {
        // Browsers block autoplay until the user has interacted; every caller
        // here is behind a tap, so surface anything else honestly.
        finish(e instanceof Error ? e : new Error(tr('voice.error.blocked')));
      });
  });
}
