import type { PhoneticAssessmentResult, PhoneticCapability } from '@second-brain/shared';
import { api, apiUpload } from './client';
import type { Recording } from './recorder';

/** Experimental observations use the authenticated API, never a public model
 * endpoint. Reference text, target words and mastery flags are not submitted. */
export interface PhoneticReference {
  lessonId: string;
  exerciseIndex: number;
  referenceText: string;
}
export interface PhoneticCapabilityView {
  enabled: boolean;
  available: boolean;
  capability: PhoneticCapability;
  diagnosticStatus: 'INSUFFICIENT_ACOUSTIC_CONFIDENCE' | 'AVAILABLE';
  references: PhoneticReference[];
  bounds: { minDurationMs: number; maxDurationMs: number; maxUploadBytes: number };
  reason?: string;
}
export interface PhoneticAttemptView {
  id: string;
  profileId: string;
  lessonId: string;
  exerciseIndex: number;
  contentVersion: number;
  language: string;
  requestedLocale: string;
  supportLanguageCode?: string;
  state: 'processing' | 'complete' | 'technical_error';
  createdAt: string;
  calibrationStatus: 'UNCALIBRATED';
  masteryEligible: false;
  masteryStatus: 'MASTERY_NOT_VERIFIED';
  audioRetained: false;
  result: PhoneticAssessmentResult | null;
  parentAttemptId?: string | null;
  targetWordIndex?: number | null;
  retryTargets?: { wordIndex: number; word: string; certainty: 'TENTATIVE'; reason: 'POSSIBLE_OMITTED_WORD' }[];
  comparison?: {
    previousAttemptId: string;
    status: 'NOT_COMPARABLE' | 'STABLE_OBSERVATIONS' | 'COMPLETENESS_OBSERVATION_INCREASED'
      | 'COMPLETENESS_OBSERVATION_DECREASED' | 'PAUSE_OBSERVATION_CHANGED';
    microphoneComparable: false;
    masteryEligible: false;
  } | null;
}
const path = (profileId: string) => `/languages/${encodeURIComponent(profileId)}/phonetic-attempts`;
export const loadPhoneticCapability = (profileId: string, lessonId: string): Promise<PhoneticCapabilityView> =>
  api(`${path(profileId)}/capability?lessonId=${encodeURIComponent(lessonId)}`);
export const loadPhoneticAttempts = (profileId: string): Promise<PhoneticAttemptView[]> => api(path(profileId));

export function submitPhoneticRecording(profileId: string, reference: PhoneticReference,
  recording: Recording, idempotencyKey: string,
  retry?: { parentAttemptId: string; targetWordIndex: number }): Promise<PhoneticAttemptView> {
  const form = new FormData();
  const extension = recording.mimeType.includes('webm') ? 'webm'
    : recording.mimeType.includes('ogg') ? 'ogg'
      : recording.mimeType.includes('wav') ? 'wav' : 'm4a';
  form.append('audio', recording.blob, `pronunciation.${extension}`);
  form.append('lessonId', reference.lessonId);
  form.append('exerciseIndex', String(reference.exerciseIndex));
  form.append('idempotencyKey', idempotencyKey);
  if (retry) {
    form.append('parentAttemptId', retry.parentAttemptId);
    form.append('targetWordIndex', String(retry.targetWordIndex));
  }
  return apiUpload(path(profileId), form);
}
