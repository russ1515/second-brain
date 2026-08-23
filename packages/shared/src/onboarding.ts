/**
 * Onboarding / Universal KYC (UI/UX Sprint 2).
 *
 * The KYC is Second Brain's FIRST pedagogical configurator, not a sign-up form.
 * What the learner tells us here seeds every downstream system: the interface,
 * the AI Professor, the language support, the goals, the subjects and the
 * initial Digital Twin (see `SystemConfiguration`).
 *
 * The model is deliberately evolution-safe: answers live in independent SECTIONS
 * so new dimensions can be added later without breaking existing profiles, and
 * every field is optional so the KYC can be progressive (save-and-resume, skip).
 */

// ── Who the learner is (2.3) ────────────────────────────────────────────────
export type LearningCategory =
  | 'kindergarten' // 🧒 Maternelle
  | 'primary' // 📚 Primaire
  | 'secondary' // 🎒 Secondaire (collège)
  | 'highschool' // 🎓 Lycée
  | 'university' // 🏛️ Université / Faculté
  | 'research' // 🔬 Recherche / Doctorat
  | 'professional' // 💼 Formation professionnelle
  | 'language' // 🌍 Apprentissage d'une langue
  | 'personal'; // 🧠 Apprentissage personnel

export const LEARNING_CATEGORIES: LearningCategory[] = [
  'kindergarten',
  'primary',
  'secondary',
  'highschool',
  'university',
  'research',
  'professional',
  'language',
  'personal',
];

/** A category is "academic" when the Academic Path (2.4) applies to it. */
export const ACADEMIC_CATEGORIES: LearningCategory[] = [
  'secondary',
  'highschool',
  'university',
  'research',
];

// ── Sections of the LearnerProfile (2.21) ───────────────────────────────────

export interface KycIdentity {
  firstName?: string;
  lastName?: string;
  /** A single emoji stands in for a photo without collecting an image. */
  avatarEmoji?: string;
  /** Age band, not an exact date — enough to adapt tone, never more than needed. */
  ageBand?: 'under12' | '12to15' | '16to18' | '18to25' | '25to40' | 'over40';
  country?: string;
  /** Minor-friendly mode: reduce data collection + simplify the experience. */
  isMinor?: boolean;
}

export interface KycEducation {
  category?: LearningCategory;
  /** Free-ish path (2.4): predefined OR searched OR typed. */
  level?: string;
  system?: string; // country / educational system
  field?: string; // filière
  domain?: string;
  specialty?: string;
  year?: string; // année / niveau
}

export interface KycLanguages {
  native?: string; // langue maternelle
  interface?: string; // langue de l'interface
  study?: string; // langue d'étude principale
  others?: string[];
  /** International mobility (2.7): studying in a non-native language. */
  studyingInForeignLanguage?: boolean;
}

/** Language-learner branch (2.8) — only when category === 'language'. */
export interface KycLanguageLearner {
  targetLanguage?: string;
  currentLevel?: string; // CEFR, e.g. "A2"
  targetLevel?: string; // e.g. "B2"
  mainGoal?: string; // e.g. "Conversation"
  /** Sub-skills to prioritise: comprehension, speaking, pronunciation, … */
  skills?: string[];
}

export interface KycTeacher {
  tone?: 'supportive' | 'balanced' | 'demanding'; // 😊 / 🎯 / 🔥
  explanations?: 'short' | 'balanced' | 'detailed';
  intervention?: 'let_me_think' | 'guide_me' | 'interactive';
  correction?: 'immediate' | 'let_me_finish' | 'adaptive';
}

/** One concept assessed in the mini-diagnostic (2.12). */
export interface KycAssessmentItem {
  concept: string;
  question?: string;
  /** What the learner answered (for LLM grading) or a self-rating. */
  answer?: string;
  level?: KycMasteryLevel;
}

export interface KycAssessment {
  subject?: string;
  items?: KycAssessmentItem[];
  /** True once the diagnostic has been run (vs skipped). */
  taken?: boolean;
}

export type KycMasteryLevel = 'high' | 'medium' | 'low';

