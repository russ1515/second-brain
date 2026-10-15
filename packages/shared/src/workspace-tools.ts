import type {
  WorkspaceDraft,
  WorkspaceProfessorPhase,
  WorkspaceProfessorState,
  WorkspaceSourceCitation,
  WorkspaceSourceState,
} from './workspace-persistence';
import type { WorkspaceShellKind } from './workspace-orchestrator';

export const WORKSPACE_TOOL_OPERATION_TYPES = [
  'ANALYZE',
  'CHECK',
  'SUGGEST',
  'TRANSFORM',
] as const;
export type WorkspaceToolOperationType = (typeof WORKSPACE_TOOL_OPERATION_TYPES)[number];

export const WORKSPACE_TOOL_COST_CLASSES = ['standard-ai'] as const;
export type WorkspaceToolCostClass = (typeof WORKSPACE_TOOL_COST_CLASSES)[number];

export const WORKSPACE_TOOL_IDS = [
  'assignment-check-answer',
  'assignment-explain-error',
  'assignment-compare-instructions',
  'assignment-improve-clarity',
  'thesis-check-problem',
  'thesis-check-plan',
  'thesis-examine-section',
  'thesis-check-source-support',
  'thesis-find-sources',
  'dissertation-analyze-thesis',
  'dissertation-identify-counterargument',
  'dissertation-check-argument-logic',
  'dissertation-check-transition',
  'dissertation-check-dialectic',
  'article-check-scientific-structure',
  'article-check-abstract',
  'article-check-method-results',
  'article-check-discussion-results',
  'article-find-unsupported-claims',
  'report-check-objectives-results',
  'report-check-observations-recommendations',
  'report-identify-missing-sections',
  'report-improve-section-clarity',
  'report-check-overall-coherence',
  'general-analyze',
  'general-check-structure',
  'general-improve-clarity',
  'general-check-sources',
] as const;
export type WorkspaceToolId = (typeof WORKSPACE_TOOL_IDS)[number];

export type WorkspaceToolSubjectKey =
  | 'answer'
  | 'error'
  | 'instructions'
  | 'clarity'
  | 'problem'
  | 'plan'
  | 'section'
  | 'sourceSupport'
  | 'sources'
  | 'thesis'
  | 'counterargument'
  | 'argumentLogic'
  | 'transition'
  | 'dialectic'
  | 'scientificStructure'
  | 'abstract'
  | 'methodResults'
  | 'discussionResults'
  | 'unsupportedClaims'
  | 'objectivesResults'
  | 'observationsRecommendations'
  | 'missingSections'
  | 'overallCoherence'
  | 'structure';

export interface WorkspaceToolDefinition {
  toolId: WorkspaceToolId;
  /** Stable translation key; the registry itself never contains user-facing copy. */
  labelKey: `workspaceTools.tool.${string}`;
  /** Lets clients compose a compact localized label without duplicating the registry. */
  subjectKey: WorkspaceToolSubjectKey;
  allowedShells: readonly WorkspaceShellKind[];
  allowedPhases: readonly WorkspaceProfessorPhase[];
  requiresSources: boolean;
  requiresSelection: boolean;
  operationType: WorkspaceToolOperationType;
  costClass: WorkspaceToolCostClass;
}

const STANDARD = 'standard-ai' as const;

function tool(
  toolId: WorkspaceToolId,
  shell: WorkspaceShellKind,
  phases: readonly WorkspaceProfessorPhase[],
  operationType: WorkspaceToolOperationType,
  subjectKey: WorkspaceToolSubjectKey,
  options: { requiresSources?: boolean; requiresSelection?: boolean } = {},
): WorkspaceToolDefinition {
  const camel = toolId.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
  return {
    toolId,
    labelKey: `workspaceTools.tool.${camel}`,
    subjectKey,
    allowedShells: [shell],
    allowedPhases: phases,
    requiresSources: options.requiresSources === true,
    requiresSelection: options.requiresSelection === true,
    operationType,
    costClass: STANDARD,
  };
}

