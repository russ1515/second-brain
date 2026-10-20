import type { LanguagePlacementSummary, LanguageProductLevel } from '@second-brain/shared';

export const LANGUAGE_PRODUCT_LEVEL_COPY: Record<LanguageProductLevel, string> = {
  BEGINNER: 'learn.explain.lvlBeginner',
  INTERMEDIATE: 'learn.explain.lvlIntermediate',
  ADVANCED: 'learn.explain.lvlAdvanced',
};

const SAFE_PLACEMENT_FAILURE_CODES = new Set([
  'PLACEMENT_PROVIDER_UNAVAILABLE', 'PLACEMENT_RESULT_JSON_INVALID', 'PLACEMENT_RESULT_STRUCTURE_INVALID',
  'PLACEMENT_RESULT_QUESTION_IDS_INVALID', 'PLACEMENT_RESULT_SKILL_INVALID', 'PLACEMENT_RESULT_CEFR_INVALID',
  'PLACEMENT_RESULT_CEFR_ABOVE_CEILING', 'PLACEMENT_RESULT_REASON_INVALID', 'PLACEMENT_RESULT_EVIDENCE_INVALID',
  'PLACEMENT_RESULT_SCORE_INVALID', 'PLACEMENT_RESULT_VERDICT_INVALID', 'PLACEMENT_CANONICAL_EVIDENCE_INVALID',
  'PLACEMENT_PERSISTENCE_FAILED', 'PLACEMENT_LEVEL_MAPPING_FAILED', 'PLACEMENT_PASSPORT_WRITE_FAILED',
  'PLACEMENT_STATE_CONFLICT', 'PLACEMENT_UNKNOWN_RUNTIME_ERROR',
]);

/** Show an opaque placement reason alongside the localized client error, never
 * the provider response or arbitrary backend prose. */
export function languagePlacementErrorDetail(cause: unknown): string {
  const error = cause as { message?: string; payload?: { code?: unknown; message?: { code?: unknown } } };
  const candidate = error?.payload?.code ?? error?.payload?.message?.code;
  const code = typeof candidate === 'string' && SAFE_PLACEMENT_FAILURE_CODES.has(candidate) ? candidate : null;
  return [error?.message ?? '', code].filter(Boolean).join(' · ');
}

/** Pure presentation of server evidence, never classification. A compatibility
 * CEFR default on a new profile is not a diagnosed or self-declared level. */
export function languagePlacementLevelLabel(
  placement: LanguagePlacementSummary | null | undefined,
  copy: (key: string) => string,
  legacyDeclaredLevel: string,
  courseNotStarted: boolean,
): string {
  if (placement?.status === 'complete' && placement.productLevel) {
    return copy(LANGUAGE_PRODUCT_LEVEL_COPY[placement.productLevel]);
  }
  if (placement || courseNotStarted) return copy('rlle.ui.course.notEvaluated');
  return `${legacyDeclaredLevel} · ${copy('rlle.ui.course.level.declared')}`;
}
