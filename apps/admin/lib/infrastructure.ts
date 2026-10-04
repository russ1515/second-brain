import { api, type ApiProblem } from './api';

/**
 * Deliberately narrow client-side representation of the Operations API.
 *
 * This is an administrative security boundary as well as a rendering adapter:
 * arbitrary server fields, exception prose, environment values and telemetry
 * metadata are never propagated to the screen. Missing measurements remain
 * missing; they are never coerced to zero or a healthy state.
 */
export const INFRASTRUCTURE_RANGES = ['now', '1h', '24h', '7d'] as const;
export type InfrastructureRange = (typeof INFRASTRUCTURE_RANGES)[number];
export type SystemHealthStatus = 'HEALTHY' | 'DEGRADED' | 'UNAVAILABLE' | 'UNKNOWN';
export type DataStatus = 'OBSERVED' | 'INSUFFICIENT_DATA' | 'NOT_INSTRUMENTED' | 'UNKNOWN';
export type AlertState = 'ACTIVE' | 'NO_ACTIVE_ALERT' | 'NOT_INSTRUMENTED' | 'BUSINESS_DECISION_REQUIRED';
export type InfrastructureLoadState = 'loading' | 'available' | 'forbidden' | 'unavailable' | 'error';

export interface InfrastructureComponent {
  key: string;
  status: SystemHealthStatus;
  dataStatus: DataStatus;
  observedAt: string | null;
}

export interface ProviderHealth {
  provider: string;
  service: 'LLM' | 'EMBEDDINGS' | 'SPEECH' | 'SEARCH' | 'VISION' | 'OTHER';
  model: string | null;
  status: SystemHealthStatus;
  dataStatus: DataStatus;
  lastSuccessAt: string | null;
  lastErrorAt: string | null;
  lastObservedAt: string | null;
  sampled: boolean;
  recentAttempts: number | null;
  recentFailures: number | null;
  recentRetryOperations: number | null;
  averageLatencyMs: number | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
}

export interface InfrastructureAlert {
  key: string;
  component: string;
  state: AlertState;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | null;
  observedAt: string | null;
}

export interface InfrastructureCorrelation {
  component: string;
  source: string;
  bugGroupId: string;
  incidentId: string | null;
  severity: string;
  occurrenceCount: number | null;
  affectedUsersCount: number | null;
  lastSeen: string | null;
}

export interface InfrastructureOverview {
  range: { key: InfrastructureRange; from: string | null; to: string | null };
  generatedAt: string | null;
  overall: { status: SystemHealthStatus; dataStatus: DataStatus };
  components: InfrastructureComponent[];
  performance: {
    currentProcess: {
      dataStatus: DataStatus;
      scope: 'CURRENT_PROCESS_ONLY';
      uptimeSeconds: number | null;
      requestCount: number | null;
      serverErrors: number | null;
      errorRate: number | null;
      p50Ms: number | null;
      p95Ms: number | null;
      processRssMb: number | null;
      processHeapUsedMb: number | null;
    };
    selectedRange: {
      dataStatus: DataStatus;
      errorEvents: number | null;
      httpErrorRate: null;
      slowRequests: null;
    };
  };
  providers: ProviderHealth[];
  resources: {
    dataStatus: DataStatus;
    observedAt: string | null;
    host: {
      uptimeSeconds: number | null;
      cpuCores: number | null;
      load1: number | null;
      load5: number | null;
      load15: number | null;
      memoryTotalBytes: number | null;
      memoryAvailableBytes: number | null;
      diskTotalBytes: number | null;
      diskAvailableBytes: number | null;
    } | null;
    containers: {
      total: number | null;
      running: number | null;
      unhealthy: number | null;
      restarting: number | null;
    } | null;
  };
  alerts: InfrastructureAlert[];
  correlations: InfrastructureCorrelation[];
}

export interface InfrastructureResult {
  state: InfrastructureLoadState;
  data?: InfrastructureOverview;
  code?: string;
  requestId?: string;
}

type RecordValue = Record<string, unknown>;

const healthStatuses = new Set<SystemHealthStatus>(['HEALTHY', 'DEGRADED', 'UNAVAILABLE', 'UNKNOWN']);
const dataStatuses = new Set<DataStatus>(['OBSERVED', 'INSUFFICIENT_DATA', 'NOT_INSTRUMENTED', 'UNKNOWN']);
const alertStates = new Set<AlertState>(['ACTIVE', 'NO_ACTIVE_ALERT', 'NOT_INSTRUMENTED', 'BUSINESS_DECISION_REQUIRED']);
const severities = new Set<NonNullable<InfrastructureAlert['severity']>>(['CRITICAL', 'HIGH', 'MEDIUM']);
const services = new Set<ProviderHealth['service']>(['LLM', 'EMBEDDINGS', 'SPEECH', 'SEARCH', 'VISION', 'OTHER']);

function record(value: unknown): RecordValue | undefined {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : undefined;
}

