import {
  SUPPORTED_LANGUAGE_CODES,
  type SupportedLanguageCode,
} from './languages';
import { LANGUAGE_MASTERY_POLICY_VERSION } from './language-mastery';

/** Explicit capability contract for the strict language-mastery path. */
export type LanguageOralCapabilityState =
  | 'available'
  | 'runtime-required'
  | 'not-evaluable';

export type LanguageMasteryActivationState =
  | 'legacy'
  | 'available'
  | 'blocked-capability';

export type LanguageOralCapabilityBlocker =
  | 'audio-capture-unavailable'
  | 'transcription-provider-unavailable'
  | 'transcription-language-not-verified'
  | 'synthesis-provider-unavailable'
  | 'synthesis-language-not-verified'
  | 'acoustic-analysis-provider-unavailable'
  | 'acoustic-analysis-language-not-verified';

export interface LanguageMasterySpeechCoverage {
  enabled: boolean;
  policyVersion: typeof LANGUAGE_MASTERY_POLICY_VERSION;
  /** Codes verified operationally for this exact provider/model deployment.
   * A provider accepting a language hint is not, by itself, verification. */
  transcriptionLanguageCodes: SupportedLanguageCode[];
  synthesisLanguageCodes: SupportedLanguageCode[];
  pronunciationAssessmentLanguageCodes: SupportedLanguageCode[];
}

export interface LanguageOralCapabilityMatrix {
  policyVersion: typeof LANGUAGE_MASTERY_POLICY_VERSION;
  languageCode: SupportedLanguageCode;
  activation: LanguageMasteryActivationState;
  /** Browser/native recording permission and hardware are known only at
   * runtime. The runtime-required state is honest before device probing. */
  audioCapture: LanguageOralCapabilityState;
  transcription: LanguageOralCapabilityState;
  spokenContentEvaluation: LanguageOralCapabilityState;
  listeningComprehensionEvaluation: LanguageOralCapabilityState;
  orthographyGraphyEvaluation: LanguageOralCapabilityState;
  pronunciationAssessment: LanguageOralCapabilityState;
  fullPathCanBeCompleted: boolean;
  blockers: LanguageOralCapabilityBlocker[];
}

export interface LanguageOralCapabilityInput {
  featureEnabled: boolean;
  languageCode: SupportedLanguageCode;
  provider: {
    transcription: boolean;
    synthesis: boolean;
    audioAnalysis: boolean;
  };
  coverage: Pick<
    LanguageMasterySpeechCoverage,
    | 'transcriptionLanguageCodes'
    | 'synthesisLanguageCodes'
    | 'pronunciationAssessmentLanguageCodes'
  >;
  /** null/undefined means the client has not probed the device yet. */
  audioCapture?: boolean | null;
}

function verified(
  codes: readonly SupportedLanguageCode[],
  languageCode: SupportedLanguageCode,
): boolean {
  return codes.includes(languageCode);
}

/**
 * Resolve the strict path without guessing provider language coverage.
 * Missing acoustic assessment always blocks activation; it is never replaced
 * by STT accuracy, written work or learner self-declaration.
 */
export function languageOralCapabilityMatrix(
  input: LanguageOralCapabilityInput,
): LanguageOralCapabilityMatrix {
  const blockers: LanguageOralCapabilityBlocker[] = [];
  const audioCapture: LanguageOralCapabilityState = input.audioCapture === true
    ? 'available'
    : input.audioCapture === false
      ? 'not-evaluable'
      : 'runtime-required';

  if (input.audioCapture === false) blockers.push('audio-capture-unavailable');

  let transcription: LanguageOralCapabilityState = 'available';
  if (!input.provider.transcription) {
    transcription = 'not-evaluable';
    blockers.push('transcription-provider-unavailable');
  } else if (!verified(input.coverage.transcriptionLanguageCodes, input.languageCode)) {
    transcription = 'not-evaluable';
    blockers.push('transcription-language-not-verified');
  }

  let listeningComprehensionEvaluation: LanguageOralCapabilityState = 'available';
  if (!input.provider.synthesis) {
    listeningComprehensionEvaluation = 'not-evaluable';
    blockers.push('synthesis-provider-unavailable');
  } else if (!verified(input.coverage.synthesisLanguageCodes, input.languageCode)) {
    listeningComprehensionEvaluation = 'not-evaluable';
    blockers.push('synthesis-language-not-verified');
  }

  let pronunciationAssessment: LanguageOralCapabilityState = 'available';
  if (!input.provider.audioAnalysis) {
    pronunciationAssessment = 'not-evaluable';
    blockers.push('acoustic-analysis-provider-unavailable');
  } else if (!verified(input.coverage.pronunciationAssessmentLanguageCodes, input.languageCode)) {
    pronunciationAssessment = 'not-evaluable';
    blockers.push('acoustic-analysis-language-not-verified');
  }

  // Spoken-content evaluation is based on the transcript and stays distinct
  // from acoustic pronunciation assessment.
  const spokenContentEvaluation = transcription;
  const providerPathAvailable = transcription === 'available'
    && listeningComprehensionEvaluation === 'available'
    && pronunciationAssessment === 'available';
  // A provider path alone is not a complete learner path. Until this device
  // has actually obtained microphone permission, completion is NOT_VERIFIED.
  const fullPathCanBeCompleted = providerPathAvailable && audioCapture === 'available';

  return {
    policyVersion: LANGUAGE_MASTERY_POLICY_VERSION,
    languageCode: input.languageCode,
    activation: !input.featureEnabled
      ? 'legacy'
      : providerPathAvailable
        ? 'available'
        : 'blocked-capability',
    audioCapture,
    transcription,
    spokenContentEvaluation,
    listeningComprehensionEvaluation,
    orthographyGraphyEvaluation: 'available',
    pronunciationAssessment,
    fullPathCanBeCompleted,
    blockers,
  };
}

/** Safe parser for operational allowlists. Unknown/duplicate codes are ignored
 * rather than silently treated as verified. */
export function verifiedLanguageCodes(
  values: readonly string[] | string | null | undefined,
): SupportedLanguageCode[] {
  const candidates = Array.isArray(values)
    ? values
    : typeof values === 'string'
      ? values.split(',')
      : [];
  const wanted = new Set(candidates.map((value) => value.trim()).filter(Boolean));
  return SUPPORTED_LANGUAGE_CODES.filter((code) => wanted.has(code));
}
