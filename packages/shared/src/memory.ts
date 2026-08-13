/** Learning Memory Engine (Sprint 4, task 4.2).
 *
 * The pedagogical memory: one unified, chronological record of everything the
 * learner has done — lessons, exercises (successes and errors), revisions,
 * conversations, homework, session reports and studied documents. It aggregates
 * what the app already persists so the AI never starts from zero. */

export type MemoryKind =
  | 'lesson'
  | 'success'
  | 'error'
  | 'revision'
  | 'conversation'
  | 'homework'
  | 'report'
  | 'document';

export interface MemoryEntry {
  id: string;
  kind: MemoryKind;
  /** Short headline (e.g. the lesson topic or the exercise question). */
  title: string;
  /** One line of context. */
  detail: string;
  /** Subject in play, when known. */
  subject: string | null;
  /** When it happened (ISO-8601). */
  at: string;
}

/** How much the AI remembers, by category. */
export interface MemorySummary {
  lessons: number;
  exercises: number;
  errors: number;
  successes: number;
  revisions: number;
  conversations: number;
  homework: number;
  reports: number;
  documents: number;
  /** Total remembered events. */
  total: number;
}

export interface LearningMemory {
  summary: MemorySummary;
  /** Most recent memories, newest first. */
  entries: MemoryEntry[];
}
