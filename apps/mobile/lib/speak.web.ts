import { synthesize } from './speech-api';
import type { SynthesisResult } from '@second-brain/shared';
import { tr } from './i18n';
import {
  createNarrationPauseGate,
  playNarrationSegments,
  type NarrationPauseGate,
} from './speech-playback';

export { synthesize };

export const PLAYBACK_SUPPORTED = typeof Audio !== 'undefined';

/** Only one voice at a time — starting a new line must cut the previous one,
 *  not talk over it. */
type ActivePlayback = {
  audio: HTMLAudioElement;
  finish: (error?: Error) => void;
};

let current: ActivePlayback | null = null;
let activeNarration: {
  controller: AbortController;
  pauseGate: NarrationPauseGate;
} | null = null;

export interface SpeakLifecycle {
  signal?: AbortSignal;
  /** Stable for a slow-start retry of the same learner action. */
  requestId?: string;
  /** Measured from the explicit `speak` call until the browser begins playback. */
  onFirstAudio?: (latencyMs: number) => void;
}

export function stopSpeaking(): void {
  activeNarration?.controller.abort();
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
  const narration = activeNarration;
  if (!narration) return false;
  const newlyPaused = narration.pauseGate.pause();
  if (current && !current.audio.paused) current.audio.pause();
  return newlyPaused || Boolean(current?.audio.paused);
}

export async function resumeSpeaking(): Promise<boolean> {
  const narration = activeNarration;
  if (!narration) return false;
  const active = current;
  const narrationWasPaused = narration.pauseGate.paused;
  if (!narrationWasPaused && (!active || !active.audio.paused)) return false;
  narration.pauseGate.resume();
  if (active && active.audio.paused && !active.audio.ended) await active.audio.play();
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
  stopSpeaking();
  const controller = new AbortController();
  const pauseGate = createNarrationPauseGate();
  const narration = { controller, pauseGate };
  activeNarration = narration;
  const cancel = () => controller.abort();
  lifecycle.signal?.addEventListener('abort', cancel, { once: true });
  if (lifecycle.signal?.aborted) controller.abort();

  const startedAt = Date.now();
  let firstAudioReported = false;
  const onFirstAudio = () => {
    if (firstAudioReported || controller.signal.aborted) return;
    firstAudioReported = true;
    lifecycle.onFirstAudio?.(Date.now() - startedAt);
  };

  try {
    await playNarrationSegments(text, {
      signal: controller.signal,
      requestId: lifecycle.requestId,
      onFirstAudio,
      waitUntilPlayable: pauseGate.wait,
      synthesize: (segment, signal, requestId) => synthesize(
        segment,
        language,
        signal,
        requestId,
      ),
      play: playSynthesisSegment,
    });
  } catch (error) {
    // `stopSpeaking()` also owns cancellations triggered by logout/account
    // replacement. They are an expected lifecycle event, not a playback error
    // that should leak into the next learner's UI.
    if (!controller.signal.aborted) throw error;
  } finally {
    lifecycle.signal?.removeEventListener('abort', cancel);
    if (activeNarration === narration) activeNarration = null;
  }
}

/** Play an already-metered voice-turn synthesis without issuing a second TTS
 * request. Oral modes use this after `/tutor/.../voice?speak=true`. */
export async function playSynthesis(result: SynthesisResult): Promise<void> {
  stopSpeaking();
  const controller = new AbortController();
  const pauseGate = createNarrationPauseGate();
  const narration = { controller, pauseGate };
  activeNarration = narration;
  try {
    await pauseGate.wait(controller.signal);
    if (!controller.signal.aborted) {
      await playSynthesisSegment(result, undefined, controller.signal);
    }
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
