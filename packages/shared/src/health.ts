/** Health contract shared by the API's /health endpoint and the mobile client. */

export type HealthState = 'up' | 'down';

export type HealthDependency = 'postgres' | 'redis' | 'qdrant';

export interface HealthReport {
  /** Overall status — 'ok' only if every dependency is 'up'. */
  status: 'ok' | 'error';
  /** ISO-8601 timestamp of when the check ran. */
  timestamp: string;
  /** Per-dependency status. */
  info: Record<HealthDependency, { status: HealthState; message?: string }>;
}
