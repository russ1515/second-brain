import type { SynthesisResult } from '@second-brain/shared';
import { api } from './client';

const SYNTHESIS_CACHE_TTL_MS = 10 * 60_000;
const SYNTHESIS_CACHE_MAX = 8;
const synthesisCache = new Map<string, { value: SynthesisResult; expiresAt: number }>();
const synthesisInFlight = new Map<string, Promise<SynthesisResult>>();
const synthesisControllers = new Set<AbortController>();
let synthesisCacheGeneration = 0;

/** Cached audio belongs to the currently authenticated learner because the
 * backend quota/cost decision that produced it did. Clear it whenever the
 * account boundary changes so another learner can never reuse that result. */
export function clearSpeechCache(): void {
  synthesisCacheGeneration += 1;
  for (const controller of synthesisControllers) controller.abort();
  synthesisControllers.clear();
  synthesisCache.clear();
  synthesisInFlight.clear();
}

function synthesisKey(text: string, language?: string): string {
  return `${language?.trim().toLowerCase() ?? ''}\u0000${text}`;
}

/** Platform-neutral backend speech seam shared by Web and native playback. */
export function synthesize(
  text: string,
  language?: string,
  signal?: AbortSignal,
  requestId?: string,
): Promise<SynthesisResult> {
  const key = synthesisKey(text, language);
  const cached = synthesisCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return Promise.resolve(cached.value);
  if (cached) synthesisCache.delete(key);

  // Only requests without an owner-provided cancellation signal may share an
  // in-flight promise. Otherwise stopping one narration would abort every
  // caller sharing that promise, and Retry could pick up the already-aborted
  // operation instead of starting a clean request.
  if (!signal) {
    const pending = synthesisInFlight.get(key);
    if (pending) return pending;
  }

  const generation = synthesisCacheGeneration;
  const controller = new AbortController();
  synthesisControllers.add(controller);
  const cancel = () => controller.abort();
  signal?.addEventListener('abort', cancel, { once: true });
  if (signal?.aborted) controller.abort();
  const request = api<SynthesisResult>('/speech/tts', {
    method: 'POST',
    body: { text, ...(language ? { language } : {}) },
    timeoutMs: 60_000,
    signal: controller.signal,
    ...(requestId ? { requestId } : {}),
  }).then((value) => {
    if (generation === synthesisCacheGeneration) {
      synthesisCache.set(key, { value, expiresAt: Date.now() + SYNTHESIS_CACHE_TTL_MS });
      while (synthesisCache.size > SYNTHESIS_CACHE_MAX) {
        const oldest = synthesisCache.keys().next().value as string | undefined;
        if (!oldest) break;
        synthesisCache.delete(oldest);
      }
    }
    return value;
  }).finally(() => {
    signal?.removeEventListener('abort', cancel);
    synthesisControllers.delete(controller);
    if (synthesisInFlight.get(key) === request) synthesisInFlight.delete(key);
  });

  if (!signal) synthesisInFlight.set(key, request);
  return request;
}
