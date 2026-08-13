/** Examiner role (Phase 5, Educational Engine): assessment, detailed correction,
 *  personalised feedback, and knowledge-gap detection. */

export interface SubmitAttemptRequest {
  /** The learner's answer to the exercise. */
  answer: string;
}

/** The prerequisite blamed for a mistake, found by walking the knowledge graph.
 *
 * Spec: "Mistakes are never isolated; each triggers root-cause analysis via the
 * Knowledge Graph (fails Genetics → weak DNA detected → revisit DNA first)."
 */
export interface KnowledgeGap {
  conceptId: string;
  name: string;
  /** The learner's mastery of this prerequisite (0..1), or null if untracked. */
  mastery: number | null;
  /** Why this prerequisite is being blamed. */
  reason: string;
}

export interface ExerciseAttemptView {
  id: string;
  lessonId: string;
  exerciseIndex: number;
  question: string;
  expectedAnswer: string;
  learnerAnswer: string;
  correct: boolean;
  /** 0..1 — partial credit; understanding is rarely binary. */
  score: number;
  /** What was right, what was wrong, and why. */
  correction: string;
  /** Personalised feedback aimed at this learner's next step. */
  feedback: string;
  /**
   * A real teacher's correction, never a bare "correct/incorrect". Structured
   * so the UI can show it as the four questions a teacher answers:
   *   why       → Pourquoi ? (why the answer is/ isn't right)
   *   how       → Comment ? (how to reach the right answer)
   *   errorMade → Quelle erreur ? (the specific mistake; null when correct)
   *   howToAvoid→ Comment éviter ? (how to avoid it next time; null when correct)
   */
  why: string;
  how: string;
  errorMade: string | null;
  howToAvoid: string | null;
  conceptId: string | null;
  createdAt: string;
}

export interface SubmitAttemptResponse {
  attempt: ExerciseAttemptView;
  /** Present only when a mistake was traced to a weak prerequisite. */
  rootCause: KnowledgeGap | null;
}

// ── AI Examiner (Sprint 7.6): create, grade, explain, advise ──

/** The assessment types the teacher-as-examiner can create. */
export type AssessmentType =
  | 'mcq'
  | 'open'
  | 'dissertation'
  | 'exercise'
  | 'case_study'
  | 'mock_exam'
  | 'oral';

export const ASSESSMENT_TYPES: readonly AssessmentType[] = [
  'mcq',
  'open',
  'dissertation',
  'exercise',
  'case_study',
  'mock_exam',
  'oral',
] as const;

export type AssessmentDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** How a single question is answered. A mock_exam mixes formats; every other
 *  type uses one. `mcq` = pick an option; `open` = free text (also used for
 *  dissertations, case studies and oral answers). */
export type QuestionFormat = 'mcq' | 'open';

/** A question as the LEARNER sees it — the answer key/rubric is stripped out. */
export interface AssessmentQuestionView {
  id: string;
  prompt: string;
  format: QuestionFormat;
  /** Choices when format='mcq'; absent otherwise. */
  options?: string[];
  /** Marks this question is worth. */
  points: number;
}

export interface CreateAssessmentRequest {
  type: AssessmentType;
  /** What to assess, e.g. "la génétique mendélienne". */
  topic: string;
  /** Number of questions (bounded 1..20); ignored where the type implies one
   *  (dissertation). Defaults per type. */
  questionCount?: number;
  difficulty?: AssessmentDifficulty;
  /** Optional concept this assesses (enables gap-aware advice). */
  conceptId?: string;
}

export interface SubmitAssessmentRequest {
  /** Answers aligned to the assessment's questions, by index. */
  answers: string[];
}

/** One graded answer. Never a bare mark: the four teacher questions travel with
 *  it — the same shape as ExerciseAttemptView, so every correction in the app
 *  reads the same way. */
export interface GradedAnswer {
  questionId: string;
  prompt: string;
  learnerAnswer: string;
  awarded: number;
  max: number;
  verdict: 'correct' | 'partial' | 'incorrect';
  why: string;
  how: string;
  /** The specific mistake; null when fully correct. */
  errorMade: string | null;
  /** How to avoid it next time; null when fully correct. */
  howToAvoid: string | null;
}

export interface AssessmentSubmissionView {
  id: string;
  assessmentId: string;
  /** 0..100 overall. */
  score: number;
  results: GradedAnswer[];
  /** Honest, encouraging overall read. */
  summary: string;
  /** Concrete next steps — the grade is never alone. */
  advice: string;
  createdAt: string;
}

export interface AssessmentView {
  id: string;
  type: AssessmentType;
  topic: string;
  title: string;
  level: string | null;
  questions: AssessmentQuestionView[];
  createdAt: string;
  /** Most recent graded attempt, when the learner has submitted. */
  latestSubmission: AssessmentSubmissionView | null;
}

/** List-row projection. */
export interface AssessmentSummary {
  id: string;
  type: AssessmentType;
  topic: string;
  title: string;
  questionCount: number;
  createdAt: string;
  /** Best/most-recent score if attempted, else null. */
  score: number | null;
}
