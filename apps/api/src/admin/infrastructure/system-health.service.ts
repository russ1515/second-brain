import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { readFile } from 'node:fs/promises';
import { PrismaService } from '../../prisma/prisma.service';
import { PrismaHealthIndicator } from '../../health/indicators/prisma.health';
import { QdrantHealthIndicator } from '../../health/indicators/qdrant.health';
import { RedisHealthIndicator } from '../../health/indicators/redis.health';
import { MetricsService } from '../../monitoring/metrics.service';
import { MailService } from '../../mail/mail.service';
import {
  INFRASTRUCTURE_RANGE_KEYS,
  type AlertState,
  type InfrastructureAlert,
  type InfrastructureCorrelation,
  type InfrastructureDataStatus,
  type InfrastructureOverview,
  type InfrastructureRange,
  type InfrastructureRangeKey,
  type ProviderHealthSummary,
  type SystemHealthComponent,
  type SystemHealthStatus,
} from './infrastructure.types';

const MINUTE_MS = 60_000;
const SNAPSHOT_DEFAULT_MAX_AGE_SECONDS = 300;
const PROVIDER_SAMPLE_LIMIT = 500;

type InternalRange = InfrastructureRange & { fromDate: Date; toDate: Date };
type ProviderService = ProviderHealthSummary['service'];

type HostSnapshot = NonNullable<InfrastructureOverview['resources']['host']> & {
  observedAt: string;
  containers: NonNullable<InfrastructureOverview['resources']['containers']>;
};

/**
 * Read-only operational view for the internal Admin shell.
 *
 * It deliberately combines live dependency probes with durable diagnostic and
 * provider-ledger evidence. It never calls a provider, creates an incident,
 * restarts a service, or returns raw exception/configuration data.
 */
