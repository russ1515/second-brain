/** Acoustic observations are not pedagogical grades. This experimental contract
 * is separate from the calibrated native-acoustic mastery transport. */
import { SUPPORTED_LANGUAGES, type SupportedLanguageCode } from './languages';
import { PHONETIC_FEEDBACK_COPY } from './phonetic-feedback-copy';

export const PHONETIC_ENGINE_CONTRACT_VERSION = 'phonetic-evidence-v1' as const;
export const PHONETIC_CAPABILITIES = ['PRACTICE_ONLY', 'ACOUSTIC_UNCALIBRATED', 'CALIBRATED_MASTERY'] as const;
export type PhoneticCapability = (typeof PHONETIC_CAPABILITIES)[number];
export type PhoneticAvailability = 'AVAILABLE' | 'MISSING';
export interface PhoneticCapabilityEntry {
  language: SupportedLanguageCode;
  locale: string | null;
  g2pStatus: PhoneticAvailability;
  phonemeInventoryStatus: PhoneticAvailability;
  alignerStatus: PhoneticAvailability;
  acousticModelStatus: PhoneticAvailability;
  prosodyStatus: PhoneticAvailability;
  calibrationStatus: 'UNCALIBRATED';
  calibrationDataStatus: 'MISSING';
  capability: 'PRACTICE_ONLY' | 'ACOUSTIC_UNCALIBRATED';
  /** Model/lexicon locale, never guessed from UI or target spelling. */
  supportedLocales: readonly string[];
}

/** Runtime readiness must be proven by the installed adapter, not by merely
 * importing this registry. No calibration registration exists in V1. */
export class PhoneticCapabilityRegistry {
  constructor(private readonly englishAdapterVerified = false) {}

  all(): PhoneticCapabilityEntry[] {
    return Object.values(SUPPORTED_LANGUAGES).map(({ code }) => this.get(code));
  }

  get(language: SupportedLanguageCode, locale?: string): PhoneticCapabilityEntry {
    const profiles: Partial<Record<SupportedLanguageCode, { locales: readonly string[]; modelLocale: string }>> = {
      en: { locales: ['en', 'en-US'], modelLocale: 'en-US' },
    };
    const profile = profiles[language];
    const ready = this.englishAdapterVerified && Boolean(profile)
      && (!locale || profile!.locales.some((candidate) => candidate.toLowerCase() === locale.toLowerCase()));
    return {
      language, locale: ready ? profile!.modelLocale : null,
      g2pStatus: ready ? 'AVAILABLE' : 'MISSING',
      phonemeInventoryStatus: ready ? 'AVAILABLE' : 'MISSING',
      alignerStatus: ready ? 'AVAILABLE' : 'MISSING',
      acousticModelStatus: ready ? 'AVAILABLE' : 'MISSING',
      prosodyStatus: 'MISSING', calibrationStatus: 'UNCALIBRATED', calibrationDataStatus: 'MISSING',
      capability: ready ? 'ACOUSTIC_UNCALIBRATED' : 'PRACTICE_ONLY',
      supportedLocales: ready ? profile!.locales : [],
    };
  }
}

export interface PhoneticWordEvidence {
  word: string;
  index: number;
  startMs: number;
  endMs: number;
  rawAcousticScore: number;
  rawAcousticScorePerFrame: number;
  confidence: null;
  phonemeIndexes: number[];
}
export interface PhoneticPhonemeEvidence {
  index: number;
  wordIndex: number;
  /** Canonical IPA, not a model token or a claim about what was spoken. */
  expectedPhoneme: string;
  observed: null;
  bestAlternative: null;
  startMs: number;
  endMs: number;
  rawAcousticScore: number;
  rawAcousticScorePerFrame: number;
  confidence: null;
}
export interface PhoneticFeedback {
  /** An instruction descriptor, not LLM-generated diagnosis or a grade. */
  kind: 'UNCALIBRATED_NOTICE' | 'RECORD_AGAIN' | 'CHECK_MISSING_WORD' | 'PRACTISE_PAUSE' | 'REPEAT_WORD';
  word?: string;
  wordIndex?: number;
  phoneme?: string;
  certainty: 'TECHNICAL_OBSERVATION' | 'TENTATIVE';
  /** App-owned copy, resolved from the persisted path teaching language. */
  message?: string;
}

