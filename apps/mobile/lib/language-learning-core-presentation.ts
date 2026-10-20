import { buildLanguageLearningCatalogue, toSupportedLanguage, type LanguageLearningCoreView, type LanguageLearningLessonView, type LanguageLearningModuleView, type LanguagePlacementSummary, type SupportedLanguageCode } from '@second-brain/shared';

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

export type LanguageCoreLessonSelection =
  | { kind: 'selected'; module: LanguageLearningModuleView; lesson: LanguageLearningLessonView }
  | { kind: 'none' }
  | { kind: 'invalid'; code: 'COURSE_MODULE_NOT_FOUND' | 'COURSE_LESSON_NOT_FOUND' | 'COURSE_LESSON_LOCKED' | 'COURSE_MODULE_LESSON_MISMATCH' };

/** A URL selects an existing server definition; it never unlocks a lesson or
 * substitutes another lesson when a stale/invalid deep link is supplied. */
export function selectLanguageCoreLesson(core: LanguageLearningCoreView, requestedModuleId?: string, requestedLessonId?: string): LanguageCoreLessonSelection {
  const lessonId = requestedLessonId ?? core.currentLessonId ?? core.nextAction.lessonId;
  const requestedModule = requestedModuleId ? core.modules.find((module) => module.id === requestedModuleId) : undefined;
  if (requestedModuleId && !requestedModule) return { kind: 'invalid', code: 'COURSE_MODULE_NOT_FOUND' };
  if (!lessonId) return requestedModuleId ? { kind: 'invalid', code: 'COURSE_LESSON_NOT_FOUND' } : { kind: 'none' };
  const module = core.modules.find((entry) => entry.lessons.some((lesson) => lesson.id === lessonId));
  const lesson = module?.lessons.find((entry) => entry.id === lessonId);
  if (!module || !lesson) return { kind: 'invalid', code: 'COURSE_LESSON_NOT_FOUND' };
  if (requestedModuleId && requestedModuleId !== module.id) return { kind: 'invalid', code: 'COURSE_MODULE_LESSON_MISMATCH' };
  if (module.status === 'LOCKED' || lesson.status === 'LOCKED') return { kind: 'invalid', code: 'COURSE_LESSON_LOCKED' };
  return { kind: 'selected', module, lesson };
}

export function languageCoreCourseHref(profileId: string, core?: LanguageLearningCoreView | null, lessonId?: string): string {
  const base = `/languages/${encodeURIComponent(profileId)}/course`;
  if (!core) return base;
  const selection = selectLanguageCoreLesson(core, undefined, lessonId);
  return selection.kind === 'selected'
    ? `${base}?moduleId=${encodeURIComponent(selection.module.id)}&lessonId=${encodeURIComponent(selection.lesson.id)}`
    : base;
}
