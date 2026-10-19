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
  'ANSWER_DRAFT', 'CURRENT_SECTION_DRAFT', 'ARGUMENTATIVE_DRAFT',
  'SCIENTIFIC_SECTION_DRAFT', 'REPORT_SECTION_DRAFT', 'ADAPTIVE_DRAFT',
] as const;
export type WorkspaceWorkOutputKind = (typeof WORKSPACE_WORK_OUTPUT_KINDS)[number];

export interface WorkspaceAutopilotRequest {
  requestId: string;
  expectedRevision: number;
  action: WorkspaceAutopilotAction;
  /** Explicit permission to make reversible changes to this Workspace draft. */
  consent?: boolean;
}

/** Server-derived structured result of one existing Professor/tool call. */
export interface WorkspaceAutopilotOutput {
  text: string;
  briefFields?: WorkspaceBrief['fields'];
  plan?: Array<{ title: string; stepId?: WorkspacePlanItem['stepId'] }>;
  draft?: string;
  /** The produced content, not a description of a proposed future answer. */
  workOutputKind?: WorkspaceWorkOutputKind;
  workEvidence?: Array<{ requirement: string; excerpt: string }>;
  /** Set by server validation only; never accepted from provider/client JSON. */
  workArtifactValidated?: true;
  checkedPlanItemIds?: string[];
  issues?: string[];
  needsInput?: string;
  deconstruction?: string;
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
  };
  receipts: WorkspaceAutopilotReceipt[];
  /** Preserves a bounded exception for this exact run, without resetting usage. */
  stepGrant?: WorkspaceAutopilotStepGrant;
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
