/**
 * Code-level activation boundary for the strict proof path.
 *
 * Provider flags and language allowlists only describe configured capability;
 * they cannot prove that the product persists native acoustic evidence or can
 * publish criterion-scoped milestone/pillar completions. Keep these switches
 * false until those exact end-to-end adapters are implemented and verified.
 */
export const LANGUAGE_MASTERY_RUNTIME_READINESS = {
  nativeAcousticAssessmentIntegrated: false,
  canonicalMilestonePillarPublicationIntegrated: false,
} as const;

export const LANGUAGE_MASTERY_STRICT_RUNTIME_READY =
  LANGUAGE_MASTERY_RUNTIME_READINESS.nativeAcousticAssessmentIntegrated
  && LANGUAGE_MASTERY_RUNTIME_READINESS.canonicalMilestonePillarPublicationIntegrated;
