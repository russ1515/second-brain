import type { SynthesisResult } from '@second-brain/shared';
import { api } from './client';

/**
 * Playing the teacher's voice.
 *
 * NATIVE slot — not wired (it needs expo-av). `speak.web.ts` is what the web
 * build uses. Fails loudly rather than pretending to have spoken.
 */
export const PLAYBACK_SUPPORTED = false;

export async function speak(_text: string, _language?: string): Promise<void> {
  throw new Error(
    'Playing your teacher’s voice is not wired for this platform yet — it currently runs on the web build only.',
  );
}

/** Shared by both platforms: ask the API to voice some text. */
export function synthesize(text: string, language?: string): Promise<SynthesisResult> {
  return api<SynthesisResult>('/speech/tts', {
    method: 'POST',
    body: { text, ...(language ? { language } : {}) },
  });
}

export function stopSpeaking(): void {
  /* nothing playing on this platform */
}
