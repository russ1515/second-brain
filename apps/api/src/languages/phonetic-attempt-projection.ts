import { toSupportedLanguage, type PhoneticAssessmentResult, type PhoneticPassportSummary,
  type SupportedLanguageCode } from '@second-brain/shared';
import type { PrismaService } from '../prisma/prisma.service';

export const PHONETIC_ATTEMPT_INTENT = 'language-phonetic-attempt';
export const PHONETIC_ATTEMPT_KEY_PREFIX = 'server:v2:phonetic:';

export interface StoredPhoneticAttempt {
  schemaVersion: 1;
  source: 'server-phonetic-v1';
  profileId: string;
  lessonId: string;
  exerciseIndex: number;
  contentVersion: number;
  targetLanguage: string;
  supportLanguageCode?: SupportedLanguageCode;
  locale: string;
  expectedText: string;
  inputHash: string;
  state: 'processing' | 'complete' | 'technical_error';
  result: PhoneticAssessmentResult | null;
  audioRetained: false;
  /** Server-owned lineage; word retries never replace the full phrase. */
  parentAttemptId?: string;
  targetWordIndex?: number;
  failureCode?: 'PROCESSING_INTERRUPTED' | 'ENGINE_ERROR';
}

export interface PhoneticRetryTarget {
  wordIndex: number;
  word: string;
  certainty: 'TENTATIVE';
  reason: 'POSSIBLE_OMITTED_WORD';
}

export interface PhoneticAttemptComparison {
  previousAttemptId: string;
  status: 'NOT_COMPARABLE' | 'STABLE_OBSERVATIONS' | 'COMPLETENESS_OBSERVATION_INCREASED'
    | 'COMPLETENESS_OBSERVATION_DECREASED' | 'PAUSE_OBSERVATION_CHANGED';
  /** Device/environment equivalence has not been measured. Never a quality grade. */
  microphoneComparable: false;
  masteryEligible: false;
}

export interface PhoneticAttemptView {
  id: string;
  profileId: string;
  lessonId: string;
  exerciseIndex: number;
  contentVersion: number;
  language: string;
  requestedLocale: string;
  supportLanguageCode?: SupportedLanguageCode;
  state: StoredPhoneticAttempt['state'];
  createdAt: string;
  calibrationStatus: 'UNCALIBRATED';
  masteryEligible: false;
  masteryStatus: 'MASTERY_NOT_VERIFIED';
  audioRetained: false;
  result: PhoneticAssessmentResult | null;
  exerciseId: string;
  parentAttemptId: string | null;
  targetWordIndex: number | null;
  retryTargets: PhoneticRetryTarget[];
  comparison?: PhoneticAttemptComparison;
  failureCode?: StoredPhoneticAttempt['failureCode'];
}

interface PhoneticSessionRow {
  id: string;
  userId: string;
  languageProfileId: string | null;
  lessonId: string | null;
  currentStep: unknown;
  idempotencyKey: string | null;
  startedAt: Date;
}

/** Only this server namespace and matching owned foreign keys can represent an
 * observation. A generic session's client-controlled JSON is never evidence. */
