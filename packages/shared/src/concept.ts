/** Digital Twin (Phase 4) wire contracts: concepts and knowledge-graph edges. */

export type ConceptRelation = 'prerequisite' | 'related';

/** A directed edge, carrying the neighbour's name for convenient graph rendering. */
export interface ConceptEdgeView {
  id: string;
  relation: ConceptRelation;
  sourceId: string;
  sourceName: string;
  targetId: string;
  targetName: string;
  createdAt: string;
}

/** A flashcard linked to a concept (minimal label form). */
export interface LinkedCard {
  id: string;
  front: string;
}

/** A document linked to a concept (minimal label form). */
export interface LinkedDocument {
  id: string;
  title: string;
}

export interface ConceptSummary {
  id: string;
  name: string;
  description?: string;
  /** Number of edges touching this concept (in + out). */
  edgeCount: number;
  /** Number of flashcards linked to this concept. */
  cardCount: number;
  /** Number of documents linked to this concept. */
  documentCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ConceptDetail extends ConceptSummary {
  /** Edges where this concept is the source. */
  outgoingEdges: ConceptEdgeView[];
  /** Edges where this concept is the target. */
  incomingEdges: ConceptEdgeView[];
  cards: LinkedCard[];
  documents: LinkedDocument[];
}

export interface CreateConceptRequest {
  name: string;
  description?: string;
}

export interface UpdateConceptRequest {
  name?: string;
  description?: string;
}

/** Create an edge from a concept to another of the caller's concepts. */
export interface CreateConceptEdgeRequest {
  targetConceptId: string;
  relation: ConceptRelation;
}

/** Link a flashcard to a concept. */
export interface LinkCardRequest {
  cardId: string;
}

/** Link a document to a concept. */
export interface LinkDocumentRequest {
  documentId: string;
}

/** Mastery band for a concept in the Digital Twin. */
export type MasteryLevel = 'unknown' | 'weak' | 'developing' | 'strong';

/** Per-concept mastery derived from the FSRS state of its linked cards. */
export interface ConceptMastery {
  conceptId: string;
  name: string;
  /** Mean recall probability (0..1) across linked cards; null if no cards linked. */
  mastery: number | null;
  level: MasteryLevel;
  cardCount: number;
  /** Cards reviewed at least once. */
  reviewedCount: number;
  /** Cards due for review now. */
  dueCount: number;
  /** Total lapses across linked cards. */
  lapses: number;
}

/** How much evidence backs a concept's mastery estimate. */
export type MasteryConfidence = 'low' | 'medium' | 'high';
/** How often the learner slips on a concept. */
export type ErrorFrequency = 'none' | 'low' | 'high';
/** How urgently a concept needs reviewing. */
export type RevisionPriority = 'low' | 'medium' | 'high' | 'urgent';

/**
 * ConceptMastery enriched with the per-concept signals of task 4.3: a star
 * rating plus confidence, error frequency, estimated forgetting and revision
 * priority. All derived from the same FSRS state — no new inputs.
 */
export interface ConceptMasteryDetail extends ConceptMastery {
  /** 0–5 star rating (0 only when untracked). */
  stars: number;
  /** Confidence in the estimate (from how much it's been reviewed). */
  confidence: MasteryConfidence;
  /** Error frequency (from FSRS lapses). */
  errorFrequency: ErrorFrequency;
  /** Estimated share already forgotten, 0..100; null when untracked. */
  forgettingRisk: number | null;
  /** How urgently this should be revised. */
  revisionPriority: RevisionPriority;
}

/** A concept reduced to its score, for the strengths/weaknesses view. */
export interface ConceptScore {
  conceptId: string;
  name: string;
  /** Mastery 0..1 (never null here — only scored concepts appear). */
  mastery: number;
  /** 1–5 star rating. */
  stars: number;
}

/**
 * Strengths & weaknesses (task 4.5): the concepts the learner is strong at vs
 * the ones slipping. The AI uses this to personalise the next sessions.
 */
export interface StrengthsWeaknesses {
  /** Strongly-mastered concepts, best first. */
  strengths: ConceptScore[];
  /** Weak or at-risk concepts, weakest first. */
  weaknesses: ConceptScore[];
}

/** Adaptive Learning Path (task 5.7): what the learner should do, in order, to
 *  reach a goal concept. Each step is a prerequisite to consolidate or one
 *  that's already solid; the goal comes last. */
export type PathStepAction = 'consolidate' | 'ready' | 'target';

export interface AdaptivePathStep {
  conceptId: string;
  name: string;
  /** Mastery 0..100, null if untracked. */
  mastery: number | null;
  action: PathStepAction;
}

export interface AdaptivePath {
  target: { conceptId: string; name: string };
  /** Ordered: prerequisites first (dependency order), the goal last. */
  steps: AdaptivePathStep[];
  /** The weak prerequisites to consolidate first, in order. */
  consolidateFirst: string[];
  /** True when nothing needs consolidating — the goal can start now. */
  readyForTarget: boolean;
}

/** Digital Twin overview: mastery per concept + aggregate summary. */
export interface TwinOverview {
  /** Concepts weakest-first (most actionable), unknown (no cards) last. */
  concepts: ConceptMastery[];
  summary: {
    totalConcepts: number;
    /** Concepts with at least one linked card. */
    trackedConcepts: number;
    strongConcepts: number;
    weakConcepts: number;
    /** Tracked concepts whose cards have never been reviewed. */
    unlearnedConcepts: number;
    /** Mean mastery over tracked concepts (0..1), null if none tracked. */
    averageMastery: number | null;
  };
}

/** Where a concept sits in the learner's journey (prerequisite-aware). */
export type LearningStatus =
  /** mastery ≥ strong threshold. */
  | 'mastered'
  /** studied before but decaying / has due cards — review now. */
  | 'at_risk'
  /** actively being learned (reviewed, partial mastery). */
  | 'in_progress'
  /** not started, prerequisites satisfied — ready to begin. */
  | 'ready'
  /** not started, has unmet prerequisites. */
  | 'blocked';

export interface ConceptRef {
  id: string;
  name: string;
}

/** One entry in the prioritised study plan. */
export interface LearningPathItem {
  conceptId: string;
  name: string;
  status: LearningStatus;
  mastery: number | null;
  level: MasteryLevel;
  dueCount: number;
  /** Prerequisite concepts not yet mastered (populated for `blocked`). */
  blockedBy: ConceptRef[];
}

/** Prioritised learning path: most-actionable concepts first. */
export interface LearningPath {
  items: LearningPathItem[];
}

export interface TwinGraphNode {
  id: string;
  name: string;
  mastery: number | null;
  level: MasteryLevel;
  status: LearningStatus;
}

export interface TwinGraphEdge {
  id: string;
  sourceId: string;
  targetId: string;
  relation: ConceptRelation;
}

/** The knowledge graph annotated with mastery/status, for visualisation. */
export interface TwinGraph {
  nodes: TwinGraphNode[];
  edges: TwinGraphEdge[];
}

/** Extract concepts from a document's content via the LLM. */
export interface ExtractConceptsRequest {
  /** Max concepts to extract (default 12). */
  maxConcepts?: number;
}

export interface ExtractConceptsResponse {
  documentId: string;
  /** All concepts now linked to the document (created + pre-existing). */
  concepts: ConceptSummary[];
  /** How many concepts were newly created (vs deduped onto existing). */
  createdConcepts: number;
  /** How many prerequisite edges were newly created. */
  createdEdges: number;
}
