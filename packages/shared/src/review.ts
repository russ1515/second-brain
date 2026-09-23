import type { ExperienceSession } from './experience-session';
import type { CardState, ReviewRating, ReviewStats } from './flashcards';
import type { ReviewableKind, ReviewPriority, ReviewUrgency } from './revision-engine';

/** Product-level review contracts. FSRS remains implemented by the existing
 * card and generic revision engines; these types only compose their outputs. */
export type ReviewItemEngine = 'flashcard' | 'reviewable';
export type ReviewActivityFormat = 'flashcard' | 'free-recall';

export const REVIEW_SESSION_SIZES = [5, 10, 'all'] as const;
export type ReviewSessionSize = (typeof REVIEW_SESSION_SIZES)[number];

export type ReviewPriorityReasonCode =
  | 'due-now'
  | 'overdue'
  | 'relearning'
  | 'target-concept'
  | 'source-document'
  | 'exam-soon'
  | 'active-goal'
  | 'interrupted-session';

export interface ReviewPriorityReason {
  code: ReviewPriorityReasonCode;
  /** A verified count or number of days, when the reason has one. */
  value?: number;
}

export interface ReviewConceptReference {
  id: string;
  name: string;
}

export interface ReviewSourceReference {
  documentId: string;
  title: string;
}

export interface ReviewExperienceItem {
  /** Stable within a session and safe to persist in ExperienceSession JSON. */
  reference: string;
  id: string;
  engine: ReviewItemEngine;
  kind: ReviewableKind;
  format: ReviewActivityFormat;
  title: string;
  prompt: string;
  /** Null for free recall: no correction is fabricated. */
  answer: string | null;
  dueAt: string;
  priority: ReviewPriority;
  urgency: ReviewUrgency;
  state?: CardState;
  reps: number;
  lapses: number;
  concepts: ReviewConceptReference[];
  source: ReviewSourceReference | null;
  /** Present when the card belongs to a language vocabulary deck. */
  languageProfileId?: string;
  language?: string;
  reasons: ReviewPriorityReason[];
}

export interface ReviewContextView {
  concept: ReviewConceptReference | null;
  document: ReviewSourceReference | null;
  goal: { id: string; title: string } | null;
  exam: { id: string; subject: string; daysUntil: number } | null;
  sourceSessionId: string | null;
  language: { id: string; language: string; vocabDeckId: string | null } | null;
}

export interface ReviewDailyPlan {
  today: number;
  tomorrow: number;
  nextDueAt: string | null;
  nextExam: { id: string; subject: string; daysUntil: number } | null;
}

export interface ReviewHomeView {
  generatedAt: string;
  stats: ReviewStats;
  dueCount: number;
  flashcardDueCount: number;
  activityDueCount: number;
  overdueCount: number;
  priorityItems: ReviewExperienceItem[];
  context: ReviewContextView;
  resumableSession: ExperienceSession | null;
  plan: ReviewDailyPlan;
  /** True when an optional source failed while the usable queue remained. */
  partial: boolean;
}

export interface StartReviewSessionRequest {
  size?: ReviewSessionSize;
  conceptId?: string;
  documentId?: string;
  goalId?: string;
  examId?: string;
  sourceSessionId?: string;
  languageProfileId?: string;
  idempotencyKey?: string;
}

export interface ReviewSessionSummary {
  reviewed: number;
  ratings: Record<ReviewRating, number>;
  difficult: number;
  concepts: ReviewConceptReference[];
  nextReviewAt: string | null;
}

export interface ReviewSessionView {
  session: ExperienceSession;
  items: ReviewExperienceItem[];
  completedItemReferences: string[];
  unavailableCount: number;
  summary: ReviewSessionSummary;
}

export interface GradeReviewSessionItemRequest {
  itemReference: string;
  rating: ReviewRating;
}

export type ReviewFeedbackCode = 'review-soon' | 'still-fragile' | 'good-recall' | 'easy-recall';

export interface GradeReviewSessionItemResponse {
  review: ReviewSessionView;
  feedback: ReviewFeedbackCode;
  nextReviewAt: string | null;
  persisted: true;
}

export function reviewItemReference(engine: ReviewItemEngine, id: string): string {
  return `${engine}:${id}`;
}

export function parseReviewItemReference(value: string): { engine: ReviewItemEngine; id: string } | null {
  const separator = value.indexOf(':');
  if (separator <= 0 || separator === value.length - 1) return null;
  const engine = value.slice(0, separator);
  if (engine !== 'flashcard' && engine !== 'reviewable') return null;
  return { engine, id: value.slice(separator + 1) };
}

export function reviewFeedbackCode(rating: ReviewRating): ReviewFeedbackCode {
  if (rating === 1) return 'review-soon';
  if (rating === 2) return 'still-fragile';
  if (rating === 3) return 'good-recall';
  return 'easy-recall';
}

export function reviewPriorityRank(priority: ReviewPriority): number {
  if (priority === 'urgent') return 3;
  if (priority === 'high') return 2;
  if (priority === 'medium') return 1;
  return 0;
}
