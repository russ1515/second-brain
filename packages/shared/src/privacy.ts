/** Privacy & GDPR (Sprint 8.7). Consent management, data export (right to
 *  portability) and full account deletion (right to erasure). */

export type ConsentKey = 'analytics' | 'marketing' | 'product_emails';

export const CONSENT_KEYS: readonly ConsentKey[] = [
  'analytics',
  'marketing',
  'product_emails',
] as const;

export interface ConsentView {
  key: ConsentKey;
  granted: boolean;
  updatedAt: string | null;
}

export interface SetConsentRequest {
  key: ConsentKey;
  granted: boolean;
}

/** Confirm account deletion by re-entering the password. */
export interface DeleteAccountRequest {
  password: string;
}

/** Strong confirmation for clearing only the learner's pedagogical space. */
export interface ResetLearningRequest {
  password: string;
  confirmation: 'RÉINITIALISER';
}

export interface LearningResetRequirements {
  mfaRequired: boolean;
}

export interface LearningResetResponse {
  resetAt: string;
  onboardingRequired: true;
}

/** A portable dump of everything the platform holds about the user. */
export interface DataExportResponse {
  generatedAt: string;
  data: Record<string, unknown>;
}
