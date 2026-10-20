import { createHash } from 'node:crypto';
import type {
  WorkspaceAcceptanceAllowanceReservation,
  WorkspaceAcceptanceAllowanceWindow,
  WorkspaceAutopilotState,
  WorkspaceProfessorPhase,
} from '@second-brain/shared';

export interface WorkspaceScopedAcceptanceAllowanceConfig {
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
}

export interface WorkspaceAcceptanceAllowanceScope {
  ownerId: string;
  workspaceId: string;
  runId: string;
  phase: WorkspaceProfessorPhase;
  now: string | number | Date;
}

type Window = WorkspaceAcceptanceAllowanceWindow;
type Reservation = WorkspaceAcceptanceAllowanceReservation;
type Config = WorkspaceScopedAcceptanceAllowanceConfig;
type Scope = WorkspaceAcceptanceAllowanceScope;
type JsonRecord = Record<string, unknown>;

const PHASES = ['VERIFICATION', 'FINALIZATION', 'DECONSTRUCTION'] as const;
const STATUSES = ['ACTIVE', 'EXHAUSTED', 'EXPIRED', 'REVOKED', 'COMPLETED', 'FAILED'];
const RESERVATION_STATES = ['RESERVED', 'SETTLED', 'UNKNOWN', 'NOT_CALLED'];
const MAX_WINDOW_JOURNAL = 32;
const MAX_TTL_MS = 4 * 60 * 60_000;
const SCALE = 1_000_000_000_000n;
const MAX_COST = SCALE / 10n;
const CONFIG_KEYS = ['version', 'acceptanceRunId', 'ownerId', 'workspaceId', 'runId',
  'expectedHistoricalAiSteps', 'expectedHistoricalMaxAiSteps', 'authorizedAt', 'expiresAt',
  'maxCalls', 'maxCostUsd', 'allowedPhases', 'provider', 'model', 'testOnly'];

/** Codes contain no configuration values, credentials, or user content. */
export class WorkspaceAcceptanceAllowanceError extends Error {
  constructor(readonly code: string) { super(code); this.name = 'WorkspaceAcceptanceAllowanceError'; }
}