@Injectable()
export class SystemHealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly metrics: MetricsService,
    private readonly prismaHealth: PrismaHealthIndicator,
    private readonly redisHealth: RedisHealthIndicator,
    private readonly qdrantHealth: QdrantHealthIndicator,
    private readonly config: ConfigService,
    private readonly mail?: MailService,
  ) {}

  async overview(rawRange?: string | string[]): Promise<InfrastructureOverview> {
    const range = this.range(rawRange);
    const generatedAt = new Date().toISOString();
    const [postgresql, redis, qdrant, providers, resourceSnapshot, rangeEvidence] = await Promise.all([
      this.prismaHealth.check(),
      this.redisHealth.check(),
      this.qdrantHealth.check(),
      this.providerHealth(range),
      this.readHostSnapshot(),
      this.rangeEvidence(range),
    ]);

    const components: SystemHealthComponent[] = [
      observedComponent('api', 'HEALTHY', generatedAt, 'VERIFIED_BY_ADMIN_RESPONSE'),
      probeComponent('postgresql', postgresql.status, generatedAt),
      probeComponent('redis', redis.status, generatedAt),
      probeComponent('qdrant', qdrant.status, generatedAt),
      mailComponent(this.mail?.health),
      notInstrumentedComponent('llm_provider', 'PROVIDER_STATUS_COMES_FROM_USAGE_LEDGER'),
      notInstrumentedComponent('embeddings', 'PROVIDER_STATUS_COMES_FROM_USAGE_LEDGER'),
      notInstrumentedComponent('speech', 'PROVIDER_STATUS_COMES_FROM_USAGE_LEDGER'),
      notInstrumentedComponent('search', 'PROVIDER_STATUS_COMES_FROM_USAGE_LEDGER'),
      notInstrumentedComponent('jobs_queues', 'JOB_QUEUE_RUNTIME_STATUS_NOT_INSTRUMENTED'),
      notInstrumentedComponent('storage', 'STORAGE_RUNTIME_STATUS_NOT_INSTRUMENTED'),
    ];

    const performance = this.performance();
    const alerts = this.alerts(components, providers, resourceSnapshot);

    return {
      range: this.publicRange(range),
      generatedAt,
      overall: overallCoreStatus(components),
      components,
      performance: {
        currentProcess: performance.currentProcess,
        selectedRange: {
          dataStatus: rangeEvidence.dataStatus,
          errorEvents: rangeEvidence.errorEvents,
          httpErrorRate: null,
          slowRequests: null,
          reason: rangeEvidence.reason,
        },
      },
      providers,
      resources: resourceSnapshot,
      alerts,
      correlations: rangeEvidence.correlations,
    };
  }

  private range(rawRange?: string | string[]): InternalRange {
    if (Array.isArray(rawRange)) {
      throw new BadRequestException({ code: 'INFRASTRUCTURE_RANGE_INVALID' });
    }
    const key = (rawRange ?? 'now') as InfrastructureRangeKey;
    if (!INFRASTRUCTURE_RANGE_KEYS.includes(key)) {
      throw new BadRequestException({ code: 'INFRASTRUCTURE_RANGE_INVALID' });
    }
    const toDate = new Date();
    const minutes = key === 'now' ? 15 : key === '1h' ? 60 : key === '24h' ? 1_440 : 10_080;
    const fromDate = new Date(toDate.getTime() - minutes * MINUTE_MS);
    return {
      key,
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      fromDate,
      toDate,
    };
  }

  private publicRange(range: InternalRange): InfrastructureRange {
    return { key: range.key, from: range.from, to: range.to };
  }

  private performance(): Pick<InfrastructureOverview['performance'], 'currentProcess'> {
    const snapshot = this.metrics.snapshot();
    const requestCount = snapshot.http.total;
    const hasSamples = requestCount > 0;
    return {
      currentProcess: {
        dataStatus: hasSamples ? 'OBSERVED' : 'INSUFFICIENT_DATA',
        scope: 'CURRENT_PROCESS_ONLY',
        uptimeSeconds: snapshot.uptimeSeconds,
        requestCount,
        serverErrors: snapshot.http.serverErrors,
        errorRate: hasSamples ? round4(snapshot.http.errorRate) : null,
        p50Ms: hasSamples ? snapshot.http.p50Ms : null,
        p95Ms: hasSamples ? snapshot.http.p95Ms : null,
        processRssMb: snapshot.process.rssMb,
        processHeapUsedMb: snapshot.process.heapUsedMb,
      },
    };
  }

  private async rangeEvidence(range: InternalRange): Promise<RangeEvidence> {
    try {
      const where = { occurredAt: { gte: range.fromDate, lt: range.toDate } };
      const [errorEvents, bugGroups] = await Promise.all([
        this.prisma.errorEvent.count({ where }),
        this.prisma.bugGroup.findMany({
          where: { lastSeen: { gte: range.fromDate, lt: range.toDate } },
          select: {
            id: true,
            source: true,
            severity: true,
            occurrenceCount: true,
            affectedUsersCount: true,
            lastSeen: true,
            incidentId: true,
          },
          orderBy: { lastSeen: 'desc' },
          take: 50,
        }),
      ]);
      return {
        dataStatus: 'OBSERVED',
        errorEvents,
        reason: 'HTTP_RATE_AND_SLOW_REQUEST_HISTORY_NOT_INSTRUMENTED',
        correlations: bugGroups.map((group) => ({
          component: componentForErrorSource(group.source),
          source: String(group.source),
          bugGroupId: group.id,
          incidentId: group.incidentId,
          severity: String(group.severity),
          occurrenceCount: group.occurrenceCount,
          affectedUsersCount: group.affectedUsersCount,
          lastSeen: group.lastSeen.toISOString(),
        })),
      };
    } catch {
      return {
        dataStatus: 'UNKNOWN',
        errorEvents: null,
        reason: 'PERSISTENT_DIAGNOSTIC_EVIDENCE_UNAVAILABLE',
        correlations: [],
      };
    }
  }

  private async providerHealth(range: InternalRange): Promise<ProviderHealthSummary[]> {
    try {
      const attempts = await this.prisma.providerUsageAttempt.findMany({
        where: { startedAt: { gte: range.fromDate, lt: range.toDate } },
        select: {
          operationId: true,
          provider: true,
          model: true,
          status: true,
          latencyMs: true,
          inputTokens: true,
          cachedInputTokens: true,
          outputTokens: true,
          startedAt: true,
          completedAt: true,
          operation: { select: { resource: true } },
        },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        take: PROVIDER_SAMPLE_LIMIT + 1,
      });

      // The screen is intentionally bounded. A sentinel row makes truncation
      // explicit instead of presenting an arbitrary first 500 as a full range.
      const sampled = attempts.length > PROVIDER_SAMPLE_LIMIT;
      const boundedAttempts = sampled ? attempts.slice(0, PROVIDER_SAMPLE_LIMIT) : attempts;

      const grouped = new Map<string, ProviderAttemptAggregate>();
      for (const attempt of boundedAttempts) {
        const provider = safeProviderLabel(attempt.provider);
        const model = attempt.model ? safeModelLabel(attempt.model) : null;
        const service = providerServiceForResource(attempt.operation.resource);
        const key = `${provider}|${model ?? ''}|${service}`;
        const aggregate = grouped.get(key) ?? createProviderAggregate(provider, model, service);
        aggregate.attempts.push({
          operationId: attempt.operationId,
          status: String(attempt.status),
          observedAt: (attempt.completedAt ?? attempt.startedAt).toISOString(),
          latencyMs: nonNegativeIntegerOrNull(attempt.latencyMs),
          inputTokens: nonNegativeIntegerOrNull(attempt.inputTokens),
          cachedInputTokens: nonNegativeIntegerOrNull(attempt.cachedInputTokens),
          outputTokens: nonNegativeIntegerOrNull(attempt.outputTokens),
        });
        grouped.set(key, aggregate);
      }

      const summaries = [...grouped.values()].map((aggregate) => providerSummary(aggregate, sampled));
      this.addConfiguredProviderPlaceholders(summaries);
      return summaries.sort((left, right) => left.provider.localeCompare(right.provider) || left.service.localeCompare(right.service));
    } catch {
      return this.configuredProviderPlaceholders('UNKNOWN');
    }
  }

  private addConfiguredProviderPlaceholders(summaries: ProviderHealthSummary[]): void {
    const configured = this.configuredProviders();
    for (const candidate of configured) {
      if (summaries.some((summary) => summary.provider === candidate.provider && summary.service === candidate.service)) {
        continue;
      }
      summaries.push(providerPlaceholder(candidate.provider, candidate.model, candidate.service, candidate.dataStatus));
    }
  }

  private configuredProviderPlaceholders(dataStatus: InfrastructureDataStatus): ProviderHealthSummary[] {
    return this.configuredProviders().map((candidate) => providerPlaceholder(
      candidate.provider,
      candidate.model,
      candidate.service,
      dataStatus === 'UNKNOWN' ? 'UNKNOWN' : candidate.dataStatus,
    ));
  }

  private configuredProviders(): Array<{ provider: string; model: string | null; service: ProviderService; dataStatus: InfrastructureDataStatus }> {
    const llmProvider = safeProviderLabel(this.config.get<string>('llm.provider') ?? 'unknown');
    const embeddingProvider = safeProviderLabel(this.config.get<string>('embeddings.provider') ?? 'unknown');
    const speechProvider = safeProviderLabel(this.config.get<string>('speech.provider') ?? 'unknown');
    return [
      { provider: llmProvider, model: safeOptionalModelLabel(this.config.get<string>('llm.model')), service: 'LLM', dataStatus: simulatedProviderStatus(llmProvider) },
      { provider: embeddingProvider, model: safeOptionalModelLabel(this.config.get<string>('embeddings.model')), service: 'EMBEDDINGS', dataStatus: simulatedProviderStatus(embeddingProvider) },
      { provider: speechProvider, model: null, service: 'SPEECH', dataStatus: simulatedProviderStatus(speechProvider) },
    ];
  }

  private async readHostSnapshot(): Promise<InfrastructureOverview['resources']> {
    const snapshotPath = this.config.get<string>('infrastructure.hostSnapshotPath');
    if (!snapshotPath) {
      return unavailableResources('NOT_INSTRUMENTED', 'HOST_SNAPSHOT_COLLECTOR_NOT_CONFIGURED');
    }
    try {
      const parsed = parseHostSnapshot(JSON.parse(await readFile(snapshotPath, 'utf8')));
      if (!parsed) {
        return unavailableResources('UNKNOWN', 'HOST_SNAPSHOT_INVALID');
      }
      const maxAgeSeconds = boundedMaxAge(this.config.get<number>('infrastructure.hostSnapshotMaxAgeSeconds'));
      const ageMs = Date.now() - Date.parse(parsed.observedAt);
      if (!Number.isFinite(ageMs) || ageMs < -60_000 || ageMs > maxAgeSeconds * 1_000) {
        return unavailableResources('UNKNOWN', 'HOST_SNAPSHOT_STALE');
      }
      return {
        dataStatus: 'OBSERVED',
        observedAt: parsed.observedAt,
        host: {
          uptimeSeconds: parsed.uptimeSeconds,
          cpuCores: parsed.cpuCores,
          load1: parsed.load1,
          load5: parsed.load5,
          load15: parsed.load15,
          memoryTotalBytes: parsed.memoryTotalBytes,
          memoryAvailableBytes: parsed.memoryAvailableBytes,
          diskTotalBytes: parsed.diskTotalBytes,
          diskAvailableBytes: parsed.diskAvailableBytes,
        },
        containers: parsed.containers,
      };
    } catch {
      return unavailableResources('UNKNOWN', 'HOST_SNAPSHOT_UNAVAILABLE');
    }
  }

  private alerts(
    components: SystemHealthComponent[],
    providers: ProviderHealthSummary[],
    resources: InfrastructureOverview['resources'],
  ): InfrastructureAlert[] {
    const active: InfrastructureAlert[] = [];
    for (const component of components) {
      if (component.status !== 'UNAVAILABLE') continue;
      active.push({
        key: `dependency_unavailable:${component.key}`,
        component: component.key,
        state: 'ACTIVE',
        severity: component.key === 'api' || component.key === 'postgresql' ? 'CRITICAL' : 'HIGH',
        observedAt: component.observedAt,
        reason: 'LIVE_DEPENDENCY_PROBE_FAILED',
      });
    }
    for (const provider of providers) {
      if (provider.status !== 'DEGRADED') continue;
      active.push({
        key: `provider_degraded:${provider.provider}:${provider.service}`,
        component: provider.provider,
        state: 'ACTIVE',
        severity: 'HIGH',
        observedAt: provider.lastObservedAt,
        reason: 'LATEST_OBSERVED_PROVIDER_ATTEMPT_FAILED',
      });
    }
    if (resources.dataStatus === 'OBSERVED' && resources.containers && (resources.containers.unhealthy > 0 || resources.containers.restarting > 0)) {
      active.push({
        key: 'containers_unhealthy_or_restarting',
        component: 'containers',
        state: 'ACTIVE',
        severity: 'HIGH',
        observedAt: resources.observedAt,
        reason: 'HOST_SNAPSHOT_REPORTED_UNHEALTHY_OR_RESTARTING_CONTAINERS',
      });
    }
    const informational: InfrastructureAlert[] = active.length === 0
      ? [{ key: 'dependency_availability', component: 'core_dependencies', state: 'NO_ACTIVE_ALERT', severity: null, observedAt: new Date().toISOString() }]
      : [];
    return [
      ...active,
      ...informational,
      alertRule('http_error_rate_threshold', 'api', 'BUSINESS_DECISION_REQUIRED'),
      alertRule('latency_threshold', 'api', 'BUSINESS_DECISION_REQUIRED'),
      alertRule('disk_low_threshold', 'host_disk', resources.dataStatus === 'OBSERVED' ? 'BUSINESS_DECISION_REQUIRED' : 'NOT_INSTRUMENTED'),
    ];
  }
}

