/** Language engine (Phase 5, Educational Engine) wire contracts. */

import type { CardView } from './flashcards';
import type { LessonView } from './lesson';
import type { TutorSessionDetail } from './tutor';
import type { ActionDestination } from './next-best-action';
import type { SupportedLanguageCode } from './languages';

/** The seven teaching modes from the Educational Engine spec. */
export type LanguageMode =
  | 'beginner'
  | 'intermediate'
  | 'advanced'
  | 'academic'
  | 'professional'
  | 'exam_prep'
  | 'immersion';

export const LANGUAGE_MODES: readonly LanguageMode[] = [
  'beginner',
  'intermediate',
  'advanced',
  'academic',
  'professional',
  'exam_prep',
  'immersion',
] as const;

/** CEFR / CECRL proficiency levels (Sprint 7.3). */
export type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export const CEFR_LEVELS: readonly CefrLevel[] = [
  'A1',
  'A2',
  'B1',
  'B2',
  'C1',
  'C2',
] as const;

export interface LanguageProfileSummary {
  id: string;
  language: string;
  /** Canonical registry code when this is one of the 27 supported languages. */
  languageCode: SupportedLanguageCode | null;
  nativeLanguage: string | null;
  nativeLanguageCode: SupportedLanguageCode | null;
  mode: LanguageMode;
  /** CEFR / CECRL level (Sprint 7.3). */
  cefrLevel: CefrLevel;
  goal: string | null;
  /** Deck holding this language's vocabulary (ordinary FSRS cards). */
  vocabDeckId: string | null;
  vocabCount: number;
  vocabDue: number;
  lessonCount: number;
  sessionCount: number;
  lastActivityAt: string | null;
  /** Existing CEFR is self-declared until a real assessment explicitly says otherwise. */
  cefrLevelSource: 'declared';
  evaluatedCefrLevel: CefrLevel | null;
  createdAt: string;
  updatedAt: string;
}

export interface LanguageProfileDetail extends LanguageProfileSummary {
  /** Immersion depth (7.8): target-language share 0..1, or null when the mode
   *  is not immersion. Rises automatically with the CEFR level. */
  immersionRatio: number | null;
}

export interface CreateLanguageProfileRequest {
  language: string;
  nativeLanguage?: string;
  mode?: LanguageMode;
  cefrLevel?: CefrLevel;
  goal?: string;
}

export interface UpdateLanguageProfileRequest {
  nativeLanguage?: string;
  mode?: LanguageMode;
  cefrLevel?: CefrLevel;
  goal?: string;
}

// ── Language skills (Sprint 7.3): grammar, conjugation, comprehension ──

/** Grammar lesson or reading/listening comprehension on an optional topic. */
export interface LanguageSkillRequest {
  /** What to focus on, e.g. "the past tense" or "travel". Optional. */
  topic?: string;
}

/** Conjugation practice for a verb (or a level-appropriate one if omitted). */
export interface ConjugationRequest {
  verb?: string;
}

/** A generated skill resource: markdown, in the target language + glosses. */
export interface LanguageSkillResponse {
  title: string;
  /** Markdown body (tables, examples, exercises). */
  content: string;
}

/** Generate a language lesson pitched at the profile's mode. */
export interface GenerateLanguageLessonRequest {
  /** What to teach, e.g. "ordering coffee" or "the subjunctive". */
  topic: string;
}

/** Mine vocabulary from supplied text (or from the profile's own material). */
export interface ExtractVocabularyRequest {
  /** Source text to mine. */
  text?: string;
  /** Or mine an owned document instead. */
  documentId?: string;
  /** Max items to create (default 12, max 40). */
  count?: number;
  /** Active language session that produced the vocabulary, when applicable. */
  experienceSessionId?: string;
  /** Short learner-visible phrase/topic that explains where the words came from. */
  sourcePhrase?: string;
}

export interface VocabularyItem {
  term: string;
  translation: string;
  example: string;
}

export interface ExtractVocabularyResponse {
  deckId: string;
  /** New FSRS cards created for this language's vocabulary deck. */
  cards: CardView[];
  created: number;
  /** Items skipped because the term was already in the deck. */
  skipped: number;
}

export interface StartConversationRequest {
  /** Optional scenario, e.g. "at the pharmacy". */
  scenario?: string;
  immersionIntensity?: ImmersionIntensity;
  correctionIntensity?: LanguageCorrectionIntensity;
  inputModality?: 'text' | 'voice';
  /** Optional structured-course origin. The API validates ownership and the
   * active lesson before copying this context into the Tutor ExperienceSession. */
  courseSessionId?: string;
  unitId?: string;
  lessonId?: string;
  courseStage?: string;
}

/** One pronunciation attempt, scored against a target phrase.
 *
 * NOTE ON HONESTY: this is NOT phoneme-level pronunciation analysis. The STT
 * seam returns text, not phonemes. `accuracy` measures whether the learner's
 * speech was RECOGNISED AS the target phrase (1 - word error rate) — a real,
 * useful proxy for intelligibility, deliberately not named a "pronunciation
 * score" so it cannot be mistaken for accent analysis.
 */
export interface PronunciationAssessment {
  targetPhrase: string;
  /** What the recogniser actually heard. */
  heard: string;
  /** 0..1 — share of target words recognised correctly (1 - WER). */
  accuracy: number;
  /** Per-word outcome, aligned to the target phrase. */
  words: PronunciationWord[];
  /** Coaching from the language teacher, grounded in the diff above. */
  feedback: string;
}

export interface PronunciationWord {
  expected: string;
  /** What was heard in this slot; null when the word was missed entirely. */
  heard: string | null;
  correct: boolean;
}

// ── Pronunciation coach (Sprint 7.5): audio-native, communication-focused ──

