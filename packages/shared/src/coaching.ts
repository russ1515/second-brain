/**
 * Personalized Academic Coach (Sprint 9.2).
 *
 * A coach that becomes UNIQUE to each learner: it accompanies (goals, motivation,
 * discipline, habits, progression) and ADAPTS four dimensions of how they study —
 * pace, difficulty, session length and pedagogical method — from their real
 * behaviour. Every adapted value is EXPLICABLE (carries its reason) and its
 * SOURCE is explicit: `coach` when the AI derived it, `you` when the learner
 * overrode it. The engine reuses the twin, the mentor's streak and the goals; it
 * does not recompute any of that logic.
 */

/** How much new material to push. */
export type CoachPace = 'gentle' | 'steady' | 'intensive';
/** The level content is pitched at (mirrors the twin's mastery bands). */
export type CoachDifficulty = 'beginner' | 'intermediate' | 'advanced';
/** The pedagogical method the coach leans on right now. */
export type CoachMethod = 'practice' | 'reading' | 'socratic' | 'mixed';

/** Who decided a setting: the coach (automatic) or the learner (an override). */
export type CoachSource = 'coach' | 'you';

/** One adapted dimension: the effective value, who set it, and why. */
export interface CoachSetting<T> {
  value: T;
  source: CoachSource;
  reason: string;
}

/** The learner state the coach accompanies (all reused from other engines). */
export interface CoachAccompaniment {
  streak: { current: number; longest: number; studiedToday: boolean };
  /** Consistency read: strong (≥5) / building (≥2) / irregular. */
  discipline: 'strong' | 'building' | 'irregular';
  /** Study sessions completed in the last 7 days (a habit signal). */
  sessionsLast7: number;
  goals: { total: number; done: number };
  progression: {
    /** Mean mastery over tracked concepts, 0..100, or null if none tracked. */
    averageMastery: number | null;
    mastered: number;
    tracked: number;
  };
}

/** The full, personalised coaching plan. */
export interface CoachPlan {
  headline: string;
  pace: CoachSetting<CoachPace>;
  difficulty: CoachSetting<CoachDifficulty>;
  sessionMinutes: CoachSetting<number>;
  method: CoachSetting<CoachMethod>;
  accompaniment: CoachAccompaniment;
  /** When the coach last recomputed its guidance. */
  updatedAt: string;
}

/**
 * A learner override — a USER decision that pins a dimension over the coach.
 * Any omitted field is left unchanged; `reset: true` hands every dimension back
 * to the coach.
 */
export interface UpdateCoachRequest {
  pace?: CoachPace;
  difficulty?: CoachDifficulty;
  sessionMinutes?: number;
  method?: CoachMethod;
  reset?: boolean;
}