interface RangeEvidence {
  dataStatus: InfrastructureDataStatus;
  errorEvents: number | null;
  reason?: string;
  correlations: InfrastructureCorrelation[];
}

interface ProviderAttempt {
  operationId: string;
  status: string;
  observedAt: string;
  latencyMs: number | null;
  inputTokens: number | null;
  cachedInputTokens: number | null;
  outputTokens: number | null;
}

interface ProviderAttemptAggregate {
  provider: string;
  model: string | null;
  service: ProviderService;
  attempts: ProviderAttempt[];
}

function observedComponent(key: string, status: SystemHealthStatus, observedAt: string, reason?: string): SystemHealthComponent {
  return { key, status, dataStatus: 'OBSERVED', observedAt, reason };
}

function probeComponent(key: string, status: string, observedAt: string): SystemHealthComponent {
  return observedComponent(key, status === 'up' ? 'HEALTHY' : 'UNAVAILABLE', observedAt);
}

function notInstrumentedComponent(key: string, reason: string): SystemHealthComponent {
  return { key, status: 'UNKNOWN', dataStatus: 'NOT_INSTRUMENTED', observedAt: null, reason };
}

function mailComponent(health: { status: SystemHealthStatus | 'NOT_INSTRUMENTED'; observedAt: string | null } | undefined): SystemHealthComponent {
  if (!health || health.status === 'NOT_INSTRUMENTED') {
    return notInstrumentedComponent('smtp', health ? 'SMTP_TRANSPORT_IS_SIMULATED' : 'SMTP_HEALTH_SERVICE_UNAVAILABLE');
  }
  return {
    key: 'smtp',
    status: health.status,
    dataStatus: health.status === 'UNKNOWN' ? 'UNKNOWN' : 'OBSERVED',
    observedAt: health.observedAt,
    reason: health.status === 'UNKNOWN'
      ? health.observedAt ? 'SMTP_VERIFICATION_STALE' : 'SMTP_VERIFICATION_PENDING'
      : undefined,
  };
}

