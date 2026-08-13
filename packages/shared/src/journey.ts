/** Daily learning journey (Phase 5, Educational Engine) wire contracts. */

/** The four moments of the day, per the Educational Engine spec. */
export type PlanSlot = 'morning' | 'afternoon' | 'evening' | 'night';

export const PLAN_SLOTS: readonly PlanSlot[] = [
  'morning',
  'afternoon',
  'evening',
  'night',
] as const;

export type PlanItemKind =
  | 'review'
  | 'lesson'
  | 'exercises'
  | 'quick_revision'
  | 'vocabulary';

export type PlanItemStatus = 'pending' | 'done' | 'skipped';

export interface DailyPlanItemView {
  id: string;
  slot: PlanSlot;
  kind: PlanItemKind;
  title: string;
  detail: string | null;
  status: PlanItemStatus;
  position: number;
  /** Cards / exercises this item covers, when countable. */
  targetCount: number | null;
  conceptId: string | null;
  deckId: string | null;
  languageProfileId: string | null;
  completedAt: string | null;
}

export interface DailyPlanView {
  id: string;
  /** The learner's LOCAL calendar day, `YYYY-MM-DD`. */
  date: string;
  /** Timezone the local day was computed in. */
  timezone: string;
  items: DailyPlanItemView[];
  generatedAt: string;
  updatedAt: string;
}

export interface UpdateJourneySettingsRequest {
  /** IANA timezone, e.g. "Europe/Paris". */
  timezone: string;
}

export interface JourneySettings {
  timezone: string;
}
