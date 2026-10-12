/**
 * Code-level activation boundary for the strict proof path.
 *
 * Provider flags and language allowlists only describe configured capability;
 * they cannot prove that the product persists native acoustic evidence or can
 * publish criterion-scoped milestone/pillar completions. A true code-level
 * switch never activates a language by itself: feature flag, concrete provider
 * binding and exact per-language capability/locale gates remain mandatory.
 */
import {
  RLLE_LANGUAGE_MASTERY_MAPPING_AUDIT,
  type LanguageMasterySpeechCoverage,
  type SupportedLanguageCode,
} from '@second-brain/shared';

export const LANGUAGE_MASTERY_RUNTIME_READINESS = {
  // The server path now persists two native-audio modes through the canonical
  // AssessmentSubmission -> mastery journal -> LearningCompletion chain. This
  // says the software bridge exists, not that any provider/language is active:
  // runtime capability, explicit locale allowlists and feature flags still
  // have to pass before the strict path can be enabled.
  nativeAcousticAssessmentIntegrated: true,
  canonicalMilestonePillarPublicationIntegrated: true,
} as const;

export const LANGUAGE_MASTERY_STRICT_RUNTIME_READY =
  LANGUAGE_MASTERY_RUNTIME_READINESS.nativeAcousticAssessmentIntegrated
  && LANGUAGE_MASTERY_RUNTIME_READINESS.canonicalMilestonePillarPublicationIntegrated;

type StrictLanguageMasteryCoverage = Pick<
  LanguageMasterySpeechCoverage,
  | 'transcriptionLanguageCodes'
  | 'synthesisLanguageCodes'
  | 'pronunciationAssessmentLanguageCodes'
> & {
  pronunciationAssessmentLocales?: Partial<Record<SupportedLanguageCode, string>>;
};

/**
 * Single server-authoritative gate shared by the course projection and the
 * direct acoustic endpoint. A client-visible target must never be more
 * restrictive than the endpoint that can spend provider quota or persist
 * mastery evidence.
 */
export function languageMasteryStrictRuntimeAvailable(input: {
  featureEnabled: boolean;
  languageCode: SupportedLanguageCode;
  coverage: StrictLanguageMasteryCoverage | null | undefined;
  supportsSynthesis: boolean;
  supportsPronunciationAssessment: boolean;
  pronunciationAssessmentProvider: string | null;
}): boolean {
  const { coverage, languageCode } = input;
  return Boolean(
    LANGUAGE_MASTERY_STRICT_RUNTIME_READY
    && RLLE_LANGUAGE_MASTERY_MAPPING_AUDIT.activationReady
    && input.featureEnabled
    && coverage
    && input.supportsSynthesis
    && input.supportsPronunciationAssessment
    && Boolean(input.pronunciationAssessmentProvider?.trim())
    && Array.isArray(coverage.transcriptionLanguageCodes)
    && coverage.transcriptionLanguageCodes.includes(languageCode)
    && Array.isArray(coverage.synthesisLanguageCodes)
    && coverage.synthesisLanguageCodes.includes(languageCode)
    && Array.isArray(coverage.pronunciationAssessmentLanguageCodes)
    && coverage.pronunciationAssessmentLanguageCodes.includes(languageCode)
    && coverage.pronunciationAssessmentLocales?.[languageCode]?.trim()
  );
}
