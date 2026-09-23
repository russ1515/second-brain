import type { CalendarEntryKind } from './calendar';
import type { ExperienceProgress, ExperienceSessionStatus, ExperienceSessionType } from './experience-session';
import type { GoalPeriod } from './goals';
import type { ActionDestination, NextBestAction } from './next-best-action';

export const HOME_OVERVIEW_SOURCES = [
  'recommendations',
  'coach',
  'initiatives',
  'foresight',
  'reviews',
  'exams',
  'sessions',
  'goals',
  'calendar',
  'progress',
] as const;

export type HomeOverviewSource = (typeof HOME_OVERVIEW_SOURCES)[number];
export type HomeSourceState = 'available' | 'unavailable';

export type HomeContextKind =
  | 'new'
  | 'active'
  | 'exam'
  | 'revision'
  | 'resume'
  | 'caught-up';

export interface HomeContextView {
  kind: HomeContextKind;
  /** A user-owned title/subject that can safely complete localized UI copy. */
  focusLabel: string | null;
}

export interface HomeSessionArtifact {
  kind: string;
  id: string | null;
  title: string | null;
}

export interface HomeResumableSession {
  id: string;
  type: ExperienceSessionType;
  status: Extract<ExperienceSessionStatus, 'active' | 'paused'>;
  title: string | null;
  contextLabels: string[];
  updatedAt: string;
  progress: ExperienceProgress | null;
  artifact: HomeSessionArtifact | null;
  destination: ActionDestination;
}

export interface HomeUpcomingItem {
  id: string;
  kind: CalendarEntryKind;
  title: string;
  date: string;
  destination: ActionDestination;
}

export interface HomeGoalPreview {
  id: string;
  title: string;
  period: GoalPeriod;
  /** Null until a goal engine can provide measured completed/total progress. */
  progress: number | null;
  destination: ActionDestination;
}

export interface HomeProgressSummary {
  reviewsDue: number;
  conceptsAtRisk: number;
  conceptsMastered: number;
  cardsReviewed: number;
  streakDays: number;
}

/** One network payload for Home. Every field is independently degradable. */
export interface HomeOverview {
  generatedAt: string;
  context: HomeContextView;
  nextBestAction: NextBestAction | null;
  resumableSessions: HomeResumableSession[];
  mainGoal: HomeGoalPreview | null;
  upcoming: HomeUpcomingItem[];
  progress: HomeProgressSummary | null;
  sources: Record<HomeOverviewSource, HomeSourceState>;
  partial: boolean;
}

export type HomeComposition = 'single-column' | 'adaptive' | 'wide';

export const HOME_CONTENT_ORDER = [
  'next-best-action',
  'resume',
  'upcoming',
  'goal',
  'progress',
  'quick-actions',
] as const;

/** Structural responsive decision used by Home and covered by contract tests. */
export function resolveHomeComposition(width: number): HomeComposition {
  if (!Number.isFinite(width) || width < 0) throw new Error('Home viewport width must be non-negative.');
  if (width < 760) return 'single-column';
  if (width < 1100) return 'adaptive';
  return 'wide';
}
