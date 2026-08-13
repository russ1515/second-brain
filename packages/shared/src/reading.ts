/** Reading coach (Sprint 7.7): generate a passage pitched at the learner's
 *  level, ask comprehension questions, evaluate, and auto-adapt the level. */

import type { GradedAnswer, QuestionFormat } from './assessment';

export type ReadingLevel = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export const READING_LEVELS: readonly ReadingLevel[] = [
  'beginner',
  'intermediate',
  'advanced',
  'expert',
] as const;

/** A comprehension question as the LEARNER sees it — answer key stripped. */
export interface ReadingQuestionView {
  id: string;
  prompt: string;
  format: QuestionFormat;
  options?: string[];
  points: number;
}

export type LevelChange = 'up' | 'down' | 'same';

/** The evaluation of one attempt, plus the auto-adaptation decision. */
export interface ReadingResultView {
  score: number;
  results: GradedAnswer[];
  summary: string;
  previousLevel: ReadingLevel;
  newLevel: ReadingLevel;
  levelChange: LevelChange;
}

export interface ReadingExerciseView {
  id: string;
  level: ReadingLevel;
  topic: string | null;
  title: string;
  /** The passage to read. */
  text: string;
  questions: ReadingQuestionView[];
  createdAt: string;
  /** Present once submitted. */
  latestResult: ReadingResultView | null;
}

export interface ReadingExerciseSummary {
  id: string;
  level: ReadingLevel;
  title: string;
  topic: string | null;
  score: number | null;
  createdAt: string;
}

export interface GenerateReadingRequest {
  topic?: string;
  /** Override the auto-tracked level for this one exercise. */
  level?: ReadingLevel;
}

export interface SubmitReadingRequest {
  /** Answers aligned to the exercise's questions, by index. */
  answers: string[];
}

/** The learner's current auto-tracked reading level. */
export interface ReadingLevelView {
  level: ReadingLevel;
}
