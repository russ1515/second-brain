import type { LearningCategory, LearningStatus, ReviewRating, ReviewStats } from '@second-brain/shared';

/**
 * Réviser catalog (UI/UX Sprint 6 — FSRS & Smart Cards).
 *
 * Pure helpers + copy for the revision hub. Everything maps the EXISTING FSRS
 * engine (ReviewStats, the /review queue, /cards/:id/review) into the UI — no
 * new scheduling logic. Copy is French (product voice), catalog precedent.
 */

// ── Due categories (task 1) ──────────────────────────────────────────────────
export type DueKind = 'critical' | 'regular' | 'fresh';
export interface DueCategory {
  kind: DueKind;
  icon: string;
  label: string;
  hint: string;
  /** token role resolved by the component. */
  tone: 'error' | 'warning' | 'info';
}
export const DUE_CATEGORIES: Record<DueKind, DueCategory> = {
  critical: { kind: 'critical', icon: '🔴', label: 'Critique', hint: 'À reconsolider en priorité', tone: 'error' },
  regular: { kind: 'regular', icon: '🟡', label: 'Régulier', hint: 'Révisions du jour', tone: 'warning' },
  fresh: { kind: 'fresh', icon: '🔵', label: 'Nouveauté', hint: 'Nouvelles cartes à découvrir', tone: 'info' },
};

/** Split the FSRS stats into the three review categories. */
export function dueBreakdown(stats: ReviewStats): Record<DueKind, number> {
  return {
    critical: stats.relearning,
    regular: stats.review + stats.learning,
    fresh: stats.new,
  };
}

// ── Quick launch (task 1) ────────────────────────────────────────────────────
export interface LaunchOption {
  key: 'flash' | 'full';
  icon: string;
  label: string;
  detail: string;
}
export const LAUNCH_OPTIONS: LaunchOption[] = [
  { key: 'flash', icon: '⚡', label: 'Session Flash 5 min', detail: 'Les cartes les plus urgentes, vite.' },
  { key: 'full', icon: '🎯', label: 'Révision Complète', detail: 'Toute la file du jour, dans l’ordre optimal.' },
];

// ── FSRS ratings (task 2) ────────────────────────────────────────────────────
export interface Grade {
  rating: ReviewRating;
  label: string;
  tone: 'error' | 'warning' | 'success' | 'info';
}
export const GRADES: Grade[] = [
  { rating: 1, label: 'À revoir', tone: 'error' },
  { rating: 2, label: 'Difficile', tone: 'warning' },
  { rating: 3, label: 'Bon', tone: 'success' },
  { rating: 4, label: 'Facile', tone: 'info' },
];

// ── Forgetting curve (task 3) ────────────────────────────────────────────────
/**
 * A 7-day forgetting curve anchored on the learner's REAL retention. It is an
 * illustration of memory decay from where the learner sits today (not per-card
 * invented data): starts at `retention`, decays across the week, and shows how a
 * review resets it. When retention is unknown, a neutral reference curve is used.
 */
export function forgettingCurve(retention: number | null): number[] {
  const start = retention ?? 0.9;
  // Gentle exponential decay over 7 days (day 0 = today).
  return Array.from({ length: 8 }, (_, day) => {
    const r = start * Math.exp(-0.18 * day);
    return Math.max(0.2, Math.min(1, r));
  });
}

// ── Priority levels (task 6) ─────────────────────────────────────────────────
export type Priority = 'critical' | 'reinforce' | 'stable' | 'mastered';
export interface PriorityVisual {
  key: Priority;
  icon: string;
  label: string;
  tone: 'error' | 'warning' | 'success' | 'info';
}
export const PRIORITIES: Record<Priority, PriorityVisual> = {
  critical: { key: 'critical', icon: '🔴', label: 'Critique', tone: 'error' },
  reinforce: { key: 'reinforce', icon: '🟡', label: 'À renforcer', tone: 'warning' },
  stable: { key: 'stable', icon: '🟢', label: 'Stable', tone: 'success' },
  mastered: { key: 'mastered', icon: '🔵', label: 'Maîtrisé', tone: 'info' },
};

