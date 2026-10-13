export const SPEECH_INPUT_FAILURE_CODES = [
  'MIC_PERMISSION',
  'MEDIARECORDER_UNAVAILABLE',
  'AUDIO_RECORDING',
  'AUDIO_UPLOAD',
  'TRANSCODE',
  'STT_UNAVAILABLE',
  'STT_ERROR',
  'ACOUSTIC_UNAVAILABLE',
] as const;

export type SpeechInputFailureCode = (typeof SPEECH_INPUT_FAILURE_CODES)[number];
export type SpeechInputPhase =
  | 'recording'
  | 'upload'
  | 'transcode'
  | 'transcription'
  | 'acoustic';

export interface SpeechInputFailure {
  code: SpeechInputFailureCode;
  message: string;
}

/**
 * Stable, provider-neutral speech-input error. The code is diagnostic only;
 * the UI renders the already-localised message and never exposes provider
 * details to the learner.
 */
export function speechInputError(
  code: SpeechInputFailureCode,
  message: string,
): Error & { code: SpeechInputFailureCode } {
  return Object.assign(new Error(message), { name: 'SpeechInputError', code });
}

/** Keep microphone, recording, transport and STT failures separate. */
export function classifySpeechInputFailure(
  error: unknown,
  phase: SpeechInputPhase,
): SpeechInputFailureCode {
  const knownCode = candidateCode(error);
  if (knownCode?.includes('ACOUSTIC') || knownCode?.includes('PRONUNCIATION_ASSESSMENT')) {
    return 'ACOUSTIC_UNAVAILABLE';
  }
  if (knownCode && (SPEECH_INPUT_FAILURE_CODES as readonly string[]).includes(knownCode)) {
    return knownCode as SpeechInputFailureCode;
  }

  const name = candidateName(error);
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'MIC_PERMISSION';
  if (name === 'NotSupportedError') return 'MEDIARECORDER_UNAVAILABLE';
  if (phase === 'acoustic') return 'ACOUSTIC_UNAVAILABLE';

  const status = candidateStatus(error);
  if (phase === 'transcription') {
    if (status === 0 || status === 413 || name === 'TypeError') return 'AUDIO_UPLOAD';
    if (knownCode === 'SPEECH_TRANSCRIPTION_UNAVAILABLE') return 'STT_UNAVAILABLE';
    return 'STT_ERROR';
  }
  if (phase === 'upload') return 'AUDIO_UPLOAD';
  if (phase === 'transcode') return 'TRANSCODE';
  return 'AUDIO_RECORDING';
}

function candidateCode(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const candidate = error as Record<string, unknown>;
  if (typeof candidate.code === 'string') return candidate.code;
  const payload = candidate.payload;
  if (!payload || typeof payload !== 'object') return null;
  const response = payload as Record<string, unknown>;
  if (typeof response.code === 'string') return response.code;
  if (response.message && typeof response.message === 'object') {
    const nested = response.message as Record<string, unknown>;
    if (typeof nested.code === 'string') return nested.code;
  }
  return null;
}

function candidateName(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null;
  const name = (error as { name?: unknown }).name;
  return typeof name === 'string' ? name : null;
}

function candidateStatus(error: unknown): number | null {
  if (!error || typeof error !== 'object') return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && Number.isFinite(status) ? status : null;
}