/** The full set of KYC answers — every section optional (progressive). */
export interface OnboardingAnswers {
  identity?: KycIdentity;
  education?: KycEducation;
  languages?: KycLanguages;
  languageLearner?: KycLanguageLearner;
  /** Why the learner is here (2.5) — multiple allowed. */
  goals?: string[];
  /** Subjects / domains studied (2.6). */
  subjects?: string[];
  /** How they prefer to learn (2.9) — preferences, never a diagnosis. */
  preferences?: string[];
  teacher?: KycTeacher;
  /** How they want help on academic work (2.11). */
  academicSupport?: string[];
  assessment?: KycAssessment;
  /** Escape hatch for future dimensions without a schema change. */
  extra?: Record<string, unknown>;
}

export type OnboardingStatus = 'not_started' | 'in_progress' | 'completed';

/** The persisted onboarding state — drives resume (2.20) and the gate. */
export interface OnboardingState {
  status: OnboardingStatus;
  /** The step the learner last reached, so we can resume there. */
  currentStep: OnboardingStep;
  answers: OnboardingAnswers;
  completedAt: string | null;
  updatedAt: string | null;
}

// ── Steps of the flow (2, "FLUX COMPLET") ───────────────────────────────────
export type OnboardingStep =
  | 'welcome'
  | 'identity'
  | 'category'
  | 'academic'
  | 'goals'
  | 'subjects'
  | 'languages'
  | 'mobility'
  | 'language_learner'
  | 'preferences'
  | 'teacher'
  | 'academic_support'
  | 'assessment'
  | 'twin'
  | 'adaptation'
  | 'done';

/** Whether a step is required, recommended or optional (2.18). Drives skip. */
export type DataLevel = 'required' | 'recommended' | 'optional';

export const STEP_LEVEL: Record<OnboardingStep, DataLevel> = {
  welcome: 'required',
  identity: 'required',
  category: 'required',
  academic: 'recommended',
  goals: 'recommended',
  subjects: 'recommended',
  languages: 'recommended',
  mobility: 'optional',
  language_learner: 'required', // required only when it appears (language branch)
  preferences: 'optional',
  teacher: 'recommended',
  academic_support: 'optional',
  assessment: 'optional',
  twin: 'required',
  adaptation: 'required',
  done: 'required',
};

// ── Request / response contracts ────────────────────────────────────────────

/** PUT /api/onboarding — a partial patch, merged section-by-section. */
export interface SaveOnboardingRequest {
  currentStep?: OnboardingStep;
  answers?: OnboardingAnswers;
}

/** POST /api/onboarding/assessment — generate a quick diagnostic for a subject. */
export interface GenerateAssessmentRequest {
  subject: string;
  /** How many concepts to probe (default 3, small on purpose). */
  count?: number;
}

export interface GenerateAssessmentResponse {
  subject: string;
  items: { concept: string; question: string }[];
  /** False when the LLM was unavailable and the learner should self-rate. */
  aiGenerated: boolean;
}

// ── KYC → System Configuration (2.13 / 2.15) ────────────────────────────────

/** What Second Brain understood, shown back for confirmation + editing (2.13). */
export interface SystemConfiguration {
  learnerProfile: {
    name: string | null;
    category: LearningCategory | null;
    categoryLabel: string | null;
  };
  educationProfile: {
    summary: string | null; // "Université — Informatique"
    year: string | null;
  };
  languageProfile: {
    native: string | null;
    study: string | null;
    others: string[];
    /** Bilingual support was switched on (foreign-language study). */
    bilingualSupport: boolean;
  };
  goals: string[];
  subjects: string[];
  teachingPreferences: {
    tone: KycTeacher['tone'] | null;
    explanations: KycTeacher['explanations'] | null;
    intervention: KycTeacher['intervention'] | null;
    correction: KycTeacher['correction'] | null;
  };
  /** Initial Digital Twin seed: concepts created + their assessed level. */
  initialMastery: { concept: string; level: KycMasteryLevel }[];
  /** Side-effects that actually happened (for an honest completion report). */
  applied: {
    profileUpdated: boolean;
    languageProfileCreated: boolean;
    conceptsCreated: number;
  };
}

export interface CompleteOnboardingResponse {
  state: OnboardingState;
  configuration: SystemConfiguration;
}