function enumValue<T extends string>(value: unknown, allowed: Set<T>): T | undefined {
  return typeof value === 'string' && allowed.has(value as T) ? value as T : undefined;
}

function safeIdentifier(value: unknown, maximum = 96): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return /^[A-Za-z0-9][A-Za-z0-9_.:/-]{0,95}$/.test(trimmed) && trimmed.length <= maximum ? trimmed : undefined;
}

function safeProviderName(value: unknown): string | undefined {
  const name = safeIdentifier(value, 32)?.toLowerCase();
  return name && new Set(['openai', 'gemini', 'echo', 'fake', 'anthropic', 'claude', 'ollama', 'resend', 'unknown']).has(name)
    ? name
    : undefined;
}

function safeModelName(value: unknown): string | undefined {
  const model = safeIdentifier(value, 96);
  return model
    && !secretLikeModelName(model)
    && /^(?:gpt|o[0-9]|text-embedding|gemini|claude|llama|mistral|qwen|whisper|tts|fake|echo)[A-Za-z0-9._:-]{0,80}$/i.test(model)
    ? model
    : undefined;
}

function secretLikeModelName(value: string): boolean {
  return /(?:^|[-_:])(?:sk|key|token|secret|password|credential|bearer|authorization)(?:[-_:]|$)|postgres(?:ql)?:\/\//i.test(value);
}

function safeKey(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim().toUpperCase();
  return /^[A-Z][A-Z0-9_]{0,63}$/.test(trimmed) ? trimmed : undefined;
}

function safeDate(value: unknown): string | null {
  return typeof value === 'string' && value.length <= 64 && !Number.isNaN(Date.parse(value)) ? value : null;
}

function numberValue(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 && value <= Number.MAX_SAFE_INTEGER ? value : null;
}

function items(value: unknown): RecordValue[] {
  return Array.isArray(value) ? value.map(record).filter((item): item is RecordValue => Boolean(item)) : [];
}

function component(value: RecordValue): InfrastructureComponent | undefined {
  const key = safeKey(value.key);
  const status = enumValue(value.status, healthStatuses);
  const dataStatus = enumValue(value.dataStatus, dataStatuses);
  if (!key || !status || !dataStatus) return undefined;
  return { key, status, dataStatus, observedAt: safeDate(value.observedAt) };
}

function provider(value: RecordValue): ProviderHealth | undefined {
  const providerName = safeProviderName(value.provider);
  const service = enumValue(value.service, services);
  const status = enumValue(value.status, healthStatuses);
  const dataStatus = enumValue(value.dataStatus, dataStatuses);
  if (!providerName || !service || !status || !dataStatus) return undefined;
  return {
    provider: providerName,
    service,
    model: safeModelName(value.model) ?? null,
    status,
    dataStatus,
    lastSuccessAt: safeDate(value.lastSuccessAt),
    lastErrorAt: safeDate(value.lastErrorAt),
    lastObservedAt: safeDate(value.lastObservedAt),
    sampled: value.sampled === true,
    recentAttempts: numberValue(value.recentAttempts),
    recentFailures: numberValue(value.recentFailures),
    recentRetryOperations: numberValue(value.recentRetryOperations),
    averageLatencyMs: numberValue(value.averageLatencyMs),
    inputTokens: numberValue(value.inputTokens),
    cachedInputTokens: numberValue(value.cachedInputTokens),
    outputTokens: numberValue(value.outputTokens),
  };
}

function alert(value: RecordValue): InfrastructureAlert | undefined {
  const key = safeIdentifier(value.key, 128);
  const componentName = safeKey(value.component);
  const state = enumValue(value.state, alertStates);
  if (!key || !componentName || !state) return undefined;
  const severity = enumValue(value.severity, severities) ?? null;
  return { key, component: componentName, state, severity, observedAt: safeDate(value.observedAt) };
}

function correlation(value: RecordValue): InfrastructureCorrelation | undefined {
  const componentName = safeKey(value.component);
  const source = safeKey(value.source);
  const bugGroupId = safeIdentifier(value.bugGroupId, 128);
  const severity = safeKey(value.severity);
  if (!componentName || !source || !bugGroupId || !severity) return undefined;
  return {
    component: componentName,
    source,
    bugGroupId,
    incidentId: safeIdentifier(value.incidentId, 128) ?? null,
    severity,
    occurrenceCount: numberValue(value.occurrenceCount),
    affectedUsersCount: numberValue(value.affectedUsersCount),
    lastSeen: safeDate(value.lastSeen),
  };
}

function nullableMetrics(source: RecordValue | undefined, keys: readonly string[]): Record<string, number | null> {
  return Object.fromEntries(keys.map((key) => [key, numberValue(source?.[key])])) as Record<string, number | null>;
}

/**
 * Accept the documented response only. An optional `{ data }` wrapper is
 * accepted during a rolling deployment, but no unknown field is retained.
 */