function fail(code: string): never { throw new WorkspaceAcceptanceAllowanceError(code); }
function record(value: unknown): value is JsonRecord { return Boolean(value) && typeof value === 'object' && !Array.isArray(value); }
function identifier(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_-]{8,128}$/.test(value); }
function operationIdentifier(value: unknown): value is string { return typeof value === 'string' && /^[A-Za-z0-9_:.-]{8,256}$/.test(value); }
function milliseconds(value: unknown): number {
  return value instanceof Date ? value.getTime() : typeof value === 'number' ? value : typeof value === 'string' ? Date.parse(value) : NaN;
}
function timestamp(value: unknown): value is string { return typeof value === 'string' && Number.isFinite(Date.parse(value)); }
function nowIso(now: Scope['now']): string {
  const time = milliseconds(now);
  if (!Number.isFinite(time)) fail('workspace_acceptance_invalid_clock');
  return new Date(time).toISOString();
}
function usd(value: unknown): bigint | undefined {
  if (typeof value !== 'string' || !/^(?:0|[1-9]\d{0,9})(?:\.\d{1,12})?$/.test(value)) return undefined;
  const [whole, fraction = ''] = value.split('.');
  return BigInt(whole) * SCALE + BigInt(fraction.padEnd(12, '0'));
}
function usdString(value: bigint): string {
  const whole = value / SCALE;
  const fraction = String(value % SCALE).padStart(12, '0').replace(/0+$/, '');
  return `${whole}${fraction ? `.${fraction}` : ''}`;
}
function configValue(raw: unknown): Config | undefined {
  if (!record(raw) || raw.version !== 1 || raw.testOnly !== true || raw.provider !== 'openai'
    || !['acceptanceRunId', 'ownerId', 'workspaceId', 'runId'].every(key => identifier(raw[key]))
    || !Number.isSafeInteger(raw.expectedHistoricalAiSteps) || Number(raw.expectedHistoricalAiSteps) < 0
    || !Number.isSafeInteger(raw.expectedHistoricalMaxAiSteps) || Number(raw.expectedHistoricalMaxAiSteps) < 1
    || Number(raw.expectedHistoricalAiSteps) < Number(raw.expectedHistoricalMaxAiSteps)
    || !Number.isSafeInteger(raw.maxCalls) || Number(raw.maxCalls) < 1 || Number(raw.maxCalls) > 3
    || typeof raw.model !== 'string' || !/^[A-Za-z0-9_.:/-]{1,160}$/.test(raw.model)
    || !timestamp(raw.authorizedAt) || !timestamp(raw.expiresAt)
    || milliseconds(raw.expiresAt) <= milliseconds(raw.authorizedAt)
    || milliseconds(raw.expiresAt) - milliseconds(raw.authorizedAt) > MAX_TTL_MS
    || !Array.isArray(raw.allowedPhases) || raw.allowedPhases.length < 1 || raw.allowedPhases.length > PHASES.length
    || raw.allowedPhases.some(phase => !PHASES.includes(phase as typeof PHASES[number]))
    || new Set(raw.allowedPhases).size !== raw.allowedPhases.length) return undefined;
  const maxCost = usd(raw.maxCostUsd);
  if (maxCost === undefined || maxCost <= 0n || maxCost > MAX_COST) return undefined;
  return {
    version: 1, acceptanceRunId: raw.acceptanceRunId as string, ownerId: raw.ownerId as string,
    workspaceId: raw.workspaceId as string, runId: raw.runId as string,
    expectedHistoricalAiSteps: raw.expectedHistoricalAiSteps as number,
    expectedHistoricalMaxAiSteps: raw.expectedHistoricalMaxAiSteps as number,
    authorizedAt: new Date(milliseconds(raw.authorizedAt)).toISOString(),
    expiresAt: new Date(milliseconds(raw.expiresAt)).toISOString(),
    maxCalls: raw.maxCalls as number, maxCostUsd: usdString(maxCost),
    allowedPhases: PHASES.filter(phase => (raw.allowedPhases as unknown[]).includes(phase)),
    provider: 'openai', model: raw.model, testOnly: true,
  };
}
function fingerprint(config: Config): string { return createHash('sha256').update(JSON.stringify(config)).digest('hex'); }
function matchingScope(config: Config, scope: Scope): boolean {
  return config.ownerId === scope.ownerId && config.workspaceId === scope.workspaceId && config.runId === scope.runId;
}
function validNow(config: Config, scope: Scope): boolean {
  const now = milliseconds(scope.now);
  return Number.isFinite(now) && milliseconds(config.authorizedAt) <= now && now < milliseconds(config.expiresAt);
}
function journal(state: WorkspaceAutopilotState): Window[] {
  const windows = state.acceptanceAllowances ?? [];
  if (!Array.isArray(windows) || windows.length > MAX_WINDOW_JOURNAL) fail('workspace_acceptance_invalid_journal');
  const ids = new Set<string>();
  const operations = new Set<string>();
  for (const window of windows) {
    const config = configValue(window);
    if (!config || ids.has(window.acceptanceRunId) || window.configFingerprint !== fingerprint(config)
      || !identifier(window.authorizationRequestId) || !timestamp(window.activatedAt) || !timestamp(window.updatedAt)
      || (window.closedAt !== undefined && !timestamp(window.closedAt)) || !STATUSES.includes(window.status)
      || !Array.isArray(window.reservations) || window.reservations.length > window.maxCalls) fail('workspace_acceptance_invalid_journal');
    ids.add(window.acceptanceRunId);
    const requests = new Set<string>();
    for (const reservation of window.reservations) {
      if (!record(reservation)) fail('workspace_acceptance_invalid_journal');
      const upper = usd(reservation.upperCostUsd);
      const actual = reservation.actualCostUsd === undefined ? undefined : usd(reservation.actualCostUsd);
      if (!identifier(reservation.requestId) || !operationIdentifier(reservation.operationId)
        || requests.has(reservation.requestId) || operations.has(reservation.operationId)
        || !window.allowedPhases.includes(reservation.phase) || !RESERVATION_STATES.includes(reservation.state)
        || upper === undefined || upper <= 0n || upper > (usd(window.maxCostUsd) as bigint)
        || (reservation.actualCostUsd !== undefined && actual === undefined)
        || (reservation.state === 'SETTLED' && (actual === undefined || actual > upper))
        || (reservation.state === 'NOT_CALLED' && actual !== 0n)
        || !timestamp(reservation.reservedAt) || (reservation.settledAt !== undefined && !timestamp(reservation.settledAt))
        || (reservation.ledgerOperationId !== undefined && !operationIdentifier(reservation.ledgerOperationId))) fail('workspace_acceptance_invalid_journal');
      requests.add(reservation.requestId); operations.add(reservation.operationId);
    }
  }
  return windows;
}
function copyState(state: WorkspaceAutopilotState, windows: Window[]): WorkspaceAutopilotState {
  return { ...state, acceptanceAllowances: windows };
}
function outstanding(window: Window): boolean { return window.reservations.some(item => item.state === 'RESERVED' || item.state === 'UNKNOWN'); }
function accounted(window: Window): bigint {
  return window.reservations.reduce((total, item) => {
    const upper = usd(item.upperCostUsd) as bigint;
    const actual = item.actualCostUsd === undefined ? undefined : usd(item.actualCostUsd);
    if (item.state === 'NOT_CALLED') return total;
    return total + (item.state === 'SETTLED' ? actual as bigint : actual !== undefined && actual > upper ? actual : upper);
  }, 0n);
}
function close(window: Window, status: Window['status'], at: string): Window {
  return { ...window, status, updatedAt: at, closedAt: window.closedAt ?? at };
}

