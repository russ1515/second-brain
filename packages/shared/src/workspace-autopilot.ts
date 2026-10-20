import type {
  WorkspaceBrief,
  WorkspaceDraft,
  WorkspacePlanItem,
  WorkspaceProfessorPhase,
} from './workspace-persistence';

export const WORKSPACE_AUTOPILOT_ACTIONS = ['start', 'step', 'pause', 'resume', 'stop', 'undo'] as const;
export type WorkspaceAutopilotAction = (typeof WORKSPACE_AUTOPILOT_ACTIONS)[number];
export type WorkspaceAutopilotStatus =
  | 'IDLE' | 'RUNNING' | 'PAUSED' | 'PAUSED_ERROR' | 'NEEDS_INPUT' | 'COMPLETED' | 'STOPPED';

export const WORKSPACE_WORK_OUTPUT_KINDS = [
  'ANSWER_DRAFT', 'SUMMARY_DRAFT', 'SOURCED_RESEARCH_DRAFT', 'CURRENT_ACADEMIC_SECTION_DRAFT',
  'ARGUMENTATIVE_DRAFT', 'SCIENTIFIC_DRAFT', 'REPORT_DRAFT', 'INTENT_MATCHED_DRAFT',
] as const;
export type WorkspaceWorkOutputKind = (typeof WORKSPACE_WORK_OUTPUT_KINDS)[number];

export const WORKSPACE_WORK_INTENTS = [
  'assignment-exercise', 'article-summary', 'research-task', 'academic-section',
  'argumentative-essay', 'scientific-article', 'report', 'general',
] as const;
export type WorkspaceWorkIntent = (typeof WORKSPACE_WORK_INTENTS)[number];

export const WORKSPACE_WORK_CRITERION_CLASSES = ['REQUIRED', 'OPTIONAL', 'CONDITIONAL', 'STYLE', 'FORMAT'] as const;
export type WorkspaceWorkCriterionClass = (typeof WORKSPACE_WORK_CRITERION_CLASSES)[number];
export const WORKSPACE_WORK_CRITERION_CONDITIONS = ['NONE', 'SOURCE_AVAILABLE', 'UNRESOLVED'] as const;
export type WorkspaceWorkCriterionCondition = (typeof WORKSPACE_WORK_CRITERION_CONDITIONS)[number];
export const WORKSPACE_WORK_CRITERION_ORIGINS = [
  'userInstructions', 'institutionInstructions', 'requirements', 'deliverable', 'objective',
  'canonicalInstructions', 'UNSPECIFIED',
] as const;
export type WorkspaceWorkCriterionOrigin = (typeof WORKSPACE_WORK_CRITERION_ORIGINS)[number];
export interface WorkspaceWorkCriterion {
  id: string;
  requirement: string;
  required: boolean;
  /** Optional on historical contracts; absence retains their required flag. */
  classification?: WorkspaceWorkCriterionClass;
  condition?: WorkspaceWorkCriterionCondition;
  /** Server-derived from actual capabilities. Provider values are ignored. */
  applicable?: boolean | 'UNKNOWN';
  originField?: WorkspaceWorkCriterionOrigin;
}

/** Versioned interpretation of the actual task, not another Workspace engine. */
export interface WorkspaceWorkContract {
  version: 1;
  taskIntent: WorkspaceWorkIntent;
  outputKind: WorkspaceWorkOutputKind;
  operation: 'produce' | 'transform' | 'reproduce';
  scope: 'entire-task' | 'current-section';
  task: string;
  criteria: WorkspaceWorkCriterion[];
  sourceRequirement: 'none' | 'provided-content' | 'cited-evidence';
  /** Exact source material, not a substituted instruction or fabricated text. */
  sourceExcerpt?: string;
  sectionPlanItemId?: string;
  /** Computed by the server; provider/client fingerprints are ignored. */
  instructionFingerprint?: string;
  origin?: 'comprehension' | 'method' | 'legacy-work' | 'explicit-intent';
}