function overallCoreStatus(components: SystemHealthComponent[]): InfrastructureOverview['overall'] {
  const core = components.filter((component) => ['api', 'postgresql', 'redis', 'qdrant'].includes(component.key));
  if (core.some((component) => component.status === 'UNAVAILABLE')) {
    return { status: 'UNAVAILABLE', dataStatus: 'OBSERVED', reason: 'CORE_RUNTIME_DEPENDENCY_UNAVAILABLE' };
  }
  if (core.some((component) => component.status === 'DEGRADED')) {
    return { status: 'DEGRADED', dataStatus: 'OBSERVED', reason: 'CORE_RUNTIME_DEPENDENCY_DEGRADED' };
  }
  if (core.some((component) => component.status === 'UNKNOWN')) {
    return { status: 'UNKNOWN', dataStatus: 'UNKNOWN', reason: 'CORE_RUNTIME_DEPENDENCY_STATUS_UNKNOWN' };
  }
  return {
    status: 'HEALTHY',
    dataStatus: 'OBSERVED',
    reason: 'CORE_RUNTIME_DEPENDENCIES_HEALTHY; ADDITIONAL_COMPONENTS_MAY_BE_NOT_INSTRUMENTED',
  };
}

function providerServiceForResource(resource: unknown): ProviderService {
  switch (String(resource ?? '')) {
    case 'AI_TEXT':
    case 'ACADEMIC_AI':
      return 'LLM';
    case 'EMBEDDING_UNITS':
      return 'EMBEDDINGS';
    case 'VOICE_SECONDS':
      return 'SPEECH';
    case 'WEB_SEARCH':
    case 'DEEP_RESEARCH':
      return 'SEARCH';
    case 'OCR_PAGES':
      return 'VISION';
    default:
      return 'OTHER';
  }
}