/** Reads only the private runtime value. No environment or secret is read here. */
export function parseAcceptanceAllowance(raw: unknown, now: Scope['now']): Config | undefined {
  try {
    const value = typeof raw === 'string' && raw.length <= 4_000 ? JSON.parse(raw) : raw;
    if (!record(value) || Object.keys(value).some(key => !CONFIG_KEYS.includes(key))) return undefined;
    const config = configValue(value);
    const time = milliseconds(now);
    return config && Number.isFinite(time) && milliseconds(config.authorizedAt) <= time && time < milliseconds(config.expiresAt) ? config : undefined;
  } catch { return undefined; }
}

/** Reconciles revocation/expiry, but never authorizes a new window on read. */
export function reconcileAcceptanceAllowances(state: WorkspaceAutopilotState, config: Config | undefined, scope: Scope): WorkspaceAutopilotState {
  const at = nowIso(scope.now);
  if (state.acceptanceAllowances === undefined) return state;
  const windows = journal(state).map(window => {
    if (window.status !== 'ACTIVE') return window;
    if (milliseconds(window.expiresAt) <= milliseconds(scope.now)) return close(window, 'EXPIRED', at);
    if (state.status === 'COMPLETED' || state.status === 'STOPPED') return close(window, 'COMPLETED', at);
    if (state.status === 'PAUSED_ERROR' || state.status === 'NEEDS_INPUT'
      || !window.allowedPhases.includes(scope.phase as typeof PHASES[number])) return close(window, 'FAILED', at);
    if (!config || !matchingScope(window, scope) || !matchingScope(config, scope)
      || window.acceptanceRunId !== config.acceptanceRunId || fingerprint(config) !== window.configFingerprint) return close(window, 'REVOKED', at);
    return window;
  });
  return copyState(state, windows);
}

/** Called exclusively by the server's authenticated, CAS-checked resume. */
export function activateAcceptanceAllowance(state: WorkspaceAutopilotState, config: Config, scope: Scope, authorizationRequestId: string): WorkspaceAutopilotState {
  const reconciled = reconcileAcceptanceAllowances(state, config, scope);
  const windows = journal(reconciled);
  if (!matchingScope(config, scope) || !validNow(config, scope) || scope.runId !== state.runId
    || !config.allowedPhases.includes(scope.phase as typeof PHASES[number])
    || !identifier(authorizationRequestId) || ['COMPLETED', 'STOPPED'].includes(state.status)
    || state.aiSteps !== config.expectedHistoricalAiSteps || state.maxAiSteps !== config.expectedHistoricalMaxAiSteps) fail('workspace_acceptance_not_authorized');
  const previous = windows.find(window => window.acceptanceRunId === config.acceptanceRunId);
  if (previous) {
    if (previous.configFingerprint !== fingerprint(config) || previous.status !== 'ACTIVE') fail('workspace_acceptance_rearm_blocked');
    return reconciled;
  }
  if (windows.length >= MAX_WINDOW_JOURNAL) fail('workspace_acceptance_journal_full');
  if (windows.some(outstanding)) fail('workspace_acceptance_previous_unsettled');
  const at = nowIso(scope.now);
  const window: Window = { ...config, allowedPhases: [...config.allowedPhases], configFingerprint: fingerprint(config),
    authorizationRequestId, activatedAt: at, updatedAt: at, status: 'ACTIVE', reservations: [] };
  return copyState(reconciled, [...windows, window]);
}

export function activeAcceptanceAllowance(state: WorkspaceAutopilotState, config: Config | undefined, scope: Scope): Window | undefined {
  if (!config || !matchingScope(config, scope) || !validNow(config, scope) || scope.runId !== state.runId
    || ['COMPLETED', 'STOPPED', 'PAUSED_ERROR', 'NEEDS_INPUT'].includes(state.status) || !config.allowedPhases.includes(scope.phase as typeof PHASES[number])
    || state.aiSteps !== config.expectedHistoricalAiSteps || state.maxAiSteps !== config.expectedHistoricalMaxAiSteps) return undefined;
  return journal(state).find(window => window.acceptanceRunId === config.acceptanceRunId && window.status === 'ACTIVE'
    && window.configFingerprint === fingerprint(config) && !window.reservations.some(item => item.state === 'UNKNOWN'));
}