export function parseInfrastructureOverview(payload: unknown): InfrastructureOverview | undefined {
  const envelope = record(payload);
  const root = record(envelope?.data) ?? envelope;
  if (!root) return undefined;

  const range = record(root.range);
  const rangeKey = enumValue(range?.key, new Set<InfrastructureRange>(INFRASTRUCTURE_RANGES));
  const overall = record(root.overall);
  const overallStatus = enumValue(overall?.status, healthStatuses);
  const overallDataStatus = enumValue(overall?.dataStatus, dataStatuses);
  const performance = record(root.performance);
  const currentProcess = record(performance?.currentProcess);
  const selectedRange = record(performance?.selectedRange);
  const currentDataStatus = enumValue(currentProcess?.dataStatus, dataStatuses);
  const selectedDataStatus = enumValue(selectedRange?.dataStatus, dataStatuses);
  const resources = record(root.resources);
  const resourcesDataStatus = enumValue(resources?.dataStatus, dataStatuses);
  if (!rangeKey || !overallStatus || !overallDataStatus || !currentDataStatus || !selectedDataStatus || !resourcesDataStatus) return undefined;

  const current = nullableMetrics(currentProcess, ['uptimeSeconds', 'requestCount', 'serverErrors', 'errorRate', 'p50Ms', 'p95Ms', 'processRssMb', 'processHeapUsedMb']);
  const selected = nullableMetrics(selectedRange, ['errorEvents']);
  const host = record(resources?.host);
  const containers = record(resources?.containers);
  const hostMetrics = host ? nullableMetrics(host, ['uptimeSeconds', 'cpuCores', 'load1', 'load5', 'load15', 'memoryTotalBytes', 'memoryAvailableBytes', 'diskTotalBytes', 'diskAvailableBytes']) : null;
  const containerMetrics = containers ? nullableMetrics(containers, ['total', 'running', 'unhealthy', 'restarting']) : null;

  return {
    range: { key: rangeKey, from: safeDate(range?.from), to: safeDate(range?.to) },
    generatedAt: safeDate(root.generatedAt),
    overall: { status: overallStatus, dataStatus: overallDataStatus },
    components: items(root.components).map(component).filter((item): item is InfrastructureComponent => Boolean(item)),
    performance: {
      currentProcess: {
        dataStatus: currentDataStatus,
        scope: 'CURRENT_PROCESS_ONLY',
        uptimeSeconds: current.uptimeSeconds,
        requestCount: current.requestCount,
        serverErrors: current.serverErrors,
        errorRate: current.errorRate,
        p50Ms: current.p50Ms,
        p95Ms: current.p95Ms,
        processRssMb: current.processRssMb,
        processHeapUsedMb: current.processHeapUsedMb,
      },
      selectedRange: {
        dataStatus: selectedDataStatus,
        errorEvents: selected.errorEvents,
        httpErrorRate: null,
        slowRequests: null,
      },
    },
    providers: items(root.providers).map(provider).filter((item): item is ProviderHealth => Boolean(item)),
    resources: {
      dataStatus: resourcesDataStatus,
      observedAt: safeDate(resources?.observedAt),
      host: hostMetrics ? {
        uptimeSeconds: hostMetrics.uptimeSeconds,
        cpuCores: hostMetrics.cpuCores,
        load1: hostMetrics.load1,
        load5: hostMetrics.load5,
        load15: hostMetrics.load15,
        memoryTotalBytes: hostMetrics.memoryTotalBytes,
        memoryAvailableBytes: hostMetrics.memoryAvailableBytes,
        diskTotalBytes: hostMetrics.diskTotalBytes,
        diskAvailableBytes: hostMetrics.diskAvailableBytes,
      } : null,
      containers: containerMetrics ? {
        total: containerMetrics.total,
        running: containerMetrics.running,
        unhealthy: containerMetrics.unhealthy,
        restarting: containerMetrics.restarting,
      } : null,
    },
    alerts: items(root.alerts).map(alert).filter((item): item is InfrastructureAlert => Boolean(item)),
    correlations: items(root.correlations).map(correlation).filter((item): item is InfrastructureCorrelation => Boolean(item)),
  };
}

function problemResult(problem: ApiProblem): InfrastructureResult {
  if (problem.status === 403) return { state: 'forbidden', code: problem.code, requestId: problem.requestId };
  if (problem.status === 404) return { state: 'unavailable', code: problem.code, requestId: problem.requestId };
  return { state: 'error', code: problem.code, requestId: problem.requestId };
}

export async function getInfrastructure(range: InfrastructureRange): Promise<InfrastructureResult> {
  try {
    const data = parseInfrastructureOverview(await api<unknown>(`/admin/infrastructure?range=${encodeURIComponent(range)}`));
    return data ? { state: 'available', data } : { state: 'error', code: 'INVALID_INFRASTRUCTURE_RESPONSE' };
  } catch (error) {
    return problemResult(error as ApiProblem);
  }
}