function createProviderAggregate(provider: string, model: string | null, service: ProviderService): ProviderAttemptAggregate {
  return { provider, model, service, attempts: [] };
}

function providerSummary(aggregate: ProviderAttemptAggregate, sampled: boolean): ProviderHealthSummary {
  const attempts = aggregate.attempts;
  const latest = attempts[0];
  const successes = attempts.filter((attempt) => attempt.status === 'SUCCEEDED');
  const failures = attempts.filter((attempt) => attempt.status === 'FAILED');
  const operations = new Map<string, number>();
  for (const attempt of attempts) {
    operations.set(attempt.operationId, (operations.get(attempt.operationId) ?? 0) + 1);
  }
  const latencySamples = attempts.map((attempt) => attempt.latencyMs).filter((latency): latency is number => latency !== null);
  return {
    provider: aggregate.provider,
    service: aggregate.service,
    model: aggregate.model,
    status: latest?.status === 'SUCCEEDED' ? 'HEALTHY' : latest?.status === 'FAILED' ? 'DEGRADED' : 'UNKNOWN',
    dataStatus: sampled ? 'INSUFFICIENT_DATA' : attempts.length > 0 ? 'OBSERVED' : 'INSUFFICIENT_DATA',
    lastSuccessAt: successes[0]?.observedAt ?? null,
    lastErrorAt: failures[0]?.observedAt ?? null,
    lastObservedAt: latest?.observedAt ?? null,
    sampled,
    recentAttempts: attempts.length,
    recentFailures: failures.length,
    recentRetryOperations: [...operations.values()].filter((count) => count > 1).length,
    averageLatencyMs: latencySamples.length === 0 ? null : Math.round(latencySamples.reduce((sum, value) => sum + value, 0) / latencySamples.length),
    inputTokens: aggregateTokenTotal(attempts, 'inputTokens'),
    cachedInputTokens: aggregateTokenTotal(attempts, 'cachedInputTokens'),
    outputTokens: aggregateTokenTotal(attempts, 'outputTokens'),
  };
}

