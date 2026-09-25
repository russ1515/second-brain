import type { ApiProblem } from './api';

/** Keep generic authorization failures distinct from an actionable MFA prompt. */
export function isAdminStepUpRequired(problem: unknown): boolean {
  const value = problem as Partial<ApiProblem> | null;
  return value?.code === 'ADMIN_STEP_UP_REQUIRED' || value?.status === 428;
}
