import type { RagScope } from './document';
import type { ResearchProviderAvailability } from './research-provider';
import type { ResearchSourceQuality } from './research-provider';

export const RESEARCH_DEPTHS = ['quick', 'sourced', 'deep'] as const;
export type ResearchDepth = (typeof RESEARCH_DEPTHS)[number];

export const RESEARCH_SCOPE_KINDS = [
  'brain',
  'library',
  'documents',
  'collection',
  'external',
  'web',
] as const;
export type ResearchScopeKind = (typeof RESEARCH_SCOPE_KINDS)[number];

/** One explicit provenance boundary. A request can combine bounded scopes. */
export interface ResearchScope {
  kind: ResearchScopeKind;
  documentIds?: string[];
  collectionId?: string;
}

export interface ResearchRunRequest {
  question: string;
  depth: ResearchDepth;
  scopes: ResearchScope[];
}

export type ResearchCitationKind = 'document' | 'brain' | 'external' | 'web';

export interface UnifiedResearchCitation {
  id: string;
  kind: ResearchCitationKind;
  title: string;
  excerpt: string | null;
  documentId?: string;
  conceptId?: string;
  chunkIndex?: number;
  url?: string;
  domain?: string;
  provider?: string;
  publishedAt?: string | null;
  retrievedAt?: string;
  rank?: number;
  quality?: ResearchSourceQuality;
  relevance?: number | null;
}

export interface ResearchClaim {
  text: string;
  citationIds: string[];
}

export interface ResearchPlan {
  question: string;
  queries: string[];
  maxQueries: number;
  maxSources: number;
  maxIterations: number;
  timeoutMs: number;
}

export interface ResearchSection {
  id: string;
  title: string;
  body: string;
  citationIds: string[];
}

export interface ResearchComparison {
  agreements: string[];
  divergences: string[];
  specificities: string[];
}

export type ResearchStageKind = 'sources-found' | 'sources-read' | 'compared' | 'synthesized';

export interface ResearchStage {
  kind: ResearchStageKind;
  completed: true;
  /** A real count only; never an elapsed-time estimate or fabricated percent. */
  itemCount?: number;
}

export interface ResearchResult {
  question: string;
  depth: ResearchDepth;
  scopes: ResearchScope[];
  synthesis: string;
  sections: ResearchSection[];
  keyPoints: string[];
  claims: ResearchClaim[];
  comparison: ResearchComparison | null;
  citations: UnifiedResearchCitation[];
  limits: string[];
  stages: ResearchStage[];
  partial: boolean;
  provider: string | null;
  plan: ResearchPlan | null;
  queries: string[];
  generatedAt: string;
}

export interface ResearchAvailabilityResponse {
  internal: {
    brain: true;
    library: true;
    documents: true;
    collection: true;
  };
  web: ResearchProviderAvailability;
  external: ResearchProviderAvailability;
}

export interface DeepResearchPlanStep {
  id: 'find' | 'compare' | 'verify' | 'synthesize';
  messageCode: string;
}

/** A deterministic preview only. It launches no provider and consumes no quota. */
export function buildDeepResearchPlan(): DeepResearchPlanStep[] {
  return [
    { id: 'find', messageCode: 'research10.plan.find' },
    { id: 'compare', messageCode: 'research10.plan.compare' },
    { id: 'verify', messageCode: 'research10.plan.verify' },
    { id: 'synthesize', messageCode: 'research10.plan.synthesize' },
  ];
}

/** Hard source budgets shared by UI tests and the API. */
export function researchSourceLimit(depth: ResearchDepth): number {
  if (depth === 'quick') return 5;
  if (depth === 'deep') return 16;
  return 10;
}

export function researchExecutionLimits(depth: ResearchDepth): Pick<ResearchPlan, 'maxQueries' | 'maxSources' | 'maxIterations' | 'timeoutMs'> {
  if (depth === 'quick') return { maxQueries: 1, maxSources: 5, maxIterations: 1, timeoutMs: 25_000 };
  if (depth === 'deep') return { maxQueries: 4, maxSources: 16, maxIterations: 1, timeoutMs: 75_000 };
  return { maxQueries: 1, maxSources: 10, maxIterations: 1, timeoutMs: 45_000 };
}

export function researchScopeToRag(scope: ResearchScope): RagScope | null {
  if (scope.kind === 'documents') return { documentIds: [...new Set(scope.documentIds ?? [])].slice(0, 20) };
  if (scope.kind === 'collection') return scope.collectionId ? { collectionId: scope.collectionId } : { documentIds: [] };
  if (scope.kind === 'library') return {};
  return null;
}

export function isExternalResearchScope(
  scope: ResearchScope,
): scope is ResearchScope & { kind: 'external' | 'web' } {
  return scope.kind === 'external' || scope.kind === 'web';
}
