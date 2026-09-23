/** Shared semantic UI and AI-work states. */

export type UXStateKind =
  | 'idle'
  | 'loading'
  | 'processing'
  | 'partial'
  | 'success'
  | 'error'
  | 'stale'
  | 'offline'
  | 'quota-limited';

export interface UXState<T = unknown> {
  state: UXStateKind;
  data?: T;
  messageCode?: string;
  retryable?: boolean;
  updatedAt: string;
}

export type AIWorkProgress =
  | { mode: 'indeterminate' }
  | { mode: 'determinate'; completed: number; total: number; percent: number };

export interface AIWorkState {
  operation: string;
  stage: string;
  /** Determinate only when backed by real backend measurements. */
  progress: AIWorkProgress;
  /** Localization key, not final presentation copy. */
  messageCode: string;
  retryable: boolean;
  startedAt: string;
  updatedAt: string;
}

export function indeterminateAIWorkState(
  operation: string,
  stage: string,
  messageCode: string,
  now = new Date(),
): AIWorkState {
  const timestamp = now.toISOString();
  return {
    operation,
    stage,
    progress: { mode: 'indeterminate' },
    messageCode,
    retryable: false,
    startedAt: timestamp,
    updatedAt: timestamp,
  };
}

export function determinateAIWorkProgress(completed: number, total: number): AIWorkProgress {
  if (!Number.isFinite(completed) || !Number.isFinite(total) || total <= 0) {
    throw new Error('Determinate progress requires real finite values and a positive total.');
  }
  const boundedCompleted = Math.max(0, Math.min(completed, total));
  return {
    mode: 'determinate',
    completed: boundedCompleted,
    total,
    percent: Math.round((boundedCompleted / total) * 100),
  };
}