export function readPhoneticAttempt(
  row: PhoneticSessionRow, userId: string, profileId: string,
): PhoneticAttemptView | null {
  if (row.userId !== userId || row.languageProfileId !== profileId
    || !row.idempotencyKey?.startsWith(PHONETIC_ATTEMPT_KEY_PREFIX)) return null;
  const step = record(row.currentStep);
  const state = record(record(step?.metadata)?.phoneticAssessment);
  if (state?.schemaVersion !== 1 || state.source !== 'server-phonetic-v1'
    || state.profileId !== profileId || typeof state.lessonId !== 'string'
    || state.lessonId !== row.lessonId || state.audioRetained !== false
    || !Number.isInteger(state.exerciseIndex) || Number(state.exerciseIndex) < 0
    || !Number.isInteger(state.contentVersion) || Number(state.contentVersion) < 1
    || typeof state.targetLanguage !== 'string' || typeof state.locale !== 'string'
    || typeof state.expectedText !== 'string' || state.expectedText.length > 500
    || (state.parentAttemptId !== undefined && (typeof state.parentAttemptId !== 'string'
      || state.parentAttemptId.length > 200 || !Number.isInteger(state.targetWordIndex)
      || Number(state.targetWordIndex) < 0 || Number(state.targetWordIndex) > 127))
    || (state.targetWordIndex !== undefined && state.parentAttemptId === undefined)
    || typeof state.inputHash !== 'string' || !/^[a-f0-9]{64}$/.test(state.inputHash)
    || !['processing', 'complete', 'technical_error'].includes(String(state.state))) return null;
  const result = state.result === null ? null : record(state.result);
  if (result && (result.calibrationStatus !== 'UNCALIBRATED' || result.masteryEligible !== false
    || result.confidence !== null || typeof result.engineVersion !== 'string' || result.engineVersion.length > 120
    || result.expectedText !== state.expectedText || result.language !== state.targetLanguage
    || !Array.isArray(result.errors) || result.errors.length > 128
    || !Array.isArray(result.words) || result.words.length > 128
    || !Array.isArray(result.phonemes) || result.phonemes.length > 1024 || !record(result.evidence)
    || !['EVIDENCE_AVAILABLE', 'NOT_EVALUABLE', 'TECHNICAL_ERROR'].includes(String(result.status))
    || !['PRACTICE_ONLY', 'ACOUSTIC_UNCALIBRATED'].includes(String(result.capability))
    || ['overallAcousticScore', 'accuracyScore', 'completenessScore', 'fluencyScore', 'prosodyScore']
      .some((name) => result[name] !== null))) return null;
  if (state.state === 'complete' && !result) return null;
  return {
    id: row.id, profileId, lessonId: state.lessonId,
    exerciseIndex: Number(state.exerciseIndex), contentVersion: Number(state.contentVersion),
    language: state.targetLanguage, requestedLocale: state.locale,
    ...(typeof state.supportLanguageCode === 'string' && toSupportedLanguage(state.supportLanguageCode)
      ? { supportLanguageCode: toSupportedLanguage(state.supportLanguageCode)! } : {}),
    state: state.state as StoredPhoneticAttempt['state'], createdAt: row.startedAt.toISOString(),
    calibrationStatus: 'UNCALIBRATED', masteryEligible: false,
    masteryStatus: 'MASTERY_NOT_VERIFIED', audioRetained: false,
    result: result as unknown as PhoneticAssessmentResult | null,
    exerciseId: `${state.lessonId}:v${state.contentVersion}:${state.exerciseIndex}`,
    parentAttemptId: typeof state.parentAttemptId === 'string' ? state.parentAttemptId : null,
    targetWordIndex: Number.isInteger(state.targetWordIndex) ? Number(state.targetWordIndex) : null,
    retryTargets: state.parentAttemptId ? [] : phoneticRetryTargets(result as unknown as PhoneticAssessmentResult | null),
    ...(['PROCESSING_INTERRUPTED', 'ENGINE_ERROR'].includes(String(state.failureCode))
      ? { failureCode: state.failureCode as StoredPhoneticAttempt['failureCode'] } : {}),
  };
}

/** Only a bounded server-returned tentative omission can suggest a word retry.
 * Forced-alignment likelihoods are never ranked as weak words/phonemes. */
export function phoneticRetryTargets(result: PhoneticAssessmentResult | null): PhoneticRetryTarget[] {
  if (!result || result.status !== 'EVIDENCE_AVAILABLE') return [];
  const words = result.expectedText.normalize('NFKC').replace(/’/g, "'")
    .match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu) ?? [];
  const seen = new Set<number>();
  return result.errors.slice(0, 128).flatMap((error) => {
    const index = error.wordIndex;
    if (error.code !== 'POSSIBLE_OMITTED_WORD' || error.tentative !== true
      || !Number.isInteger(index) || !words[index!] || seen.has(index!)) return [];
    seen.add(index!);
    return [{ wordIndex: index!, word: words[index!]!, certainty: 'TENTATIVE' as const,
      reason: 'POSSIBLE_OMITTED_WORD' as const }];
  }).slice(0, 10);
}

/** Compare observable counts/timing only when reference, model and version
 * match exactly. Even then microphone/accent/quality are not comparable. */
export function comparePhoneticAttempts(
  current: PhoneticAttemptView, previous: PhoneticAttemptView,
): PhoneticAttemptComparison {
  const comparison: PhoneticAttemptComparison = { previousAttemptId: previous.id,
    status: 'NOT_COMPARABLE', microphoneComparable: false, masteryEligible: false };
  const a = current.result; const b = previous.result;
  if (!a || !b || a.status !== 'EVIDENCE_AVAILABLE' || b.status !== 'EVIDENCE_AVAILABLE'
    || current.lessonId !== previous.lessonId || current.exerciseId !== previous.exerciseId
    || current.targetWordIndex !== previous.targetWordIndex || a.expectedText !== b.expectedText
    || a.engineVersion !== b.engineVersion || a.locale !== b.locale) return comparison;
  const am = record(a.evidence.model); const bm = record(b.evidence.model);
  if (!am || !bm || !am.modelArtifactSha256 || !am.lexiconSha256
    || am.modelArtifactSha256 !== bm.modelArtifactSha256 || am.lexiconSha256 !== bm.lexiconSha256) return comparison;
  const ac = record(a.evidence.completeness); const bc = record(b.evidence.completeness);
  const validCounts = (observation: Record<string, unknown> | null, reference: string) => {
    if (!observation) return false;
    const expected = reference.normalize('NFKC').replace(/’/g, "'")
      .match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu)?.length ?? 0;
    const expectedCount = observation.expectedCount; const observedCount = observation.observedCount;
    const matchedCount = observation.matchedCount;
    return expected > 0 && expected <= 128 && expectedCount === expected
      && typeof observedCount === 'number' && Number.isInteger(observedCount)
      && observedCount >= 0 && observedCount <= 384
      && typeof matchedCount === 'number' && Number.isInteger(matchedCount)
      && matchedCount >= 0 && matchedCount <= Math.min(expected, observedCount);
  };
  if (ac?.status !== 'EVIDENCE_AVAILABLE' || bc?.status !== 'EVIDENCE_AVAILABLE'
    || ac.method !== bc.method || ac.expectedCount !== bc.expectedCount
    || !validCounts(ac, a.expectedText) || !validCounts(bc, b.expectedText)
    || typeof ac.matchedCount !== 'number' || typeof bc.matchedCount !== 'number') return comparison;
  comparison.status = ac.matchedCount > bc.matchedCount ? 'COMPLETENESS_OBSERVATION_INCREASED'
    : ac.matchedCount < bc.matchedCount ? 'COMPLETENESS_OBSERVATION_DECREASED' : 'STABLE_OBSERVATIONS';
  if (comparison.status === 'STABLE_OBSERVATIONS') {
    const af = record(a.evidence.fluency); const bf = record(b.evidence.fluency);
    if (af?.status === 'EVIDENCE_AVAILABLE' && bf?.status === 'EVIDENCE_AVAILABLE'
      && af.method === bf.method && typeof af.totalPauseMs === 'number'
      && typeof bf.totalPauseMs === 'number' && af.totalPauseMs !== bf.totalPauseMs) {
      comparison.status = 'PAUSE_OBSERVATION_CHANGED';
    }
  }
  return comparison;
}