export interface WorkspaceTaskFulfillment {
  fulfilled: boolean;
  contractMatchesTask: boolean;
  scope: WorkspaceWorkContract['scope'];
  criterionReviews: Array<{
    criterionId: string;
    fulfilled: boolean;
    /** Historical verifier quotation; not canonical evidence on its own. */
    excerpt?: string;
    reason?: string;
    status?: WorkspaceVerificationCriterionStatus;
    evidenceAnchors?: WorkspaceDraftEvidenceAnchor[];
    evidenceOrigin?: 'VERIFIER_QUOTE' | 'VALIDATED_WORK_INDEX';
  }>;
  citationLabels?: string[];
  uncoveredRequirements?: string[];
  /** Computed only after the existing verification turn passes validation. */
  reviewedDraftFingerprint?: string;
  /** Server-derived provenance; never trusted from a provider response. */
  evidenceSource?: 'PERSISTED_DRAFT';
  draftRevision?: number;
  draftFingerprint?: string;
}

export const WORKSPACE_VERIFICATION_CRITERION_STATUSES = ['SATISFIED', 'PARTIAL', 'MISSING', 'INVALID_EVIDENCE'] as const;
export type WorkspaceVerificationCriterionStatus = (typeof WORKSPACE_VERIFICATION_CRITERION_STATUSES)[number];

/** Offsets use JavaScript UTF-16 code units in the exact persisted draft. */
export interface WorkspaceDraftEvidenceAnchor {
  source: 'draft';
  revision: number;
  startOffset: number;
  endOffset: number;
  /** Exact contiguous persisted substring, not a synthetic or normalized quote. */
  excerpt: string;
  draftFingerprint: string;
}

export interface WorkspaceAutopilotRequest {
  requestId: string;
  expectedRevision: number;
  action: WorkspaceAutopilotAction;
  /** Explicit permission to make reversible changes to this Workspace draft. */
  consent?: boolean;
  /** Optional explicit task intent for creation/start or a legacy resume. */
  workIntent?: WorkspaceWorkIntent;
}

/** Server-derived structured result of one existing Professor/tool call. */
export interface WorkspaceAutopilotOutput {
  text: string;
  briefFields?: WorkspaceBrief['fields'];
  plan?: Array<{ title: string; stepId?: WorkspacePlanItem['stepId'] }>;
  draft?: string;
  /** The produced content, not a description of a proposed future answer. */
  workOutputKind?: WorkspaceWorkOutputKind;
  /** New structured turns bind by ID; legacy source-text associations remain readable. */
  workEvidence?: Array<{ criterionId?: string; requirement: string; excerpt: string }>;
  workContract?: WorkspaceWorkContract;
  taskFulfillment?: WorkspaceTaskFulfillment;
  /** Set by server validation only; never accepted from provider/client JSON. */
  workArtifactValidated?: true;
  checkedPlanItemIds?: string[];
  issues?: string[];
  needsInput?: string;
  deconstruction?: string;
  /** Server-bound FINALIZATION provenance; never accepted from provider JSON. */
  finalizationEvidence?: {
    draftRevision: number;
    draftFingerprint: string;
    verificationReplyId: string;
    sourceFingerprint: string;
  };
}

export interface WorkspaceAutopilotReceipt {
  requestId: string;
  fingerprint: string;
  action: WorkspaceAutopilotAction;
  status: 'pending' | 'completed' | 'failed';
  createdAt: string;
  /** Server-only binding to one explicitly authorized, scoped run extension. */
  stepGrantId?: string;
}

/** Audit of a private server grant, never accepted through learner progress. */
export interface WorkspaceAutopilotStepGrant {
  version: 1;
  grantId: string;
  workspaceId: string;
  runId: string;
  fromMaxAiSteps: number;
  maxAiSteps: number;
  aiStepsAtGrant: number;
  additionalAiSteps: number;
  maxPromptBytes: number;
  requestId: string;
  revision: number;
  appliedAt: string;
}

