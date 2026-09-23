import type { ContextItemInput, ExperienceContext } from './context';
import type { ActionDestination, NextBestAction } from './next-best-action';

export const EXPERIENCE_SESSION_TYPES = [
  'learning',
  'tutor',
  'research',
  'review',
  'language',
  'workspace',
  'document-processing',
] as const;

export type ExperienceSessionType = (typeof EXPERIENCE_SESSION_TYPES)[number];

export const EXPERIENCE_SESSION_STATUSES = [
  'active',
  'paused',
  'completed',
  'abandoned',
  'failed',
] as const;

export type ExperienceSessionStatus = (typeof EXPERIENCE_SESSION_STATUSES)[number];

export const INPUT_MODALITIES = ['text', 'voice', 'photo', 'scan', 'file', 'mixed'] as const;
export type InputModality = (typeof INPUT_MODALITIES)[number];

export interface ExperienceStep {
  id: string;
  label?: string;
  index?: number;
  state?: 'pending' | 'active' | 'completed' | 'failed';
  /** Small resumable state such as research depth/scope; bounded by the API. */
  metadata?: Record<string, unknown>;
}

export interface ExperienceProgress {
  completed: number;
  total?: number;
  /** Only set when derived from real completed/total values. */
  percent?: number;
  messageCode?: string;
}

export interface ExperienceProduction {
  id: string;
  kind: string;
  title?: string;
  referenceId?: string;
  createdAt: string;
  /** Bounded artifact snapshot used when the domain result is resumable. */
  metadata?: Record<string, unknown>;
}

export interface ExperienceSourceReference {
  kind:
    | 'document'
    | 'document-collection'
    | 'concept'
    | 'lesson'
    | 'review-item'
    | 'language-course'
    | 'language-mission'
    | 'language-capability'
    | 'external-source';
  id: string;
  title?: string;
}

export interface TwinImpact {
  measuredAt: string;
  changes: Array<{
    kind: 'concept-added' | 'connection-added' | 'mastery' | 'memory' | 'progress';
    referenceId?: string;
    before?: number;
    after?: number;
    label?: string;
  }>;
}

/** Optional direct associations to existing domain records. */
export interface ExperienceSessionLinks {
  tutorSessionId: string | null;
  studySessionId: string | null;
  documentId: string | null;
  lessonId: string | null;
  goalId: string | null;
  languageProfileId: string | null;
  /** Stable Academic Workspace id. */
  workspaceRef: string | null;
}

export interface ExperienceSession {
  id: string;
  userId: string;
  /** Incremented on every mutation; basis for future optimistic concurrency. */
  version: number;
  type: ExperienceSessionType;
  status: ExperienceSessionStatus;
  title: string | null;
  intent: string | null;
  inputModality: InputModality | null;
  activeContexts: ExperienceContext;
  currentStep: ExperienceStep | null;
  progress: ExperienceProgress | null;
  productions: ExperienceProduction[];
  sourceReferences: ExperienceSourceReference[];
  twinImpact: TwinImpact | null;
  resumeTarget: ActionDestination | null;
  nextBestAction: NextBestAction | null;
  links: ExperienceSessionLinks;
  startedAt: string;
  updatedAt: string;
  pausedAt: string | null;
  completedAt: string | null;
}

export interface CreateExperienceSessionRequest {
  type: ExperienceSessionType;
  title?: string;
  intent?: string;
  inputModality?: InputModality;
  activeContexts?: ContextItemInput[];
  currentStep?: ExperienceStep;
  progress?: ExperienceProgress;
  productions?: ExperienceProduction[];
  sourceReferences?: ExperienceSourceReference[];
  resumeTarget?: ActionDestination;
  nextBestAction?: NextBestAction;
  links?: Partial<ExperienceSessionLinks>;
  /** Makes retries of the same creation request safe for one user. */
  idempotencyKey?: string;
}

export interface UpdateExperienceSessionRequest {
  /** Terminal exceptional state; pause/resume/complete use dedicated actions. */
  status?: 'abandoned' | 'failed';
  title?: string;
  intent?: string;
  inputModality?: InputModality;
  activeContexts?: ContextItemInput[];
  currentStep?: ExperienceStep | null;
  progress?: ExperienceProgress | null;
  productions?: ExperienceProduction[];
  sourceReferences?: ExperienceSourceReference[];
  twinImpact?: TwinImpact | null;
  resumeTarget?: ActionDestination | null;
  nextBestAction?: NextBestAction | null;
}

export interface ExperienceSessionPage {
  items: ExperienceSession[];
  nextCursor: string | null;
}