export function withPhoneticAttemptComparisons(attempts: PhoneticAttemptView[]): PhoneticAttemptView[] {
  return attempts.map((attempt, index) => {
    const previous = attempts.slice(index + 1).find((candidate) => candidate.exerciseId === attempt.exerciseId
      && candidate.targetWordIndex === attempt.targetWordIndex);
    return previous ? { ...attempt, comparison: comparePhoneticAttempts(attempt, previous) } : attempt;
  });
}

/** Read-only Passport addition. No score aggregation or "best mastery" policy
 * is invented for an uncalibrated engine. Historical attempts stay separate. */
export async function loadPhoneticPassportSummary(
  prisma: PrismaService, userId: string, profileId: string,
): Promise<PhoneticPassportSummary | null> {
  const where = { userId, languageProfileId: profileId, type: 'language' as const,
    intent: PHONETIC_ATTEMPT_INTENT,
    idempotencyKey: { startsWith: PHONETIC_ATTEMPT_KEY_PREFIX } };
  const rows = await prisma.experienceSession.findMany({
    where, orderBy: { startedAt: 'desc' }, take: 30,
    select: { id: true, userId: true, languageProfileId: true, lessonId: true,
      currentStep: true, startedAt: true, idempotencyKey: true },
  });
  const attempts = rows.flatMap((row) => {
    const attempt = readPhoneticAttempt(row, userId, profileId);
    return attempt ? [attempt] : [];
  });
  if (!attempts.length) return null;
  const storedClaimCount = await prisma.experienceSession.count({ where });
  return {
    capability: attempts.some((attempt) => attempt.result?.status === 'EVIDENCE_AVAILABLE')
      ? 'ACOUSTIC_UNCALIBRATED' : 'PRACTICE_ONLY',
    calibrationStatus: 'UNCALIBRATED', masteryEligible: false,
    masteryStatus: 'MASTERY_NOT_VERIFIED', attemptCount: attempts.length,
    historyWindowLimit: 30, historyTruncated: storedClaimCount > 30,
    lastAttemptAt: attempts[0]!.createdAt, latestAttemptId: attempts[0]!.id,
    latestRelevantAttemptId: attempts.find((attempt) => attempt.result?.status === 'EVIDENCE_AVAILABLE')?.id ?? null,
    latestAttempt: {
      id: attempts[0]!.id, lessonId: attempts[0]!.lessonId, exerciseId: attempts[0]!.exerciseId,
      createdAt: attempts[0]!.createdAt, engineVersion: attempts[0]!.result?.engineVersion ?? null,
      capability: attempts[0]!.result?.capability ?? 'PRACTICE_ONLY', evidenceConfidence: null,
      weakWords: attempts[0]!.retryTargets.map((target) => target.word), weakPhonemes: [],
      completenessObservation: passportObservation(attempts[0]!.result?.evidence.completeness,
        ['status', 'method', 'tentative', 'confidence', 'expectedCount', 'observedCount', 'matchedCount']),
      fluencyObservation: passportObservation(attempts[0]!.result?.evidence.fluency,
        ['status', 'method', 'tentative', 'confidence', 'pauseCount', 'totalPauseMs', 'speechSpanMs']),
    },
    bestMasteryScore: null,
    // Forced alignment alone cannot prove a phoneme is weak. Keep this empty
    // until contrastive diagnosis is genuinely available and calibrated.
    weakPhonemes: [],
  };
}

function passportObservation(value: unknown, keys: string[]): Record<string, unknown> | null {
  const source = record(value);
  if (!source) return null;
  return Object.fromEntries(keys.flatMap((key) => source[key] === null || ['string', 'number', 'boolean'].includes(typeof source[key])
    ? [[key, source[key]]] : []));
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
