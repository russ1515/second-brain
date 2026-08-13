/** Digital Twin — learner profile (Sprint 4, task 4.1).
 *
 * Beyond the knowledge twin (mastery per concept), this is the BEHAVIOURAL
 * profile of the learner: how they learn, not just what they know. Every field
 * is DERIVED from real interaction data (lessons, tutoring, exercises, FSRS),
 * so the profile evolves after each interaction, and any dimension without
 * enough evidence yet reports null rather than a guess. */

export type LearnerBand = 'new' | 'weak' | 'building' | 'strong';
export type LearningSpeed = 'building' | 'steady' | 'fast';
export type LearningStyle = 'voice' | 'handsOn' | 'reading';
export type ExplanationDepth = 'simple' | 'balanced' | 'deep';
export type WorkRhythm = 'occasional' | 'regular' | 'intensive';
export type FocusWindow = 'morning' | 'afternoon' | 'evening' | 'night';

export interface LearnerProfile {
  /** Real level, from the FSRS-derived knowledge twin. */
  level: { band: LearnerBand; score: number | null };
  /** How fast they're getting things right (from graded exercises). */
  learningSpeed: LearningSpeed | null;
  /** Subjects they spend the most time on, most-frequent first (up to 3). */
  preferredSubjects: string[];
  /** Dominant way they engage: spoken, hands-on practice, or reading. */
  learningStyle: LearningStyle | null;
  /** Depth of explanation they tend to work at (from lesson difficulty). */
  explanationDepth: ExplanationDepth | null;
  /** Language they study in most, when one dominates. */
  preferredLanguage: string | null;
  /** How regularly they work (activity over the last week). */
  workRhythm: WorkRhythm | null;
  /** Time of day they're most active. */
  focusWindow: FocusWindow | null;
  /** Overall progress snapshot. */
  overallProgress: {
    score: number | null;
    conceptsTracked: number;
    lessons: number;
  };
  /** Total interactions the twin has learned from so far. */
  interactions: number;
  /** When the twin last saw activity (ISO), null if none. */
  updatedAt: string | null;
}
