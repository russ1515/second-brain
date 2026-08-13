/** Document (Learning Memory Engine) wire contracts, shared by API and mobile. */

export type DocumentSource = 'text' | 'file' | 'url';

export type DocumentStatus = 'pending' | 'processing' | 'ready' | 'failed';

/** AI-estimated reading difficulty of a document. */
export type DocumentDifficulty = 'beginner' | 'intermediate' | 'advanced';

/** The automatic Smart Upload Pipeline stages (Sprint 6.2), in order. Null when
 *  the document is settled (ready/failed). */
export type PipelineStage =
  | 'cleaning'
  | 'segmenting'
  | 'embedding'
  | 'indexing'
  | 'graphing';

/** List-view projection of a document (no full content). */
export interface DocumentSummary {
  id: string;
  title: string;
  source: DocumentSource;
  /** Original filename or URL, when applicable. */
  sourceRef?: string;
  charCount: number;
  status: DocumentStatus;
  /** ISO-8601 timestamps. */
  createdAt: string;
  updatedAt: string;
}

/** Full document, including extracted text. */
export interface DocumentDetail extends DocumentSummary {
  content: string;
  /** Failure reason when status is 'failed'. */
  error?: string;
}

// ── Smart Library (Sprint 6.1) ──────────────────────────────────────────────

/** A concept the AI detected in a document (minimal projection for cards). */
export interface DetectedConcept {
  id: string;
  name: string;
}

/** A user-defined shelf grouping documents. */
export interface Collection {
  id: string;
  name: string;
  /** Number of (non-trashed) documents on this shelf. */
  documentCount: number;
}

/**
 * A document as shown in the Smart Library: the base summary plus the
 * automatically-derived metadata (AI summary, subject, language, author,
 * difficulty), a short preview excerpt, favorite/trash state, its collection,
 * and the concepts detected in it.
 */
export interface LibraryDocument extends DocumentSummary {
  /** The pipeline stage currently running (Sprint 6.2), or null when settled. */
  stage: PipelineStage | null;
  /** First lines of the extracted text — the card's "aperçu". */
  preview: string;
  isFavorite: boolean;
  /** Set when the document is in the Trash. */
  deletedAt: string | null;
  collectionId: string | null;
  collectionName: string | null;
  /** AI-enriched metadata (null until enrichment has run, or when unknown). */
  summary: string | null;
  subject: string | null;
  language: string | null;
  author: string | null;
  difficulty: DocumentDifficulty | null;
  /** True once AI enrichment has completed for this document. */
  enriched: boolean;
  concepts: DetectedConcept[];
}

/** A library document with its full extracted text — the detail view. */
export interface LibraryDocumentDetail extends LibraryDocument {
  content: string;
  /** Failure reason when status is 'failed'. */
  error?: string;
}

/** The organization shelves of the Smart Library. */
export type LibraryFilter =
  | 'all'
  | 'favorites'
  | 'recent'
  | 'shared'
  | 'trash';

/** One facet value with how many documents carry it. */
export interface LibraryFacet {
  value: string;
  count: number;
}

/** Counts and facets that drive the library's Evernote-style sidebar. */
export interface LibraryFacets {
  all: number;
  favorites: number;
  recent: number;
  shared: number;
  trash: number;
  subjects: LibraryFacet[];
  languages: LibraryFacet[];
  collections: Collection[];
}

export interface CreateCollectionRequest {
  name: string;
}

// ── AI Document Understanding (Sprint 6.5) ──────────────────────────────────

/** What the AI teacher can do WITH a document, beyond answering. */
export type UnderstandMode = 'summarize' | 'rephrase' | 'simplify' | 'explain';

/** The learner level an explanation was pitched at (from the Digital Twin). */
export type LearnerLevel = 'new' | 'beginner' | 'intermediate' | 'advanced';

export interface UnderstandRequest {
  mode: UnderstandMode;
}

export interface UnderstandResponse {
  mode: UnderstandMode;
  /** The generated text, in the document's language, adapted to the twin. */
  text: string;
  /** The twin level it was adapted to. */
  level: LearnerLevel;
}

export interface CompareRequest {
  otherDocumentId: string;
}

export interface CompareResponse {
  text: string;
  documentTitle: string;
  otherTitle: string;
  level: LearnerLevel;
}

/** A concept detected in a document, with the learner's mastery of it. */
export interface KeyConcept {
  id: string;
  name: string;
  /** Mean recall probability (0..1), or null if untracked. */
  mastery: number | null;
  /** strong | developing | weak | unknown. */
  level: string;
}

/** A prerequisite concept the learner should understand first. */
export interface PrerequisiteConcept extends KeyConcept {
  /** The document concept this is a prerequisite for. */
  forConcept: string;
}

/** The document's important notions + prerequisites, adapted to the twin. */
export interface DocumentPrerequisites {
  keyConcepts: KeyConcept[];
  prerequisites: PrerequisiteConcept[];
}

// ── AI Study Resources Generator (Sprint 6.6) ───────────────────────────────

/** A study resource the AI can generate from a document — and SAVE. */
export type StudyResourceType =
  | 'summary'
  | 'revision_sheet'
  | 'flashcards'
  | 'quiz'
  | 'exercises'
  | 'open_questions'
  | 'course_plan';

