/** Session Orchestrator (Sprint 3, task 3.7) wire contracts.
 *
 * A study session is a single orchestrated loop the AI drives end to end —
 * Accueil → Leçon → Questions → Exercices → Correction → Résumé → Flashcards →
 * FSRS → Digital Twin update → Fin — so the learner follows one thread instead
 * of clicking around. `start` opens it (picks the target, snapshots the twin,
 * generates the lesson); `complete` closes it (recomputes the twin and reports
 * what moved). */

export interface StartSessionRequest {
  /** Force a concept to study; otherwise the AI picks the most actionable one. */
  conceptId?: string;
  /** Fallback topic when the learner has nothing tracked yet. */
  topic?: string;
}

// ── AI Teacher comprehension check (Sprint 7.1) ─────────────────────────────

/** How well the teacher judges the student understood a question. */
export type ComprehensionVerdict = 'understood' | 'partial' | 'confused';

export interface ComprehensionRequest {
  /** The question the teacher asked. */
  question: string;
  /** The student's answer. */
  answer: string;
}

/**
 * The teacher's read of a student's answer — how it detects a misunderstanding
 * and adapts the pace: when the answer is partial/confused it re-explains the
 * point more simply before moving on.
 */
export interface ComprehensionResult {
  verdict: ComprehensionVerdict;
  /** Encouraging feedback on the answer, in the lesson's language. */
  feedback: string;
  /** A simpler re-explanation when not fully understood (null when understood). */
  reexplanation: string | null;
}

/** The opening "Accueil": what the AI chose to work on and the plan. */
export interface SessionPlan {
  sessionId: string;
  lessonId: string;
  conceptId: string | null;
  /** What we're studying (concept or topic name). */
  subject: string;
  /** The AI's spoken-first framing of the session. */
  planMessage: string;
  estimatedMinutes: number;
  /** Learning Score (0..100) at the start, null if nothing tracked yet. */
  learningScoreBefore: number | null;
}

/** The closing "Fin de séance": the loop closed, with what actually moved. */
export interface SessionReport {
  sessionId: string;
  subject: string;
  conceptId: string | null;
  lessonId: string;
  /** Graded exercises attempted this session, and how many were correct. */
  exercisesAttempted: number;
  exercisesCorrect: number;
  /** Flashcards the lesson scheduled into the FSRS queue. */
  cardsScheduled: number;
  /** Days until the soonest of those cards is due (0 = due now). */
  nextReviewInDays: number | null;
  /** Learning Score before/after and the delta (Digital Twin update). */
  learningScoreBefore: number | null;
  learningScoreAfter: number | null;
  scoreDelta: number | null;
  /** Concept mastery (0..100) before/after; null when not concept-tracked. */
  masteryBefore: number | null;
  masteryAfter: number | null;
  /** True once the Digital Twin tracks this concept (cards linked). */
  conceptTracked: boolean;
}
