import type { SynthesisResult } from '@second-brain/shared';
import { api } from './client';

/** Platform-neutral backend speech seam shared by Web and native playback. */
export function synthesize(text: string, language?: string): Promise<SynthesisResult> {
  return api<SynthesisResult>('/speech/tts', {
    method: 'POST',
    body: { text, ...(language ? { language } : {}) },
    timeoutMs: 60_000,
  });
}