const WORK = ['WORK', 'COACHING'] as const;
const REVIEW = ['VERIFICATION', 'FINALIZATION'] as const;
const WORK_REVIEW = ['WORK', 'COACHING', 'VERIFICATION'] as const;
const METHOD_REVIEW = ['METHOD', 'VERIFICATION', 'FINALIZATION'] as const;

/**
 * AW-7 is deliberately a code registry: it does not create database rows and
 * it cannot be expanded by a client-provided tool id.
 */
export const WORKSPACE_TOOL_REGISTRY: readonly WorkspaceToolDefinition[] = [
  tool('assignment-check-answer', 'assignment', WORK_REVIEW, 'CHECK', 'answer', { requiresSelection: true }),
  tool('assignment-explain-error', 'assignment', ['COACHING'], 'ANALYZE', 'error', { requiresSelection: true }),
  tool('assignment-compare-instructions', 'assignment', ['COMPREHENSION', ...REVIEW], 'CHECK', 'instructions'),
  tool('assignment-improve-clarity', 'assignment', WORK, 'TRANSFORM', 'clarity', { requiresSelection: true }),

  tool('thesis-check-problem', 'thesis', ['COMPREHENSION', 'METHOD', ...REVIEW], 'CHECK', 'problem'),
  tool('thesis-check-plan', 'thesis', METHOD_REVIEW, 'CHECK', 'plan'),
  tool('thesis-examine-section', 'thesis', WORK_REVIEW, 'ANALYZE', 'section', { requiresSelection: true }),
  tool('thesis-check-source-support', 'thesis', REVIEW, 'CHECK', 'sourceSupport', { requiresSources: true, requiresSelection: true }),
  tool('thesis-find-sources', 'thesis', ['METHOD', ...WORK], 'SUGGEST', 'sources', { requiresSources: true }),

  tool('dissertation-analyze-thesis', 'dissertation', ['COMPREHENSION', 'METHOD', ...WORK_REVIEW], 'ANALYZE', 'thesis'),
  tool('dissertation-identify-counterargument', 'dissertation', ['METHOD', ...WORK], 'SUGGEST', 'counterargument'),
  tool('dissertation-check-argument-logic', 'dissertation', WORK_REVIEW, 'CHECK', 'argumentLogic', { requiresSelection: true }),
  tool('dissertation-check-transition', 'dissertation', WORK_REVIEW, 'CHECK', 'transition', { requiresSelection: true }),
  tool('dissertation-check-dialectic', 'dissertation', METHOD_REVIEW, 'CHECK', 'dialectic'),

  tool('article-check-scientific-structure', 'article', METHOD_REVIEW, 'CHECK', 'scientificStructure'),
  tool('article-check-abstract', 'article', WORK_REVIEW, 'CHECK', 'abstract', { requiresSelection: true }),
  tool('article-check-method-results', 'article', REVIEW, 'CHECK', 'methodResults'),
  tool('article-check-discussion-results', 'article', REVIEW, 'CHECK', 'discussionResults'),
  tool('article-find-unsupported-claims', 'article', REVIEW, 'CHECK', 'unsupportedClaims', { requiresSources: true }),

  tool('report-check-objectives-results', 'report', REVIEW, 'CHECK', 'objectivesResults'),
  tool('report-check-observations-recommendations', 'report', REVIEW, 'CHECK', 'observationsRecommendations'),
  tool('report-identify-missing-sections', 'report', METHOD_REVIEW, 'CHECK', 'missingSections'),
  tool('report-improve-section-clarity', 'report', WORK, 'TRANSFORM', 'clarity', { requiresSelection: true }),
  tool('report-check-overall-coherence', 'report', REVIEW, 'CHECK', 'overallCoherence'),

  tool('general-analyze', 'general', ['COMPREHENSION', ...WORK_REVIEW], 'ANALYZE', 'section'),
  tool('general-check-structure', 'general', METHOD_REVIEW, 'CHECK', 'structure'),
  tool('general-improve-clarity', 'general', WORK, 'TRANSFORM', 'clarity', { requiresSelection: true }),
  tool('general-check-sources', 'general', REVIEW, 'CHECK', 'sources', { requiresSources: true }),
] as const;