function providerPlaceholder(
  provider: string,
  model: string | null,
  service: ProviderService,
  dataStatus: InfrastructureDataStatus,
): ProviderHealthSummary {
  return {
    provider,
    service,
    model,
    status: 'UNKNOWN',
    dataStatus,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastObservedAt: null,
    sampled: false,
    recentAttempts: null,
    recentFailures: null,
    recentRetryOperations: null,
    averageLatencyMs: null,
    inputTokens: null,
    cachedInputTokens: null,
    outputTokens: null,
  };
}

function simulatedProviderStatus(provider: string): InfrastructureDataStatus {
  return provider === 'echo' || provider === 'fake' ? 'NOT_INSTRUMENTED' : 'INSUFFICIENT_DATA';
}

function aggregateTokenTotal(attempts: ProviderAttempt[], key: 'inputTokens' | 'cachedInputTokens' | 'outputTokens'): number | null {
  const values = attempts.map((attempt) => attempt[key]).filter((value): value is number => value !== null);
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0);
}

function componentForErrorSource(source: unknown): string {
  switch (String(source)) {
    case 'database': return 'postgresql';
    case 'redis': return 'redis';
    case 'qdrant': return 'qdrant';
    case 'provider': return 'provider';
    case 'mail': return 'smtp';
    case 'worker': return 'jobs_queues';
    case 'payment': return 'payment_provider';
    default: return 'api';
  }
}

function unavailableResources(dataStatus: InfrastructureDataStatus, reason: string): InfrastructureOverview['resources'] {
  return { dataStatus, observedAt: null, reason, host: null, containers: null };
}

