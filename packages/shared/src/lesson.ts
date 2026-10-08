/** Written-first learning (Phase 5, Educational Engine) wire contracts. */

/** The kinds of exercise the teacher generates after a lesson. */
export type ExerciseType = 'qcm' | 'open' | 'exercise' | 'case';

/** An exercise with its model answer (the built-in correction). */
export interface LessonExercise {
  question: string;
  /** Model answer (for 'qcm', the text of the correct option). */
  answer: string;
  /** Defaults to 'exercise' for lessons generated before types existed. */
  type?: ExerciseType;
  /** Multiple-choice options — present only for 'qcm'. */
  options?: string[];
}

/** The full written lesson package generated for a topic. */
export interface LessonView {
  id: string;
  topic: string;
  objective: string;
  intro: string;
  explanation: string;
  examples: string[];
  /** Guided comprehension questions (step 5 of the standard flow) — open-ended
   *  prompts to think through, distinct from the graded exercises below. */
  questions: string[];
  exercises: LessonExercise[];
  homework: string;
  summary: string;
  /** Concise key takeaways ("Points clés") — essential points to remember.
   *  Empty on lessons generated before this section existed. */
  keyPoints: string[];
  /** Condensed study/revision sheet. */
  revisionSheet: string;
  conceptId: string | null;
  tutorSessionId: string | null;
  language: string | null;
  /** Language profile this lesson was generated for (language engine). */
  languageProfileId: string | null;
  /** Difficulty this lesson was pitched at — given explicitly, or derived from
   *  the learner's mastery of the concept ("difficulty auto-adapts"). */
  level: 'beginner' | 'intermediate' | 'advanced' | null;
  /** Document this lesson was indexed as, for long-term memory / retrieval. */
  sourceDocumentId: string | null;
  /** Flashcards auto-generated from this lesson (for FSRS revision). */
  cardCount: number;
  createdAt: string;
}

/** List projection of a lesson. */
export interface LessonSummary {
  id: string;
  topic: string;
  objective: string;
  conceptId: string | null;
  language: string | null;
  createdAt: string;
}

export const LESSON_FLOW_STEP_KEYS = [
  'intro',
  'explanation',
  'examples',
  'questions',
  'exercises',
  'correction',
  'summary',
  'keyPoints',
  'flashcards',
  'revision',
] as const;

export type LessonFlowStepKey = (typeof LESSON_FLOW_STEP_KEYS)[number];

/** Persisted, server-authoritative navigation state for a lesson. */
export interface LessonFlowProgress {
  stepKeys: LessonFlowStepKey[];
  activeIndex: number;
  activeStepKey: LessonFlowStepKey;
  validatedStepKeys: LessonFlowStepKey[];
  /** True only after the last mandatory step and evaluated exercise evidence. */
  completed: boolean;
  updatedAt: string;
}

/** Derive the exact visible flow in one place so API locks and UI composition
 * cannot disagree when an optional section is absent. */
export function lessonFlowStepKeys(
  lesson: Pick<
    LessonView,
    'examples' | 'questions' | 'exercises' | 'summary' | 'homework' | 'keyPoints'
  >,
): LessonFlowStepKey[] {
  const keys: LessonFlowStepKey[] = ['intro', 'explanation'];
  if (lesson.examples.length > 0) keys.push('examples');
  if (lesson.questions.length > 0) keys.push('questions');
  if (lesson.exercises.length > 0) keys.push('exercises', 'correction');
  if (lesson.summary || lesson.homework) keys.push('summary');
  if (lesson.keyPoints.length > 0) keys.push('keyPoints');
  keys.push('flashcards', 'revision');
  return keys;
}

/** Generate a written lesson. Provide a topic, or a concept/session to derive it from. */
export interface GenerateLessonRequest {
  topic?: string;
  conceptId?: string;
  tutorSessionId?: string;
  /** Language for a language lesson (e.g. "Spanish"). */
  language?: string;
  /** Difficulty band to pitch the lesson at. */
  level?: 'beginner' | 'intermediate' | 'advanced';
  /** Auto-generate flashcards from the lesson (default true). */
  flashcards?: boolean;
  /** A public Learn journey starts with an explicit learner-authored goal. */
  goalTitle?: string;
  goalPeriod?: 'daily' | 'weekly' | 'monthly';
}
