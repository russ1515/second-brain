import type { LanguagePlacementSummary, LanguageProductLevel } from '@second-brain/shared';

export const LANGUAGE_PRODUCT_LEVEL_COPY: Record<LanguageProductLevel, string> = {
  BEGINNER: 'learn.explain.lvlBeginner',
  INTERMEDIATE: 'learn.explain.lvlIntermediate',
  ADVANCED: 'learn.explain.lvlAdvanced',
};

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
