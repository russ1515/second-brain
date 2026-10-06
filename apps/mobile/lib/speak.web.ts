import { synthesize } from './speech-api';
import type { SynthesisResult } from '@second-brain/shared';
import { tr } from './i18n';

export { synthesize };

export const PLAYBACK_SUPPORTED = typeof Audio !== 'undefined';

/** Only one voice at a time — starting a new line must cut the previous one,
 *  not talk over it. */
type ActivePlayback = {
  audio: HTMLAudioElement;
  finish: (error?: Error) => void;
};

let current: ActivePlayback | null = null;

export function stopSpeaking(): void {
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
export async function speak(text: string, language?: string): Promise<void> {
  stopSpeaking();
  const result = await synthesize(text, language);
  await playSynthesis(result);
}

/** Play an already-metered voice-turn synthesis without issuing a second TTS
 * request. Oral modes use this after `/tutor/.../voice?speak=true`. */
export async function playSynthesis(result: SynthesisResult): Promise<void> {
  stopSpeaking();

  const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (current?.audio === audio) current = null;
      audio.onended = null;
      audio.onerror = null;
      if (error) reject(error);
      else resolve();
    };
    current = { audio, finish };
    audio.onended = () => finish();
    audio.onerror = () => finish(new Error(tr('voice.error.playback')));
    audio.play().catch((e) => {
      // Browsers block autoplay until the user has interacted; every caller
      // here is behind a tap, so surface anything else honestly.
      finish(e instanceof Error ? e : new Error(tr('voice.error.blocked')));
    });
  });
}
