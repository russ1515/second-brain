/** AI Study Planner (Sprint 5, task 5.2).
 *
 * The conductor. It creates nothing itself — it ASSEMBLES the decisions already
 * made by FSRS, the Digital Twin, ConceptMastery, Learning Memory, the
 * Knowledge Graph and the Adaptive Learning Path into a single time-blocked day
 * (08:00 Revision → 08:20 Lesson → …). The plan is live: recomputed from the
 * current state, it changes as the day and the learner change. */

export type PlanBlockKind =
  | 'revision'
  | 'lesson'
  | 'discussion'
  | 'practical'
  | 'quiz'
  | 'summary'
  | 'break'
  | 'end';

/** One time slot in the day. */
export interface PlanBlock {
  /** Start time, local, "HH:MM". */
  start: string;
  /** Duration in minutes (0 for the closing marker). */
  minutes: number;
  kind: PlanBlockKind;
  /** The concept/topic this block is about, when it targets one. */
  subject: string | null;
  /** A deep link the app can launch for this block. */
  route: string | null;
}

/** The engines whose decisions the planner assembled. */
export type PlanSource =
  | 'fsrs'
  | 'digitalTwin'
  | 'conceptMastery'
  | 'learningMemory'
  | 'knowledgeGraph'
  | 'adaptivePath';

export interface DayPlan {
  /** The learner's local day, YYYY-MM-DD. */
  date: string;
  /** When the day's plan starts, "HH:MM". */
  startsAt: string;
  blocks: PlanBlock[];
  /** Which engines contributed to this plan. */
  sources: PlanSource[];
  /** True when the plan was rebuilt from the current moment (a live replan). */
  live: boolean;
}
