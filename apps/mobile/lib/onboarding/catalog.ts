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
  { value: 'kindergarten', label: 'Maternelle', icon: '🧒' },
  { value: 'primary', label: 'Primaire', icon: '📚' },
  { value: 'secondary', label: 'Secondaire', icon: '🎒' },
  { value: 'highschool', label: 'Lycée', icon: '🎓' },
  { value: 'university', label: 'Université / Faculté', icon: '🏛️' },
  { value: 'research', label: 'Recherche / Doctorat', icon: '🔬' },
  { value: 'professional', label: 'Formation professionnelle', icon: '💼' },
  { value: 'language', label: 'Apprentissage d’une langue', icon: '🌍' },
  { value: 'personal', label: 'Apprentissage personnel', icon: '🧠' },
];

// 2.2 — Age bands (minor-friendly: a band, never a birth date)
export const AGE_BANDS: Choice[] = [
  { value: 'under12', label: 'Moins de 12 ans', icon: '🧒' },
  { value: '12to15', label: '12–15 ans', icon: '🎒' },
  { value: '16to18', label: '16–18 ans', icon: '🎓' },
  { value: '18to25', label: '18–25 ans', icon: '🎓' },
  { value: '25to40', label: '25–40 ans', icon: '💼' },
  { value: 'over40', label: '40 ans et plus', icon: '🧭' },
];

// 2.5 — Learning goals (multi-select)
export const GOAL_CHOICES: Choice[] = [
  { value: 'understand', label: 'Comprendre mes cours', icon: '💡' },
  { value: 'exams', label: 'Réussir mes examens', icon: '🎯' },
  { value: 'grades', label: 'Améliorer mes notes', icon: '📈' },
  { value: 'language', label: 'Apprendre une langue', icon: '🌍' },
  { value: 'contest', label: 'Préparer un concours', icon: '🏆' },
  { value: 'homework', label: 'Faire mes devoirs', icon: '📝' },
  { value: 'labs', label: 'Réaliser mes TP', icon: '🔬' },
  { value: 'reports', label: 'Rédiger mes rapports', icon: '📄' },
  { value: 'projects', label: 'Travailler sur mes projets', icon: '🛠️' },
  { value: 'research', label: 'Faire de la recherche', icon: '🔎' },
  { value: 'skills', label: 'Développer mes compétences', icon: '🚀' },
  { value: 'curiosity', label: 'Apprendre par curiosité', icon: '✨' },
];

// 2.6 — Common subjects (learner can also add their own)
export const SUBJECT_CHOICES: Choice[] = [
  { value: 'Mathématiques', label: 'Mathématiques', icon: '➗' },
  { value: 'Physique', label: 'Physique', icon: '🧲' },
  { value: 'Chimie', label: 'Chimie', icon: '⚗️' },
  { value: 'Biologie', label: 'Biologie', icon: '🧬' },
  { value: 'Informatique', label: 'Informatique', icon: '💻' },
  { value: 'Droit', label: 'Droit', icon: '⚖️' },
  { value: 'Économie', label: 'Économie', icon: '📊' },
  { value: 'Histoire', label: 'Histoire', icon: '🏛️' },
  { value: 'Géographie', label: 'Géographie', icon: '🗺️' },
  { value: 'Langues', label: 'Langues', icon: '🗣️' },
  { value: 'Médecine', label: 'Médecine', icon: '🩺' },
  { value: 'Philosophie', label: 'Philosophie', icon: '📖' },
];

// 2.9 — Learning preferences (multi-select, NOT a diagnosis)
export const PREFERENCE_CHOICES: Choice[] = [
  { value: 'visual', label: 'Explications visuelles', icon: '🖼️' },
  { value: 'examples', label: 'Exemples', icon: '📎' },
  { value: 'practice', label: 'Pratique', icon: '🏋️' },
  { value: 'exercises', label: 'Exercices', icon: '✍️' },
  { value: 'conversation', label: 'Conversation', icon: '💬' },
  { value: 'reading', label: 'Lecture', icon: '📕' },
  { value: 'listening', label: 'Écoute', icon: '🎧' },
  { value: 'repetition', label: 'Répétition', icon: '🔁' },
  { value: 'problems', label: 'Résolution de problèmes', icon: '🧩' },
];

// 2.10 — AI teacher configuration
export const TONE_CHOICES: Choice[] = [
  { value: 'supportive', label: 'Bienveillant', icon: '😊' },
  { value: 'balanced', label: 'Équilibré', icon: '🎯' },
  { value: 'demanding', label: 'Exigeant', icon: '🔥' },
];
export const EXPLANATION_CHOICES: Choice[] = [
  { value: 'short', label: 'Courtes', icon: '⚡' },
  { value: 'balanced', label: 'Équilibrées', icon: '⚖️' },
  { value: 'detailed', label: 'Détaillées', icon: '📚' },
];
export const INTERVENTION_CHOICES: Choice[] = [
  { value: 'let_me_think', label: 'Me laisser réfléchir', icon: '🤔' },
  { value: 'guide_me', label: 'Me guider progressivement', icon: '🧭' },
  { value: 'interactive', label: 'Être très interactif', icon: '💬' },
];
export const CORRECTION_CHOICES: Choice[] = [
  { value: 'immediate', label: 'Corriger immédiatement', icon: '✅' },
  { value: 'let_me_finish', label: 'Me laisser terminer', icon: '⏳' },
  { value: 'adaptive', label: 'Adapter selon la situation', icon: '🎚️' },
];

// 2.11 — Academic assistance preferences (multi-select)
export const ACADEMIC_SUPPORT_CHOICES: Choice[] = [
  { value: 'guide', label: 'Me guider', icon: '👨‍🏫' },
  { value: 'understand', label: 'M’aider à comprendre', icon: '🧠' },
  { value: 'step_by_step', label: 'M’accompagner étape par étape', icon: '📝' },
  { value: 'verify', label: 'Vérifier mon raisonnement', icon: '🔎' },
  { value: 'solution', label: 'Me montrer une solution expliquée', icon: '✅' },
];

// 2.8 — Language-learner sub-skills
export const LANGUAGE_SKILL_CHOICES: Choice[] = [
  { value: 'comprehension', label: 'Compréhension', icon: '👂' },
  { value: 'speaking', label: 'Expression orale', icon: '🗣️' },
  { value: 'pronunciation', label: 'Prononciation', icon: '🔊' },
  { value: 'writing', label: 'Écriture', icon: '✍️' },
  { value: 'grammar', label: 'Grammaire', icon: '📐' },
  { value: 'vocabulary', label: 'Vocabulaire', icon: '📖' },
];

export const CEFR_LEVELS: Choice[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map(
  (l) => ({ value: l, label: l }),
);

/** Self-rating used when the AI diagnostic is unavailable (2.12). */
export const SELF_RATING: Choice<KycMasteryLevel>[] = [
  { value: 'high', label: 'Je maîtrise', icon: '🟢' },
  { value: 'medium', label: 'Moyen', icon: '🟡' },
  { value: 'low', label: 'À renforcer', icon: '🔴' },
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
