import { useCallback } from 'react';
import { localeDirection, trInLocale, type TranslationKey } from './i18n';
import type { RlleCopy } from './language-rll-i18n';

/** Only the existing pedagogical controls, not navigation or the account UI.
 * Their registered translations are reused in the server-selected support
 * locale. No setLocale, storage mutation or English fallback is involved. */
export const LANGUAGE_LEARNING_SUPPORT_KEYS = [
  'lesson.objectiveLabel', 'lesson.concept', 'lesson.examples', 'lesson.questions',
  'lesson.correction', 'lesson.submit', 'lesson.readAloud', 'examiner.yourAnswer',
  'rlle.ui.autonomy.notice', 'rlle.ui.autonomy.start', 'rlle.ui.remediation.start',
  'rlle.ui.common.retry', 'app.back', 'onb.continue', 'tutor.send', 'learningCore.help',
  'placement.ui.draftSaving', 'placement.ui.draftSaveFailed', 'placement.ui.draftSaved',
  'rlle.ui.nba.nextLessonAction', 'rlle.ui.course.resume',
  'rlle.ui.lesson.start', 'rlle.ui.lesson.resume', 'learningCore.moduleAssessment', 'learningCore.levelAssessment',
  'learn.explain.lvlBeginner', 'learn.explain.lvlIntermediate', 'learn.explain.lvlAdvanced',
  'rlle.ui.course.status.locked', 'rlle.ui.course.status.available',
  'rlle.ui.course.status.in-progress', 'rlle.ui.autonomy.verdict.not-mastered',
  'rlle.ui.bulletin.status.mastered', 'rlle.ui.bulletin.status.notEvaluable',
] as const;

export function useLanguageLearningCopy(supportLanguageCode?: string | null, targetLanguageCode?: string | null) {
  const ready = Boolean(supportLanguageCode && LANGUAGE_LEARNING_SUPPORT_KEYS.every((key) =>
    trInLocale(supportLanguageCode, key as TranslationKey) !== null));
  const copy = useCallback<RlleCopy>((key, values) => {
    const value = supportLanguageCode ? trInLocale(supportLanguageCode, key as TranslationKey, values) : null;
    // Components display a localized unavailable state before calling this
    // function if the required support catalogue was not registered.
    if (value === null) throw new Error('LANGUAGE_SUPPORT_COPY_MISSING');
    return value;
  }, [supportLanguageCode]);
  return { copy, ready, direction: supportLanguageCode ? localeDirection(supportLanguageCode) : 'ltr' as const,
    targetDirection: targetLanguageCode ? localeDirection(targetLanguageCode) : 'ltr' as const };
}
