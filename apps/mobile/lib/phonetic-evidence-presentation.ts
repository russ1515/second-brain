import type { PhoneticAssessmentResult } from '@second-brain/shared';
import type { PhoneticAttemptView, PhoneticCapabilityView } from './phonetic-evidence-client';

/** No percentages, raw likelihood rankings, phoneme substitution claims or
 * client mastery decisions. All output is an app-owned translation key. */
const comparisonKeys: Record<string, string> = {
  COMPLETENESS_OBSERVATION_INCREASED: 'phonetic.completenessIncreased',
  COMPLETENESS_OBSERVATION_DECREASED: 'phonetic.completenessDecreased',
  STABLE_OBSERVATIONS: 'phonetic.stableObservations',
  PAUSE_OBSERVATION_CHANGED: 'phonetic.pauseChanged',
};
export const phoneticComparisonKey = (status: string | undefined): string => comparisonKeys[status ?? ''] ?? 'phonetic.insufficient';

const errorKeys: Record<string, string> = {
  MIC_PERMISSION: 'voice.error.micDenied', MIC_PERMISSION_DENIED: 'voice.error.micDenied',
  MEDIARECORDER_UNAVAILABLE: 'voice.error.recordUnsupported',
  EMPTY_RECORDING: 'voice.error.empty', AUDIO_TOO_SHORT: 'phonetic.tooShort',
  AUDIO_TOO_LONG: 'phonetic.tooLong', AUDIO_TOO_LARGE: 'phonetic.tooLong', UNSUPPORTED_AUDIO: 'phonetic.unsupported',
  NO_SPEECH: 'phonetic.noSpeech', ACOUSTIC_ALIGNMENT_FAILED: 'phonetic.alignmentFailed',
  INSUFFICIENT_ACOUSTIC_CONFIDENCE: 'phonetic.insufficient',
  ENGINE_UNAVAILABLE: 'phonetic.engineUnavailable',
  PHONETIC_ENGINE_UNAVAILABLE: 'phonetic.engineUnavailable',
  PHONETIC_ASSESSMENT_DISABLED: 'phonetic.engineUnavailable',
  FEATURE_DISABLED: 'phonetic.engineUnavailable', LOCAL_ENGINE_NOT_CONFIGURED: 'phonetic.engineUnavailable',
  LOCAL_ENGINE_BUSY: 'phonetic.engineUnavailable', ENGINE_READINESS_NOT_VERIFIED: 'phonetic.engineUnavailable',
  ENGINE_READINESS_FAILED: 'phonetic.engineUnavailable', LOCAL_ENGINE_FAILED: 'phonetic.engineUnavailable',
  PHONETIC_ATTEMPT_IN_PROGRESS: 'state.processing', PROCESSING_INTERRUPTED: 'phonetic.engineUnavailable',
};
export function phoneticFailureKey(error: unknown): string {
  const object = error && typeof error === 'object' ? error as Record<string, unknown> : {};
  const payload = object.payload && typeof object.payload === 'object' ? object.payload as Record<string, unknown> : {};
  const nested = payload.message && typeof payload.message === 'object' ? payload.message as Record<string, unknown> : {};
  const code = [object.recordingFailure, object.code, payload.code, nested.code].find((value) => typeof value === 'string' && errorKeys[value]);
  if (typeof code === 'string' && errorKeys[code]) return errorKeys[code];
  if (object.status === 413) return 'phonetic.tooLong';
  if (object.status === 0) return 'error.network';
  if (object.status === 429) return 'error.rateLimit';
  return 'phonetic.requestFailed';
}
export function phoneticResultFailure(result: PhoneticAssessmentResult | null): string | null {
  if (!result) return 'phonetic.engineUnavailable';
  const known = result.errors.find((error) => errorKeys[error.code]);
  if (known) return errorKeys[known.code];
  return result.status === 'EVIDENCE_AVAILABLE' ? null : 'phonetic.insufficient';
}
export function phoneticPanelEnabled(capability: PhoneticCapabilityView | null): boolean {
  return Boolean(capability?.enabled && capability.available
    && capability.capability === 'ACOUSTIC_UNCALIBRATED' && capability.references.length);
}
export function phoneticRecordingFailure(size: number, durationMs: number | undefined,
  bounds: PhoneticCapabilityView['bounds']): string | null {
  if (!size) return 'voice.error.empty';
  if (size > bounds.maxUploadBytes || (durationMs != null && durationMs > bounds.maxDurationMs)) return 'phonetic.tooLong';
  if (durationMs != null && durationMs < bounds.minDurationMs) return 'phonetic.tooShort';
  return null;
}
export function phoneticLessonHistory(attempts: PhoneticAttemptView[], lessonId: string, exerciseIndex: number): PhoneticAttemptView[] {
  return attempts.filter((item) => item.lessonId === lessonId && item.exerciseIndex === exerciseIndex
    && item.masteryEligible === false && item.calibrationStatus === 'UNCALIBRATED')
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