/** Private, server-authorized acceptance accounting; never a learner quota. */
export interface WorkspaceAcceptanceAllowanceReservation {
  requestId: string;
  operationId: string;
  phase: 'VERIFICATION' | 'FINALIZATION' | 'DECONSTRUCTION';
  state: 'RESERVED' | 'SETTLED' | 'UNKNOWN' | 'NOT_CALLED';
  /** Decimal USD strings avoid rounding a technical spending ceiling. */
  upperCostUsd: string;
  actualCostUsd?: string;
  ledgerOperationId?: string;
  reservedAt: string;
  settledAt?: string;
}

export interface WorkspaceAcceptanceAllowanceWindow {
  version: 1;
  acceptanceRunId: string;
  ownerId: string;
  workspaceId: string;
  runId: string;
  expectedHistoricalAiSteps: number;
  expectedHistoricalMaxAiSteps: number;
  authorizedAt: string;
  expiresAt: string;
  maxCalls: number;
  maxCostUsd: string;
  allowedPhases: Array<'VERIFICATION' | 'FINALIZATION' | 'DECONSTRUCTION'>;
  provider: 'openai';
  model: string;
  testOnly: true;
  configFingerprint: string;
  authorizationRequestId: string;
  activatedAt: string;
  updatedAt: string;
  closedAt?: string;
  status: 'ACTIVE' | 'EXHAUSTED' | 'EXPIRED' | 'REVOKED' | 'COMPLETED' | 'FAILED';
  reservations: WorkspaceAcceptanceAllowanceReservation[];
}

/** Additive metadata in the existing progress JSON, never a second phase machine. */
export interface WorkspaceAutopilotState {
  version: 1;
  runId: string;
  status: WorkspaceAutopilotStatus;
  aiSteps: number;
  maxAiSteps: number;
  correctionLoops: number;
  maxCorrectionLoops: number;
  consent?: { version: 1; grantedAt: string };
  activeRequest?: {
    requestId: string;
    status: 'pending';
    phase: WorkspaceProfessorPhase;
    revision: number;
    createdAt: string;
    /** Server-selected private acceptance window, never learner input. */
    acceptanceRunId?: string;
  };
  receipts: WorkspaceAutopilotReceipt[];
  /** Preserves a bounded exception for this exact run, without resetting usage. */
  stepGrant?: WorkspaceAutopilotStepGrant;
  /** Append-only private acceptance windows; historical counters are unchanged. */
  acceptanceAllowances?: WorkspaceAcceptanceAllowanceWindow[];
  workContract?: WorkspaceWorkContract;
  /** Explicit typed orchestration context; never inferred from shell alone. */
  workIntent?: WorkspaceWorkIntent;
  workReview?: { draftFingerprint: string; contractFingerprint: string; instructionFingerprint: string; sourceFingerprint: string; replyId: string };
  errorCode?: string;
  reason?: string;
  /** Long-form work is evaluated one server-selected plan section at a time. */
  sectionPlanItemId?: string;
  /** A completed turn can be consumed after pause/F5 without another provider call. */
  pendingResult?: {
    replyId: string;
    phase: WorkspaceProfessorPhase;
    phaseSequence: number;
    revision: number;
    applied?: boolean;
    tool?: { toolId: string; requestId: string };
  };
  /** One reversible modification only; a later edit invalidates its CAS token. */
  undo?: {
    draft: Omit<WorkspaceDraft, 'revision' | 'updatedAt'>;
    plan: WorkspacePlanItem[];
    brief: WorkspaceBrief;
    appliedRevision: number;
    operationId: string;
  };
}

export function initialWorkspaceAutopilotState(
  runId: string,
  maxAiSteps = 15,
  maxCorrectionLoops = 1,
  consentAt?: string,
): WorkspaceAutopilotState {
  return {
    version: 1,
    runId,
    status: consentAt ? 'RUNNING' : 'IDLE',
    aiSteps: 0,
    maxAiSteps,
    correctionLoops: 0,
    maxCorrectionLoops,
    receipts: [],
    ...(consentAt ? { consent: { version: 1, grantedAt: consentAt } } : {}),
  };
}