function parseHostSnapshot(raw: unknown): HostSnapshot | null {
  if (!isRecord(raw) || raw.schemaVersion !== 1 || typeof raw.observedAt !== 'string') return null;
  const observedAt = new Date(raw.observedAt);
  if (Number.isNaN(observedAt.getTime()) || !isRecord(raw.host) || !isRecord(raw.containers)) return null;
  const host = raw.host;
  const containers = raw.containers;
  const numbers = [
    host.uptimeSeconds,
    host.cpuCores,
    host.load1,
    host.load5,
    host.load15,
    host.memoryTotalBytes,
    host.memoryAvailableBytes,
    host.diskTotalBytes,
    host.diskAvailableBytes,
    containers.total,
    containers.running,
    containers.unhealthy,
    containers.restarting,
  ];
  if (!numbers.every(isNonNegativeFiniteNumber)) return null;
  const memoryTotalBytes = host.memoryTotalBytes as number;
  const memoryAvailableBytes = host.memoryAvailableBytes as number;
  const diskTotalBytes = host.diskTotalBytes as number;
  const diskAvailableBytes = host.diskAvailableBytes as number;
  const containerTotal = containers.total as number;
  const containerRunning = containers.running as number;
  const containerUnhealthy = containers.unhealthy as number;
  const containerRestarting = containers.restarting as number;
  if (
    memoryAvailableBytes > memoryTotalBytes
    || diskAvailableBytes > diskTotalBytes
    || containerRunning > containerTotal
    || containerUnhealthy > containerTotal
    || containerRestarting > containerTotal
  ) return null;
  return {
    observedAt: observedAt.toISOString(),
    uptimeSeconds: host.uptimeSeconds as number,
    cpuCores: host.cpuCores as number,
    load1: host.load1 as number,
    load5: host.load5 as number,
    load15: host.load15 as number,
    memoryTotalBytes: host.memoryTotalBytes as number,
    memoryAvailableBytes: host.memoryAvailableBytes as number,
    diskTotalBytes: host.diskTotalBytes as number,
    diskAvailableBytes: host.diskAvailableBytes as number,
    containers: {
      total: containers.total as number,
      running: containers.running as number,
      unhealthy: containers.unhealthy as number,
      restarting: containers.restarting as number,
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonNegativeFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

function nonNegativeIntegerOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0 ? value : null;
}

function boundedMaxAge(value: number | undefined): number {
  if (!Number.isSafeInteger(value) || !value || value <= 0) return SNAPSHOT_DEFAULT_MAX_AGE_SECONDS;
  return Math.min(3_600, Math.max(30, value));
}

function alertRule(key: string, component: string, state: AlertState): InfrastructureAlert {
  return { key, component, state, severity: null, observedAt: null };
}

function safeProviderLabel(value: string): string {
  const provider = value.trim().toLowerCase();
  return new Set(['openai', 'gemini', 'echo', 'fake', 'anthropic', 'claude', 'ollama', 'resend']).has(provider)
    ? provider
    : 'unknown';
}

function safeModelLabel(value: string): string {
  const model = value.trim();
  // Model identifiers have a constrained vocabulary. Do not turn an accidental
  // provider credential in an environment variable or ledger metadata into UI.
  return !secretLikeLabel(model)
    && /^(?:gpt|o[0-9]|text-embedding|gemini|claude|llama|mistral|qwen|whisper|tts|fake|echo)[A-Za-z0-9._:-]{0,80}$/i.test(model)
    ? model
    : 'unknown';
}

function secretLikeLabel(value: string): boolean {
  return /(?:^|[-_:])(?:sk|key|token|secret|password|credential|bearer|authorization)(?:[-_:]|$)|postgres(?:ql)?:\/\//i.test(value);
}

function safeOptionalModelLabel(value: string | undefined): string | null {
  return value ? safeModelLabel(value) : null;
}

function round4(value: number): number {
  return Math.round(value * 10_000) / 10_000;
}