export function workspaceToolById(toolId: string): WorkspaceToolDefinition | undefined {
  return WORKSPACE_TOOL_REGISTRY.find((definition) => definition.toolId === toolId);
}

export function workspaceToolsFor(
  shellKind: WorkspaceShellKind,
  phase: WorkspaceProfessorPhase,
): WorkspaceToolDefinition[] {
  return WORKSPACE_TOOL_REGISTRY.filter((definition) => (
    definition.allowedShells.includes(shellKind)
    && definition.allowedPhases.includes(phase)
  ));
}

export interface WorkspaceToolListResponse {
  shellKind: WorkspaceShellKind;
  phase: WorkspaceProfessorPhase;
  tools: WorkspaceToolDefinition[];
}

export interface WorkspaceToolExecuteRequest {
  /** Stable idempotency key for one logical provider-backed execution. */
  requestId: string;
  expectedRevision: number;
  selectedText?: string;
  message?: string;
}

export type WorkspaceToolProposalStatus = 'ready' | 'source-unavailable';
export type WorkspaceToolDecision = 'pending' | 'applied' | 'rejected';

export interface WorkspaceToolProvenance {
  userContent: boolean;
  sourceGrounded: boolean;
  modelSuggestion: boolean;
}

export interface WorkspaceToolProposal {
  id: string;
  requestId: string;
  toolId: WorkspaceToolId;
  content: string;
  baseRevision: number;
  phase: WorkspaceProfessorPhase;
  /** Distinguishes repeated visits to the same Professor phase. */
  phaseSequence: number;
  status: WorkspaceToolProposalStatus;
  provenance: WorkspaceToolProvenance;
  citations: WorkspaceSourceCitation[];
  createdAt: string;
}

export type WorkspaceToolOperationStatus = 'pending' | 'completed' | 'failed' | 'applied' | 'rejected';

export interface WorkspaceToolOperation {
  requestId: string;
  requestFingerprint: string;
  toolId: WorkspaceToolId;
  status: WorkspaceToolOperationStatus;
  phase: WorkspaceProfessorPhase;
  /** Phase visit in which the server authorized this operation. */
  phaseSequence: number;
  createdAt: string;
  updatedAt: string;
  baseRevision: number;
  proposal?: WorkspaceToolProposal;
  failureCode?: 'provider' | 'persistence';
  applicationFingerprint?: string;
  appliedRevision?: number;
  appliedAt?: string;
}

export interface WorkspaceToolRequestReceipt {
  requestFingerprint: string;
  toolId: WorkspaceToolId;
  status: WorkspaceToolOperationStatus;
  updatedAt: string;
}

export interface WorkspaceToolState {
  version: 1;
  /** Recent, user-visible proposal journal. Kept bounded by the API. */
  operations: WorkspaceToolOperation[];
  /**
   * Durable idempotency ledger keyed by a server-side SHA-256 of requestId.
   * Unlike the recent journal, compact receipts survive its 20-entry window;
   * the API applies a larger bounded retention window and TTL.
   */
  requestLedger: Record<string, WorkspaceToolRequestReceipt>;
}

export interface WorkspaceToolExecuteResponse {
  proposal: WorkspaceToolProposal;
  sources: WorkspaceSourceState[];
  professor: WorkspaceProfessorState;
}

export interface WorkspaceToolApplyRequest {
  requestId: string;
  expectedRevision: number;
  draft: Omit<WorkspaceDraft, 'revision' | 'updatedAt'>;
}

export interface WorkspaceToolApplyResponse {
  saved: true;
  revision: number;
  updatedAt: string;
  proposalStatus: Extract<WorkspaceToolOperationStatus, 'applied'>;
}

export interface WorkspaceToolRejectRequest {
  requestId: string;
}

export interface WorkspaceToolRejectResponse {
  rejected: true;
  proposalStatus: Extract<WorkspaceToolOperationStatus, 'rejected'>;
}

export function initialWorkspaceToolState(): WorkspaceToolState {
  return { version: 1, operations: [], requestLedger: {} };
}