/** A generated, persisted study resource. */
export interface StudyResource {
  id: string;
  documentId: string;
  type: StudyResourceType;
  title: string;
  /** Markdown body; for flashcards a short note (cards live in the deck). */
  content: string;
  /** For type=flashcards: the deck holding the generated cards. */
  deckId: string | null;
  createdAt: string;
}

export interface GenerateResourceRequest {
  type: StudyResourceType;
}

// ── AI Academic Workspace (Sprint 6.7) ──────────────────────────────────────

/** The three accompaniment modes, from most autonomy-building to most complete. */
export type WorkspaceMode = 'guide' | 'accompany' | 'solve';

/** The AI teacher's automatic analysis of an academic work, twin-adapted. */
export interface WorkAnalysis {
  /** What the work asks the student to achieve. */
  objectives: string[];
  /** Skills the work evaluates. */
  skillsEvaluated: string[];
  /** Knowledge the work draws on. */
  knowledgeMobilized: string[];
  /** What the student must already understand first. */
  prerequisites: string[];
  difficulty: DocumentDifficulty | null;
  /** What a successful piece of work looks like. */
  successCriteria: string[];
  /** The important notions in the work. */
  keyNotions: string[];
  /** Concepts likely hard for THIS learner (from the Digital Twin), with why. */
  likelyDifficult: { concept: string; reason: string }[];
  /** The learner level the analysis was adapted to. */
  level: LearnerLevel;
}

export interface WorkspaceMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface WorkspaceAssistRequest {
  mode: WorkspaceMode;
  /** The conversation so far (the client holds the history). */
  messages: WorkspaceMessage[];
}

export interface WorkspaceAssistResponse {
  mode: WorkspaceMode;
  reply: string;
}

// ── Smart Knowledge Integration (Sprint 6.8) ────────────────────────────────

/** A concept as seen by the knowledge-integration report, with mastery. */
export interface IntegrationConcept {
  id: string;
  name: string;
  mastery: number | null;
  /** strong | developing | weak | unknown. */
  level: string;
}

/** A graph edge connecting this document's knowledge to the rest of the brain. */
export interface IntegrationLink {
  concept: string;
  relatedTo: string;
  /** prerequisite | related. */
  relation: string;
}

/**
 * How a document was integrated into the learner's digital brain (Sprint 6.8):
 * what is new, what connects to existing knowledge, what to review first, what
 * builds on it, and what the learner already masters vs still finds fragile.
 */
export interface KnowledgeIntegration {
  /** Concepts first seen via this document. */
  newConcepts: IntegrationConcept[];
  /** This document's concepts already known from other documents. */
  knownConcepts: IntegrationConcept[];
  /** Edges connecting this document's concepts to existing knowledge. */
  linksToExisting: IntegrationLink[];
  /** Prerequisites to review first. */
  prerequisites: IntegrationConcept[];
  /** Existing topics that build on this document's concepts. */
  dependents: IntegrationConcept[];
  /** Concepts the learner already masters. */
  mastered: IntegrationConcept[];
  /** Concepts reviewed but still fragile. */
  fragile: IntegrationConcept[];
  summary: {
    /** Concepts this document contributes. */
    concepts: number;
    /** Chunks indexed into the Learning Memory. */
    chunks: number;
    /** Graph edges touching this document's concepts. */
    edges: number;
  };
}

/** Ingest a document from pasted text/markdown. */
export interface CreateTextDocumentRequest {
  title: string;
  content: string;
}

/** Ingest a document by fetching and extracting a web page. */
export interface CreateUrlDocumentRequest {
  url: string;
  /** Overrides the title extracted from the page. */
  title?: string;
}

/** Narrows RAG / search to part of the library (Sprint 6.4 — Adaptive RAG).
 *  All optional; omit everything to search the whole library. Precedence:
 *  documentId > collectionId > subject. */
export interface RagScope {
  /** Restrict to a single document. */
  documentId?: string;
  /** Restrict to a collection. */
  collectionId?: string;
  /** Restrict to an AI-detected subject (e.g. "Biology"). */
  subject?: string;
}

/** Semantic search across the caller's own documents. */
export interface SearchRequest extends RagScope {
  query: string;
  /** Max results to return (default 8). */
  limit?: number;
  /** Drop hits below this cosine score (0..1). */
  minScore?: number;
}

/** One matching chunk, with its source document. */
export interface SearchResultItem {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  /** The matching chunk text. */
  content: string;
  /** Cosine similarity in [0, 1], higher is closer. */
  score: number;
}

export interface SearchResponse {
  query: string;
  results: SearchResultItem[];
}

/** Ask a grounded question answered from the caller's own documents (RAG).
 *  Extends RagScope so the question can be narrowed to a document / collection /
 *  subject, or left library-wide. */
export interface AskRequest extends RagScope {
  question: string;
  /** How many chunks to retrieve as context (default 5). */
  limit?: number;
  /** Drop context chunks below this cosine score (0..1). */
  minScore?: number;
}

/** A source passage the answer is grounded in. */
export interface Citation {
  documentId: string;
  documentTitle: string;
  chunkIndex: number;
  score: number;
  /** The passage text the answer drew on (Sprint 6.4 — "retrouver les passages"). */
  content?: string;
}

export interface AskResponse {
  answer: string;
  /** Source passages retrieved as context (empty when nothing relevant was found). */
  citations: Citation[];
  /** False when no relevant context was found — the model was not asked to answer. */
  usedContext: boolean;
}
