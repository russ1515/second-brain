import { buildLanguageLearningCatalogue, toSupportedLanguage, type LanguagePlacementSummary, type SupportedLanguageCode } from '@second-brain/shared';

/** Do not replace a functioning legacy course with an unfinished catalogue.
 * This only selects a presentation: it never classifies or grants mastery. */
export function hasCompleteLanguageCoreCatalogue(
  profile: { languageCode: SupportedLanguageCode | null; language: string },
  placement: LanguagePlacementSummary | null | undefined,
): boolean {
  if (placement?.status !== 'complete' || !placement.productLevel || !placement.globalLevel) return false;
  const languageCode = profile.languageCode ?? toSupportedLanguage(profile.language);
  if (!languageCode) return false;
  return buildLanguageLearningCatalogue({ languageCode, productLevel: placement.productLevel,
    cefrLevel: placement.globalLevel === 'PRE_A1' ? 'A1' : placement.globalLevel,
  }).curriculumStatus === 'COMPLETE';
}
