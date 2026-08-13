import { synthesize } from './speak';

export { synthesize };

export const PLAYBACK_SUPPORTED = typeof Audio !== 'undefined';

/** Only one voice at a time — starting a new line must cut the previous one,
 *  not talk over it. */
let current: HTMLAudioElement | null = null;

export function stopSpeaking(): void {
  if (current) {
    current.pause();
    current.src = '';
    current = null;
  }
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

  const audio = new Audio(`data:${result.mimeType};base64,${result.audioBase64}`);
  current = audio;

  await new Promise<void>((resolve, reject) => {
    audio.onended = () => {
      if (current === audio) current = null;
      resolve();
    };
    audio.onerror = () => {
      if (current === audio) current = null;
      reject(new Error('Could not play your teacher’s voice.'));
    };
    audio.play().catch((e) => {
      // Browsers block autoplay until the user has interacted; every caller
      // here is behind a tap, so surface anything else honestly.
      if (current === audio) current = null;
      reject(e instanceof Error ? e : new Error('Playback was blocked.'));
    });
  });
}
