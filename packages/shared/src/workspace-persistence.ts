import type { ActionDestination } from './next-best-action';
import type { WorkspaceMessage, WorkspaceMode } from './document';
import type { ExperienceContext } from './context';

/** Target persistence contract. Lot 0 does not add a workspace database model. */
export type WorkspaceProjectStatus = 'active' | 'paused' | 'completed' | 'archived';

export const WORKSPACE_TEMPLATES = [
  'memoire',
  'tfc',
  'dissertation',
  'report',
  'article',
  'assignment',
  'academic-research',
  'other',
] as const;
export type WorkspaceTemplate = (typeof WORKSPACE_TEMPLATES)[number];

export interface WorkspaceCitationReference {
  id: string;
  title: string;
  kind: 'document' | 'brain' | 'external' | 'web';
  documentId?: string;
  url?: string;
  excerpt?: string | null;
}

export interface WorkspaceSourceReference {
  kind: 'document' | 'collection' | 'research-source';
  id: string;
  title?: string;
  /** Research transfer snapshot. Provenance remains usable if the source changes. */
  question?: string;
  synthesis?: string;
  citations?: WorkspaceCitationReference[];
}

export interface WorkspacePlanItem {
  id: string;
  title: string;
  order: number;
  completed: boolean;
}

export interface WorkspaceDraft {
  format: 'markdown' | 'plain-text' | 'structured';
  content: string;
  revision: number;
  updatedAt: string;
}

export interface WorkspaceProgress {
  currentStep?: string;
  completedSteps: string[];
  totalSteps?: number;
}

export interface WorkspaceAssistantHistoryEntry extends WorkspaceMessage {
  id: string;
  createdAt: string;
}

export interface PersistentWorkspace {
  id: string;
  userId: string;
  title: string;
  template: WorkspaceTemplate;
  objective: string;
  dueAt: string | null;
  status: WorkspaceProjectStatus;
  mode: WorkspaceMode;
  context: ExperienceContext;
  sources: WorkspaceSourceReference[];
  plan: WorkspacePlanItem[];
  draft: WorkspaceDraft;
  assistantHistory: WorkspaceAssistantHistoryEntry[];
  progress: WorkspaceProgress;
  autosaveRevision: number;
  experienceSessionId: string | null;
  resumeTarget: ActionDestination;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceSummary {
  id: string;
  title: string;
  template: WorkspaceTemplate;
  status: WorkspaceProjectStatus;
  sourceCount: number;
  completedSteps: number;
  totalSteps: number;
  updatedAt: string;
  resumeTarget: ActionDestination;
}

export interface WorkspacePage {
  items: WorkspaceSummary[];
  nextCursor: string | null;
}

export interface CreateWorkspaceRequest {
  title: string;
  template: WorkspaceTemplate;
  objective: string;
  dueAt?: string;
  sources?: WorkspaceSourceReference[];
  plan?: WorkspacePlanItem[];
  initialContent?: string;
}

export interface UpdateWorkspaceRequest {
  title?: string;
  objective?: string;
  dueAt?: string | null;
  status?: WorkspaceProjectStatus;
  mode?: WorkspaceMode;
  sources?: WorkspaceSourceReference[];
  plan?: WorkspacePlanItem[];
  progress?: WorkspaceProgress;
}

export interface WorkspaceAutosaveRequest {
  workspaceId: string;
  /** Optimistic concurrency token; stale writes must be rejected. */
  expectedRevision: number;
  draft: Omit<WorkspaceDraft, 'revision' | 'updatedAt'>;
}

export interface WorkspaceAutosaveResult {
  saved: boolean;
  revision: number;
  updatedAt: string;
}

export const WORKSPACE_ASSIST_ACTIONS = [
  'explain',
  'challenge',
  'suggest',
  'structure',
  'compare-sources',
  'check-coherence',
  'rephrase',
] as const;
export type WorkspaceAssistAction = (typeof WORKSPACE_ASSIST_ACTIONS)[number];

export interface PersistentWorkspaceAssistRequest {
  action: WorkspaceAssistAction;
  message?: string;
  selectedText?: string;
}

export interface PersistentWorkspaceAssistResponse {
  reply: WorkspaceAssistantHistoryEntry;
}

export type WorkspaceSaveState = 'idle' | 'dirty' | 'saving' | 'saved' | 'error' | 'offline';

/** A progress percentage is legitimate only when it comes from real plan items. */
export function workspaceProgressFromPlan(plan: readonly WorkspacePlanItem[]): WorkspaceProgress {
  return {
    currentStep: plan.find((item) => !item.completed)?.id,
    completedSteps: plan.filter((item) => item.completed).map((item) => item.id),
    totalSteps: plan.length,
  };
}
