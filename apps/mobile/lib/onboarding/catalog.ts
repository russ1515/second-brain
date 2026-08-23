import {
  ACADEMIC_CATEGORIES,
  type KycMasteryLevel,
  type LearningCategory,
  type OnboardingAnswers,
  type OnboardingStep,
} from '@second-brain/shared';

/**
 * Onboarding catalog (UI/UX Sprint 2).
 *
 * The option lists + the ADAPTIVE step order live here so the flow screen stays
 * declarative. Copy is French — Second Brain's product language — matching the
 * design playground; folding these into the i18n dictionaries is future content
 * work (the parked localization Step 2), not an engine change.
 */

export interface Choice<T extends string = string> {
  value: T;
  label: string;
  icon?: string;
  /** Optional "why we ask" note for the privacy affordance (2.19). */
  why?: string;
}

// 2.3 — Universal learning category
export const CATEGORY_CHOICES: Choice<LearningCategory>[] = [
  { value: 'kindergarten', label: 'onb.cat.kindergarten', icon: '🧒' },
  { value: 'primary', label: 'onb.cat.primary', icon: '📚' },
  { value: 'secondary', label: 'onb.cat.secondary', icon: '🎒' },
  { value: 'highschool', label: 'onb.cat.highschool', icon: '🎓' },
  { value: 'university', label: 'onb.cat.university', icon: '🏛️' },
  { value: 'research', label: 'onb.cat.research', icon: '🔬' },
  { value: 'professional', label: 'onb.cat.professional', icon: '💼' },
  { value: 'language', label: 'onb.cat.language', icon: '🌍' },
  { value: 'personal', label: 'onb.cat.personal', icon: '🧠' },
];

// 2.2 — Age bands (minor-friendly: a band, never a birth date)
export const AGE_BANDS: Choice[] = [
  { value: 'under12', label: 'onb.age.under12', icon: '🧒' },
  { value: '12to15', label: 'onb.age.12to15', icon: '🎒' },
  { value: '16to18', label: 'onb.age.16to18', icon: '🎓' },
  { value: '18to25', label: 'onb.age.18to25', icon: '🎓' },
  { value: '25to40', label: 'onb.age.25to40', icon: '💼' },
  { value: 'over40', label: 'onb.age.over40', icon: '🧭' },
];

// 2.5 — Learning goals (multi-select)
export const GOAL_CHOICES: Choice[] = [
  { value: 'understand', label: 'onb.goal.understand', icon: '💡' },
  { value: 'exams', label: 'onb.goal.exams', icon: '🎯' },
  { value: 'grades', label: 'onb.goal.grades', icon: '📈' },
  { value: 'language', label: 'onb.goal.language', icon: '🌍' },
  { value: 'contest', label: 'onb.goal.contest', icon: '🏆' },
  { value: 'homework', label: 'onb.goal.homework', icon: '📝' },
  { value: 'labs', label: 'onb.goal.labs', icon: '🔬' },
  { value: 'reports', label: 'onb.goal.reports', icon: '📄' },
  { value: 'projects', label: 'onb.goal.projects', icon: '🛠️' },
  { value: 'research', label: 'onb.goal.research', icon: '🔎' },
  { value: 'skills', label: 'onb.goal.skills', icon: '🚀' },
  { value: 'curiosity', label: 'onb.goal.curiosity', icon: '✨' },
];

// 2.6 — Common subjects (learner can also add their own)
export const SUBJECT_CHOICES: Choice[] = [
  { value: 'Mathématiques', label: 'onb.subj.math', icon: '➗' },
  { value: 'Physique', label: 'onb.subj.physics', icon: '🧲' },
  { value: 'Chimie', label: 'onb.subj.chemistry', icon: '⚗️' },
  { value: 'Biologie', label: 'onb.subj.biology', icon: '🧬' },
  { value: 'Informatique', label: 'onb.subj.cs', icon: '💻' },
  { value: 'Droit', label: 'onb.subj.law', icon: '⚖️' },
  { value: 'Économie', label: 'onb.subj.economics', icon: '📊' },
  { value: 'Histoire', label: 'onb.subj.history', icon: '🏛️' },
  { value: 'Géographie', label: 'onb.subj.geography', icon: '🗺️' },
  { value: 'Langues', label: 'onb.subj.languages', icon: '🗣️' },
  { value: 'Médecine', label: 'onb.subj.medicine', icon: '🩺' },
  { value: 'Philosophie', label: 'onb.subj.philosophy', icon: '📖' },
];

// 2.9 — Learning preferences (multi-select, NOT a diagnosis)
export const PREFERENCE_CHOICES: Choice[] = [
  { value: 'visual', label: 'onb.pref.visual', icon: '🖼️' },
  { value: 'examples', label: 'onb.pref.examples', icon: '📎' },
  { value: 'practice', label: 'onb.pref.practice', icon: '🏋️' },
  { value: 'exercises', label: 'onb.pref.exercises', icon: '✍️' },
  { value: 'conversation', label: 'onb.pref.conversation', icon: '💬' },
  { value: 'reading', label: 'onb.pref.reading', icon: '📕' },
  { value: 'listening', label: 'onb.pref.listening', icon: '🎧' },
  { value: 'repetition', label: 'onb.pref.repetition', icon: '🔁' },
  { value: 'problems', label: 'onb.pref.problems', icon: '🧩' },
];