/** Atomic persistence by the caller must precede any provider invocation. */
export function reserveAcceptanceAllowance(state: WorkspaceAutopilotState, config: Config, scope: Scope,
  requestId: string, operationId: string, upperUsd: string): WorkspaceAutopilotState {
  const windows = journal(state);
  const upper = usd(upperUsd);
  if (!identifier(requestId) || !operationIdentifier(operationId) || upper === undefined || upper <= 0n) fail('workspace_acceptance_invalid_reservation');
  const recorded = windows.find(window => window.acceptanceRunId === config.acceptanceRunId);
  const prior = recorded?.reservations.find(item => item.requestId === requestId || item.operationId === operationId);
  if (prior) {
    if (!matchingScope(config, scope) || scope.runId !== state.runId || recorded!.configFingerprint !== fingerprint(config)
      || prior.requestId !== requestId || prior.operationId !== operationId || prior.phase !== scope.phase
      || usd(prior.upperCostUsd) !== upper) fail('workspace_acceptance_idempotency_conflict');
    return state;
  }
  const current = activeAcceptanceAllowance(state, config, scope);
  if (!current) fail('workspace_acceptance_not_active');
  if (windows.some(window => window.reservations.some(item => item.operationId === operationId))) fail('workspace_acceptance_idempotency_conflict');
  if (outstanding(current)) fail('workspace_acceptance_reservation_pending');
  if (current.reservations.length >= current.maxCalls) fail('workspace_acceptance_call_limit');
  if (accounted(current) + upper > (usd(current.maxCostUsd) as bigint)) fail('workspace_acceptance_cost_limit');
  const at = nowIso(scope.now);
  const reservation: Reservation = { requestId, operationId, phase: scope.phase as Reservation['phase'], state: 'RESERVED',
    upperCostUsd: usdString(upper), reservedAt: at };
  return copyState(state, windows.map(window => window === current
    ? { ...window, updatedAt: at, reservations: [...window.reservations, reservation] } : window));
}

export function settleAcceptanceAllowance(state: WorkspaceAutopilotState, acceptanceRunId: string, requestId: string,
  result: { state: 'SETTLED' | 'UNKNOWN' | 'NOT_CALLED'; actualCostUsd?: string; ledgerOperationId?: string },
  now: Scope['now']): WorkspaceAutopilotState {
  const windows = journal(state);
  const window = windows.find(item => item.acceptanceRunId === acceptanceRunId);
  const reservation = window?.reservations.find(item => item.requestId === requestId);
  const actual = result.actualCostUsd === undefined ? undefined : usd(result.actualCostUsd);
  if (!window || !reservation || !['SETTLED', 'UNKNOWN', 'NOT_CALLED'].includes(result.state)
    || (result.actualCostUsd !== undefined && actual === undefined)
    || (result.state === 'SETTLED' && (actual === undefined || !operationIdentifier(result.ledgerOperationId)))
    || (result.state === 'NOT_CALLED' && actual !== 0n)
    || (result.ledgerOperationId !== undefined && !operationIdentifier(result.ledgerOperationId))) fail('workspace_acceptance_invalid_settlement');
  const normalizedActual = actual === undefined ? undefined : usdString(actual);
  if (reservation.state !== 'RESERVED') {
    if (reservation.state !== result.state || reservation.actualCostUsd !== normalizedActual
      || reservation.ledgerOperationId !== result.ledgerOperationId) fail('workspace_acceptance_already_settled');
    return state;
  }
  const at = nowIso(now);
  const overUpper = actual !== undefined && actual > (usd(reservation.upperCostUsd) as bigint);
  const settled: Reservation = { ...reservation, state: overUpper ? 'UNKNOWN' : result.state,
    ...(normalizedActual !== undefined ? { actualCostUsd: normalizedActual } : {}),
    ...(result.ledgerOperationId ? { ledgerOperationId: result.ledgerOperationId } : {}), settledAt: at };
  let next: Window = { ...window, updatedAt: at, reservations: window.reservations.map(item => item === reservation ? settled : item) };
  if (settled.state === 'UNKNOWN' || settled.state === 'NOT_CALLED' || accounted(next) > (usd(window.maxCostUsd) as bigint)) next = close(next, 'FAILED', at);
  else if (window.status === 'ACTIVE' && (next.reservations.length >= next.maxCalls || accounted(next) >= (usd(next.maxCostUsd) as bigint))) next = close(next, 'EXHAUSTED', at);
  return copyState(state, windows.map(item => item === window ? next : item));
}