/** Map a twin status/mastery to a revision priority (task 6). */
export function priorityOf(status: LearningStatus, mastery: number | null): Priority {
  if (status === 'at_risk' || status === 'blocked') return 'critical';
  const m = mastery ?? 0;
  if (m >= 0.85 || status === 'mastered') return 'mastered';
  if (m >= 0.65) return 'stable';
  return 'reinforce';
}

// ── Retention states (task 5) ────────────────────────────────────────────────
export type RetentionState = 'solid' | 'progressing' | 'fragile' | 'urgent';
export interface RetentionVisual {
  key: RetentionState;
  icon: string;
  label: string;
  tone: 'success' | 'info' | 'warning' | 'error';
}
export const RETENTION_STATES: Record<RetentionState, RetentionVisual> = {
  solid: { key: 'solid', icon: '🟢', label: 'Solide', tone: 'success' },
  progressing: { key: 'progressing', icon: '🔵', label: 'Progresse', tone: 'info' },
  fragile: { key: 'fragile', icon: '🟠', label: 'Fragile', tone: 'warning' },
  urgent: { key: 'urgent', icon: '🔴', label: 'Urgent', tone: 'error' },
};
export function retentionOf(status: LearningStatus, dueCount: number): RetentionState {
  if (status === 'blocked' || dueCount > 0) return 'urgent';
  if (status === 'at_risk') return 'fragile';
  if (status === 'in_progress') return 'progressing';
  return 'solid';
}

// ── Card types (task 3) ──────────────────────────────────────────────────────
export type CardType = 'qr' | 'comprehension' | 'application' | 'recognition';
export const CARD_TYPES: Record<CardType, { label: string; icon: string }> = {
  qr: { label: 'Question / Réponse', icon: '❓' },
  comprehension: { label: 'Compréhension', icon: '🧠' },
  application: { label: 'Application', icon: '🛠️' },
  recognition: { label: 'Reconnaissance', icon: '👁️' },
};

// ── KYC adaptation (task 7) ──────────────────────────────────────────────────
export interface ReviewPersona {
  /** Warmer, simpler tone for the youngest learners. */
  playful: boolean;
  /** Show more analytic depth (curves, probabilities). */
  analytic: boolean;
  intro: string;
  encourage: string;
}
export function reviewPersona(category?: LearningCategory | null): ReviewPersona {
  switch (category) {
    case 'kindergarten':
    case 'primary':
      return { playful: true, analytic: false, intro: 'On revoit ce que tu as appris — c’est comme un petit jeu de mémoire !', encourage: 'Chaque carte revue rend ta mémoire plus forte 💪' };
    case 'secondary':
    case 'highschool':
      return { playful: false, analytic: false, intro: 'Consolide tes cours avant qu’ils ne s’effacent.', encourage: 'La régularité fait toute la différence aux examens.' };
    case 'language':
      return { playful: false, analytic: false, intro: 'Vocabulaire, prononciation et expressions — au bon rythme.', encourage: 'Un peu chaque jour, et la langue s’installe pour de bon.' };
    case 'research':
    case 'university':
      return { playful: false, analytic: true, intro: 'La répétition espacée FSRS optimise ce que tu retiens, au moment optimal.', encourage: 'Ta rétention se construit sur la durée.' };
    default:
      return { playful: false, analytic: false, intro: 'La répétition espacée consolide ce que tu apprends, au bon moment.', encourage: 'Ta mémoire te remerciera.' };
  }
}

/** A short pedagogical "why" for today's session, from the real counts. */
export function todayWhy(stats: ReviewStats): string {
  if (stats.relearning > 0) return `${stats.relearning} concept${stats.relearning > 1 ? 's' : ''} risque${stats.relearning > 1 ? 'nt' : ''} de se perdre aujourd’hui — les revoir maintenant a le plus d’impact.`;
  if (stats.due > 0) return `${stats.due} carte${stats.due > 1 ? 's' : ''} arrive${stats.due > 1 ? 'nt' : ''} à échéance : c’est le moment optimal pour les ancrer durablement.`;
  return 'Tu es à jour — rien d’urgent. Une courte révision reste bénéfique.';
}

/** Rough estimated minutes for a set of cards (~25s/card, floor 1). */
export function estimateMinutes(cards: number): number {
  return Math.max(cards > 0 ? 1 : 0, Math.round((cards * 25) / 60));
}
