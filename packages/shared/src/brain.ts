import type { ActionDestination } from './next-best-action';
import type { LearningDna } from './learning-dna';
import type { LearnerProfile } from './learner-profile';
import type { LearningPathItem, LearningStatus, StrengthsWeaknesses, TwinGraph, TwinGraphNode } from './concept';
import type { MemoryEntry, MemorySummary } from './memory';
import type { KycTeacher } from './onboarding';
import type { RiskPrediction } from './prediction';

export type BrainMaturity = 'sparse' | 'medium' | 'dense';
export type BrainView = 'overview' | 'knowledge' | 'learning' | 'memory' | 'history';

export const BRAIN_OVERVIEW_SOURCES = [
  'knowledge',
  'strengths',
  'learningDna',
  'learnerProfile',
  'declaredProfile',
  'memory',
  'path',
  'foresight',
  'documents',
] as const;

export type BrainOverviewSource = (typeof BRAIN_OVERVIEW_SOURCES)[number];
export type BrainSourceState = 'available' | 'unavailable';

export interface BrainMaturityView {
  level: BrainMaturity;
  conceptCount: number;
  edgeCount: number;
  historyCount: number;
}

export interface BrainDeclaredProfile {
  preferences: string[];
  teacher: KycTeacher | null;
  subjects: string[];
  goals: string[];
}

export interface BrainDocumentReference {
  id: string;
  title: string;
  subject: string | null;
  status: 'pending' | 'processing' | 'ready' | 'failed';
  updatedAt: string;
}

export interface BrainForesight {
  prediction: RiskPrediction;
  generatedAt: string;
  /** Forecasts are estimates, never current facts. */
  isForecast: true;
}

export interface BrainNextAction {
  kind: 'review' | 'learn';
  concept: Pick<LearningPathItem, 'conceptId' | 'name' | 'status' | 'dueCount'>;
  destination: ActionDestination;
  evidence: {
    status: LearningStatus;
    dueCount: number;
    masteryKnown: boolean;
  };
}

export interface BrainOverview {
  generatedAt: string;
  maturity: BrainMaturityView;
  strengths: StrengthsWeaknesses | null;
  learningDna: LearningDna | null;
  learnerProfile: LearnerProfile | null;
  declaredProfile: BrainDeclaredProfile | null;
  memory: { summary: MemorySummary; recentEntries: MemoryEntry[] } | null;
  nextPathItems: LearningPathItem[];
  foresight: BrainForesight | null;
  recentDocuments: BrainDocumentReference[];
  nextBestAction: BrainNextAction | null;
  sources: Record<BrainOverviewSource, BrainSourceState>;
  partial: boolean;
}

export interface BrainGraphPage extends TwinGraph {
  nextCursor: string | null;
  total: number;
  bounded: true;
  documentId: string | null;
}

export interface BrainConceptRelation {
  id: string;
  conceptId: string;
  name: string;
  relation: 'prerequisite' | 'related';
  direction: 'incoming' | 'outgoing';
}

export interface BrainConceptInteraction {
  id: string;
  kind: 'review' | 'lesson' | 'conversation';
  title: string;
  at: string;
}

export interface BrainConceptView {
  node: TwinGraphNode;
  description: string | null;
  cardCount: number;
  reviewedCount: number;
  dueCount: number;
  memoryStabilityDays: number | null;
  nextReviewAt: string | null;
  sources: BrainDocumentReference[];
  relations: BrainConceptRelation[];
  recentInteractions: BrainConceptInteraction[];
  sourcesTruncated: boolean;
  relationsTruncated: boolean;
}

export type BrainSearchResultKind = 'concept' | 'document' | 'goal';

export interface BrainSearchResult {
  id: string;
  kind: BrainSearchResultKind;
  title: string;
  detail: string | null;
  updatedAt: string;
  destination: ActionDestination;
}

export interface BrainSearchPage {
  items: BrainSearchResult[];
  nextCursor: string | null;
}

export type BrainAnswerKind = 'weakest' | 'neglected' | 'documents' | 'knowledge' | 'no-results';

export interface BrainAnswer {
  kind: BrainAnswerKind;
  concepts: TwinGraphNode[];
  documents: BrainDocumentReference[];
  evidenceCount: number;
  /** True because this endpoint only summarizes persisted learner data. */
  grounded: true;
}

/**
 * Data-maturity gates used by API and clients. They control composition only;
 * they never manufacture knowledge, mastery or predictions.
 */
export function resolveBrainMaturity(input: {
  conceptCount: number;
  edgeCount: number;
  historyCount: number;
}): BrainMaturity {
  if (
    input.conceptCount >= 100
    && (input.edgeCount >= 50 || input.historyCount >= 100)
  ) return 'dense';
  if (
    input.conceptCount >= 10
    || input.edgeCount >= 5
    || input.historyCount >= 10
  ) return 'medium';
  return 'sparse';
}

/** Authoritative learning-status rule, shared with the existing learning path. */
export function classifyLearningStatus(input: {
  mastery: number | null;
  reviewedCount: number;
  dueCount: number;
  hasUnmetPrerequisites: boolean;
}): LearningStatus {
  if (input.mastery !== null && input.mastery >= 0.8) return 'mastered';
  if (input.reviewedCount > 0) {
    return input.dueCount > 0 || (input.mastery ?? 0) < 0.5
      ? 'at_risk'
      : 'in_progress';
  }
  return input.hasUnmetPrerequisites ? 'blocked' : 'ready';
}