/** The five things the coach listens for. Named to the spec. */
export type PronunciationDimensionKind =
  | 'pronunciation'
  | 'accent'
  | 'rhythm'
  | 'fluency'
  | 'intonation';

export const PRONUNCIATION_DIMENSIONS: readonly PronunciationDimensionKind[] = [
  'pronunciation',
  'accent',
  'rhythm',
  'fluency',
  'intonation',
] as const;

export type PronunciationRating = 'good' | 'fair' | 'needs_work';

export interface PronunciationDimension {
  kind: PronunciationDimensionKind;
  rating: PronunciationRating;
  /** What the coach actually heard on this dimension (grounded in the audio). */
  observation: string;
}

export interface PronunciationExercise {
  title: string;
  /** Concrete, do-it-now instructions. */
  instructions: string;
}

/** A full coaching pass over a spoken sample. The goal is COMMUNICATION, not
 *  just correctness: what came across, why, how to improve, what to drill. */
export interface PronunciationCoaching {
  /** What the coach heard the learner say (verbatim transcript). */
  transcript: string;
  /** Overall, communication-first read: could a listener understand you? */
  summary: string;
  /** Per-dimension findings (pronunciation, accent, rhythm, fluency, intonation). */
  dimensions: PronunciationDimension[];
  /** Why the flagged issues matter for being understood. */
  why: string;
  /** How to improve them. */
  howToImprove: string;
  /** Exercises tailored to what was heard. */
  exercises: PronunciationExercise[];
}

export interface LanguageLessonResponse {
  lesson: LessonView;
  mode: LanguageMode;
}

export interface StartConversationResponse {
  session: TutorSessionDetail;
}

export const IMMERSION_INTENSITIES = ['guided', 'mixed', 'full'] as const;
export type ImmersionIntensity = (typeof IMMERSION_INTENSITIES)[number];

export const LANGUAGE_CORRECTION_INTENSITIES = ['light', 'balanced', 'detailed'] as const;
export type LanguageCorrectionIntensity = (typeof LANGUAGE_CORRECTION_INTENSITIES)[number];

export const LANGUAGE_PRACTICE_FORMATS = [
  'conversation', 'vocabulary', 'grammar', 'conjugation', 'comprehension',
  'reading', 'writing', 'pronunciation', 'oral', 'quiz',
] as const;
export type LanguagePracticeFormat = (typeof LANGUAGE_PRACTICE_FORMATS)[number];

export const VOICE_EXPERIENCE_STATES = [
  'READY', 'LISTENING', 'TRANSCRIPTION', 'THINKING', 'RESPONSE', 'PAUSED', 'ERROR',
] as const;
export type VoiceExperienceState = (typeof VOICE_EXPERIENCE_STATES)[number];

export interface LanguageNextAction {
  kind: 'review-vocabulary' | 'start-conversation' | 'continue-session' | 'create-lesson';
  messageCode: string;
  reasonCode: string;
  count?: number;
  durationMinutes?: number;
  destination: ActionDestination;
}

/** Deterministic recommendation based only on persisted counters. */
export function languageNextAction(profile: LanguageProfileSummary): LanguageNextAction {
  if (profile.vocabDue > 0) {
    return {
      kind: 'review-vocabulary',
      messageCode: 'languages11.nba.review',
      reasonCode: 'languages11.nba.reasonDue',
      count: profile.vocabDue,
      durationMinutes: Math.min(12, Math.max(3, Math.ceil(profile.vocabDue / 2))),
      destination: { kind: 'route', path: '/revision', params: { languageProfileId: profile.id } },
    };
  }
  if (profile.sessionCount === 0) {
    return {
      kind: 'start-conversation',
      messageCode: 'languages11.nba.firstConversation',
      reasonCode: 'languages11.nba.reasonStart',
      durationMinutes: 8,
      destination: { kind: 'route', path: `/languages/${profile.id}`, params: { practice: 'conversation' } },
    };
  }
  if (profile.lessonCount === 0) {
    return {
      kind: 'create-lesson',
      messageCode: 'languages11.nba.lesson',
      reasonCode: 'languages11.nba.reasonLesson',
      durationMinutes: 12,
      destination: { kind: 'route', path: `/languages/${profile.id}`, params: { practice: 'grammar' } },
    };
  }
  return {
    kind: 'start-conversation',
    messageCode: 'languages11.nba.conversation',
    reasonCode: 'languages11.nba.reasonPractice',
    durationMinutes: 8,
    destination: { kind: 'route', path: `/languages/${profile.id}`, params: { practice: 'conversation' } },
  };
}

// ── Dialogues (written practice conversations) ──

export interface GenerateDialogueRequest {
  /** Optional scenario, e.g. "at the market". */
  scenario?: string;
}

export interface DialogueLine {
  speaker: string;
  /** The line, in the target language. */
  text: string;
  /** Native-language gloss; omitted in immersion mode. */
  translation?: string;
}

export interface LanguageDialogue {
  title: string;
  scenario: string | null;
  lines: DialogueLine[];
}

// ── Essay / writing correction (rédaction) ──

export interface CorrectEssayRequest {
  /** The learner's written text in the target language. */
  text: string;
}

export interface EssayCorrectionItem {
  /** The learner's original fragment. */
  original: string;
  /** The corrected fragment. */
  correction: string;
  /** Why it was wrong, in the learner's native language. */
  explanation: string;
}

export interface EssayCorrection {
  /** Overall assessment, in the native language. */
  assessment: string;
  corrections: EssayCorrectionItem[];
  /** The whole text, rewritten correctly in the target language. */
  correctedText: string;
  /** Warm, personalised encouragement. */
  feedback: string;
}
