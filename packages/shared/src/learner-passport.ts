import type { CefrLevel } from './language';
import type { SupportedLanguageCode } from './languages';
import type { LearnerProfile } from './learner-profile';
import type { DnaTrait } from './learning-dna';
import type {
  KycEducation,
  KycLanguageLearner,
  KycTeacher,
  KnownLanguage,
  LearnerAgeBand,
  LearningCategory,
} from './onboarding';

export const LEARNER_PASSPORT_VERSION = 1 as const;
export const LEARNER_PASSPORT_SOURCES = ['DECLARED', 'OBSERVED', 'VERIFIED'] as const;

/** Provenance is intentionally coarse-grained. It describes where a section
 * comes from without inventing a verification workflow that does not exist. */
export type LearnerPassportSource = (typeof LEARNER_PASSPORT_SOURCES)[number];

export interface LearnerPassportEducation {
  category: LearningCategory | null;
  level: string | null;
  system: string | null;
  field: string | null;
  domain: string | null;
  specialty: string | null;
  year: string | null;
}

export interface LearnerPassportLanguageGoals {
  targetLanguage: SupportedLanguageCode | null;
  currentLevel: CefrLevel | null;
  targetLevel: CefrLevel | null;
  mainGoal: string | null;
  skills: string[];
}

export interface LearnerPassportDeclared {
  source: 'DECLARED';
  ageBand: LearnerAgeBand | null;
  countryOfOrigin: string | null;
  currentCountry: string | null;
  /** Account interface language. It is changed through the existing locale API. */
  interfaceLanguage: SupportedLanguageCode | null;
  nativeOrPrimaryLanguage: SupportedLanguageCode | null;
  /** General explanation language used by the AI Professor. */
  explanationLanguage: SupportedLanguageCode | null;
  teachingLanguage: SupportedLanguageCode | null;
  knownLanguages: KnownLanguage[];
  education: LearnerPassportEducation;
  subjects: string[];
  academicGoals: string[];
  languageGoals: LearnerPassportLanguageGoals;
  learningPreferences: string[];
  teacher: KycTeacher | null;
  timezone: string;
}

export interface LearnerPassportLanguageProgress {
  profileId: string;
  language: string;
  languageCode: SupportedLanguageCode | null;
  nativeLanguage: string | null;
  declaredLevel: CefrLevel;
  /** Null until an existing assessment engine records a defensible level. */
  evaluatedLevel: CefrLevel | null;
  goal: string | null;
  lessonCount: number;
  sessionCount: number;
  lastActivityAt: string | null;
}

export interface LearnerPassportLearningDna {
  traits: DnaTrait[];
  maturity: number;
  interactions: number;
  updatedAt: string;
}

export interface LearnerPassportObserved {
  source: 'OBSERVED';
  learnerProfile: LearnerProfile | null;
  learningDna: LearnerPassportLearningDna | null;
  languageProgress: LearnerPassportLanguageProgress[];
}

export interface LearnerPassportVerified {
  source: 'VERIFIED';
  /** No official verification workflow exists today. Keep this honest. */
  available: false;
  fields: [];
}

export interface LearnerPassportView {
  version: typeof LEARNER_PASSPORT_VERSION;
  declared: LearnerPassportDeclared;
  observed: LearnerPassportObserved;
  verified: LearnerPassportVerified;
  updatedAt: string | null;
}

/** Only declared information may be edited through the Passport. UI language
 * and target-language profiles retain their existing dedicated APIs. */
export interface UpdateLearnerPassportRequest {
  identity?: {
    ageBand?: LearnerAgeBand | null;
    countryOfOrigin?: string | null;
    currentCountry?: string | null;
  };
  languages?: {
    nativeOrPrimaryLanguage?: SupportedLanguageCode | null;
    explanationLanguage?: SupportedLanguageCode | null;
    teachingLanguage?: SupportedLanguageCode | null;
    knownLanguages?: KnownLanguage[];
  };
  education?: Partial<KycEducation>;
  subjects?: string[];
  academicGoals?: string[];
  languageGoals?: Partial<KycLanguageLearner>;
  learningPreferences?: string[];
  teacher?: KycTeacher;
  timezone?: string;
}

export interface LearnerPassportTutorContext {
  directive: string;
  /** Persisted declaration forwarded as data to the existing ITE. The ITE,
   * not the client or the Passport projection, derives pedagogical policy. */
  ageBand: LearnerAgeBand | null;
  nativeOrPrimaryLanguage: SupportedLanguageCode | null;
  teachingLanguage: SupportedLanguageCode | null;
  learningPreferences: string[];
}
