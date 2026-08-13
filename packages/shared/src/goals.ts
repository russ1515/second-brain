/** Goals & Exams (Sprint 5 persistence).
 *
 * Goals are the learner's daily / weekly / monthly objectives. Exams carry a
 * subject, date and priority; their "preparation level" is DERIVED from
 * ConceptMastery at read time, so the calendar and study space reflect the
 * engines rather than a stored guess. */

export type GoalPeriod = 'daily' | 'weekly' | 'monthly';
export type GoalStatus = 'pending' | 'done';

export interface Goal {
  id: string;
  period: GoalPeriod;
  title: string;
  status: GoalStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface CreateGoalRequest {
  period: GoalPeriod;
  title: string;
}

export type ExamPriority = 'low' | 'medium' | 'high';

export interface ExamView {
  id: string;
  subject: string;
  /** YYYY-MM-DD. */
  date: string;
  priority: ExamPriority;
  /** Days until the exam (0 = today, negative = past). */
  daysUntil: number;
  /** Preparation 0..100, derived from mastery of the matching concept; null if
   *  no concept matches yet. */
  preparation: number | null;
}

export interface CreateExamRequest {
  subject: string;
  /** YYYY-MM-DD. */
  date: string;
  priority: ExamPriority;
}