export interface PhoneticAssessmentResult {
  status: 'EVIDENCE_AVAILABLE' | 'NOT_EVALUABLE' | 'TECHNICAL_ERROR';
  language: string;
  locale: string | null;
  engineVersion: string;
  expectedText: string;
  overallAcousticScore: null;
  accuracyScore: null;
  completenessScore: null;
  fluencyScore: null;
  prosodyScore: null;
  words: PhoneticWordEvidence[];
  phonemes: PhoneticPhonemeEvidence[];
  errors: { code: string; wordIndex?: number; tentative?: boolean }[];
  /** Bounded, JSON-only technical observations; never raw audio or a grade. */
  evidence: Record<string, unknown>;
  confidence: null;
  calibrationStatus: 'UNCALIBRATED';
  masteryEligible: false;
  capability: 'PRACTICE_ONLY' | 'ACOUSTIC_UNCALIBRATED';
  feedback?: PhoneticFeedback[];
  supportLanguageCode?: SupportedLanguageCode;
}

export interface PhoneticPassportSummary {
  capability: 'PRACTICE_ONLY' | 'ACOUSTIC_UNCALIBRATED';
  calibrationStatus: 'UNCALIBRATED';
  masteryEligible: false;
  masteryStatus: 'MASTERY_NOT_VERIFIED';
  /** Number of validated observations in the bounded recent history window,
   * never an unvalidated lifetime total or a mastery score. */
  attemptCount: number;
  historyWindowLimit?: number;
  historyTruncated?: boolean;
  lastAttemptAt: string | null;
  latestAttemptId: string | null;
  /** Most recent usable observation, not a highest-score/mastery selection. */
  latestRelevantAttemptId?: string | null;
  latestAttempt?: {
    id: string;
    lessonId: string;
    exerciseId: string;
    createdAt: string;
    engineVersion: string | null;
    capability: 'PRACTICE_ONLY' | 'ACOUSTIC_UNCALIBRATED';
    evidenceConfidence: null;
    /** Tentative words to retry, never a certified weakness diagnosis. */
    weakWords: string[];
    weakPhonemes: string[];
    completenessObservation: Record<string, unknown> | null;
    fluencyObservation: Record<string, unknown> | null;
  };
  bestMasteryScore: null;
  weakPhonemes: string[];
}

/** Fail-closed bridge: no experimental score, even one called "100", can
 * satisfy a pronunciation mastery gate. Calibration must be a future audited
 * implementation, not a client/provider flag. */
export function phoneticV1MasteryDecision(_result: unknown): {
  verdict: 'NOT_EVALUABLE'; score: null; masteryEligible: false; masteryStatus: 'MASTERY_NOT_VERIFIED';
} {
  return { verdict: 'NOT_EVALUABLE', score: null, masteryEligible: false, masteryStatus: 'MASTERY_NOT_VERIFIED' };
}

export function buildPronunciationFeedback(result: PhoneticAssessmentResult): PhoneticFeedback[] {
  const feedback: PhoneticFeedback[] = [{ kind: 'UNCALIBRATED_NOTICE', certainty: 'TECHNICAL_OBSERVATION' }];
  if (result.status !== 'EVIDENCE_AVAILABLE') {
    return [...feedback, { kind: 'RECORD_AGAIN', certainty: 'TECHNICAL_OBSERVATION' }];
  }
  // Missing-word hypotheses can guide a retry, never certify an error. Raw
  // likelihoods of different phonemes are deliberately NOT ranked as weakness.
  for (const error of result.errors.slice(0, 3)) {
    if (error.code === 'POSSIBLE_OMITTED_WORD' && Number.isInteger(error.wordIndex)) {
      const word = result.expectedText.normalize('NFKC').replace(/’/g, "'")
        .match(/[\p{L}\p{N}]+(?:'[\p{L}\p{N}]+)*/gu)?.[error.wordIndex!];
      if (word) feedback.push({ kind: 'CHECK_MISSING_WORD', word, wordIndex: error.wordIndex, certainty: 'TENTATIVE' });
    }
    if (error.code === 'EXCESSIVE_INTERNAL_PAUSE') {
      feedback.push({ kind: 'PRACTISE_PAUSE', certainty: 'TECHNICAL_OBSERVATION' });
    }
    if (error.code === 'POSSIBLE_PHRASE_MISMATCH') {
      feedback.push({ kind: 'RECORD_AGAIN', certainty: 'TENTATIVE' });
    }
  }
  return feedback;
}

/** Reuses the same evidence descriptors; no paid LLM, grading or new mastery
 * policy. The target word is interpolated verbatim, never translated. */
export class PronunciationFeedbackBuilder {
  build(result: PhoneticAssessmentResult, context: {
    supportLanguageCode: SupportedLanguageCode; targetLanguage: string;
  }): PhoneticFeedback[] {
    const catalogue = PHONETIC_FEEDBACK_COPY[context.supportLanguageCode];
    if (!catalogue) throw new Error('PHONETIC_FEEDBACK_LANGUAGE_UNSUPPORTED');
    return buildPronunciationFeedback(result).map((feedback) => ({
      ...feedback,
      message: catalogue[feedback.kind].replace(/\{word\}/g, () => feedback.word ?? ''),
    }));
  }
}