// 2.10 — AI teacher configuration
export const TONE_CHOICES: Choice[] = [
  { value: 'supportive', label: 'onb.tone.supportive', icon: '😊' },
  { value: 'balanced', label: 'onb.tone.balanced', icon: '🎯' },
  { value: 'demanding', label: 'onb.tone.demanding', icon: '🔥' },
];
export const EXPLANATION_CHOICES: Choice[] = [
  { value: 'short', label: 'onb.expl.short', icon: '⚡' },
  { value: 'balanced', label: 'onb.expl.balanced', icon: '⚖️' },
  { value: 'detailed', label: 'onb.expl.detailed', icon: '📚' },
];
export const INTERVENTION_CHOICES: Choice[] = [
  { value: 'let_me_think', label: 'onb.interv.let_me_think', icon: '🤔' },
  { value: 'guide_me', label: 'onb.interv.guide_me', icon: '🧭' },
  { value: 'interactive', label: 'onb.interv.interactive', icon: '💬' },
];
export const CORRECTION_CHOICES: Choice[] = [
  { value: 'immediate', label: 'onb.corr.immediate', icon: '✅' },
  { value: 'let_me_finish', label: 'onb.corr.let_me_finish', icon: '⏳' },
  { value: 'adaptive', label: 'onb.corr.adaptive', icon: '🎚️' },
];

// 2.11 — Academic assistance preferences (multi-select)
export const ACADEMIC_SUPPORT_CHOICES: Choice[] = [
  { value: 'guide', label: 'onb.sup.guide', icon: '👨‍🏫' },
  { value: 'understand', label: 'onb.sup.understand', icon: '🧠' },
  { value: 'step_by_step', label: 'onb.sup.step_by_step', icon: '📝' },
  { value: 'verify', label: 'onb.sup.verify', icon: '🔎' },
  { value: 'solution', label: 'onb.sup.solution', icon: '✅' },
];

// 2.8 — Language-learner sub-skills
export const LANGUAGE_SKILL_CHOICES: Choice[] = [
  { value: 'comprehension', label: 'onb.skill.comprehension', icon: '👂' },
  { value: 'speaking', label: 'onb.skill.speaking', icon: '🗣️' },
  { value: 'pronunciation', label: 'onb.skill.pronunciation', icon: '🔊' },
  { value: 'writing', label: 'onb.skill.writing', icon: '✍️' },
  { value: 'grammar', label: 'onb.skill.grammar', icon: '📐' },
  { value: 'vocabulary', label: 'onb.skill.vocabulary', icon: '📖' },
];

export const CEFR_LEVELS: Choice[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(
  (l) => ({ value: l, label: l }),
);

/** Self-rating used when the AI diagnostic is unavailable (2.12). */
export const SELF_RATING: Choice<KycMasteryLevel>[] = [
  { value: 'high', label: 'onb.rate.high', icon: '🟢' },
  { value: 'medium', label: 'onb.rate.medium', icon: '🟡' },
  { value: 'low', label: 'onb.rate.low', icon: '🔴' },
];

// A handful of common interface/native languages surfaced first (the full
// 25-language registry is available in Profil via the existing LocalePicker).
export const QUICK_LANGUAGES: Choice[] = [
  { value: 'fr', label: '🇫🇷 Français' },
  { value: 'en', label: '🇬🇧 English' },
  { value: 'es', label: '🇪🇸 Español' },
  { value: 'de', label: '🇩🇪 Deutsch' },
  { value: 'it', label: '🇮🇹 Italiano' },
  { value: 'pt', label: '🇵🇹 Português' },
  { value: 'ar', label: '🇸🇦 العربية' },
];

// ── Adaptive step order (the "FLUX COMPLET", but branched) ───────────────────

/**
 * The steps a given learner actually walks. A language learner skips the
 * academic-path questions and gets the language-learner branch instead; the
 * academic branch skips the language-learner step. This is the spec's rule:
 * "un apprenant de langue ne doit pas traverser toutes les questions destinées
 * à un étudiant universitaire".
 */
export function stepsFor(answers: OnboardingAnswers): OnboardingStep[] {
  const category = answers.education?.category;
  const isLanguage = category === 'language';
  const isAcademic =
    !!category && ACADEMIC_CATEGORIES.includes(category);

  const steps: OnboardingStep[] = ['welcome', 'identity', 'category'];
  if (isAcademic) steps.push('academic');
  steps.push('goals', 'subjects');
  if (isLanguage) {
    steps.push('language_learner');
  } else {
    steps.push('languages', 'mobility');
  }
  steps.push('preferences', 'teacher');
  if (isAcademic || category === 'professional') steps.push('academic_support');
  steps.push('assessment', 'twin', 'adaptation', 'done');
  return steps;
}

export function categoryLabel(category?: LearningCategory | null): string {
  return (
    CATEGORY_CHOICES.find((c) => c.value === category)?.label ?? '—'
  );
}
