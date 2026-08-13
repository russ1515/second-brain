/** Language engine (Phase 5, Educational Engine) wire contracts. */

import type { CardView } from './flashcards';
import type { LessonView } from './lesson';
import type { TutorSessionDetail } from './tutor';

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
  nativeLanguage: string | null;
  mode: LanguageMode;
  /** CEFR / CECRL level (Sprint 7.3). */
  cefrLevel: CefrLevel;
  goal: string | null;
  /** Deck holding this language's vocabulary (ordinary FSRS cards). */
  vocabDeckId: string | null;
  vocabCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface LanguageProfileDetail extends LanguageProfileSummary {
  /** Vocabulary items due for review right now (FSRS). */
  vocabDue: number;
  lessonCount: number;
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
