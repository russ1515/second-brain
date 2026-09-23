import { Injectable, Logger } from '@nestjs/common';
import {
  BugStatus,
  ErrorEventSource,
  ErrorSeverity,
  Prisma,
  QuotaState,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContextService } from '../common/request-context.service';
import { SafeRedactionService } from './safe-redaction.service';

// Error telemetry is deliberately durable under an error spike.  A default
// Prisma interactive-transaction queue is too short for a burst of matching
// fingerprints: callers otherwise fail before they can reach the database
// transaction at all.  These values remain bounded and apply only to the
// small ErrorEvent/BugGroup transaction.
const SERIALIZATION_RETRIES = 8;
const TRANSACTION_MAX_WAIT_MS = 20_000;
const TRANSACTION_TIMEOUT_MS = 20_000;
const INGESTION_TRANSACTION_CONCURRENCY = 3;
const FINGERPRINT_VERSION = 1;
const EVENT_SOURCES = new Set(Object.values(ErrorEventSource));
const EVENT_SEVERITIES = new Set(Object.values(ErrorSeverity));

export interface ErrorEventInput {
  ingestId?: string | null;
  occurredAt?: Date | string | null;
  source: ErrorEventSource;
  severity?: ErrorSeverity;
  errorCode?: string | null;
  errorType?: string | null;
  message?: unknown;
  stack?: unknown;
  route?: string | null;
  feature?: string | null;
  provider?: string | null;
  model?: string | null;
  appVersion?: string | null;
  buildVersion?: string | null;
  platform?: string | null;
  metadata?: unknown;
  deviceMetadata?: unknown;
  retryAttempt?: number | null;
  httpStatus?: number | null;
  latencyMs?: number | null;
  quotaState?: QuotaState | null;
  planSlug?: string | null;
  providerUsageAttemptId?: string | null;
  operationId?: string | null;
}

export interface ErrorEventContext {
  /** Context derives from a verified server request; clients never select it. */
  userId?: string | null;
  sessionId?: string | null;
  requestId?: string | null;
  operationId?: string | null;
  trustedOperationId?: boolean;
}

export interface IngestedErrorEvent {
  eventId: string;
  bugGroupId: string;
  fingerprint: string;
  deduplicated: boolean;
}

/**
 * Inserts immutable ErrorEvents and transactionally maintains BugGroup impact.
 * An ingestId de-duplicates one telemetry retry only; matching fingerprints are
 * still counted as distinct real occurrences.
 */
@Injectable()
export class ErrorEventService {
  private readonly logger = new Logger(ErrorEventService.name);
  /**
   * PostgreSQL remains the cross-process concurrency authority. This small
   * in-process gate is backpressure, not a correctness shortcut: it prevents
   * an error spike from exhausting Prisma's finite connection pool before a
   * transaction can begin. Concurrent callers are queued and each still uses
   * the serializable fingerprint transaction below.
   */
  private activeIngestions = 0;
  private readonly ingestionWaiters: Array<() => void> = [];

  constructor(
    private readonly prisma: PrismaService,
    private readonly context: RequestContextService,
    private readonly redact: SafeRedactionService,
  ) {}

  async ingest(input: ErrorEventInput, explicitContext: ErrorEventContext = {}): Promise<IngestedErrorEvent> {
    const prepared = this.prepare(input, explicitContext);
    await this.acquireIngestionSlot();
    try {
      for (let attempt = 0; attempt < SERIALIZATION_RETRIES; attempt += 1) {
        try {
          return await this.prisma.$transaction(
            (tx) => this.persist(tx, prepared),
            {
              isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
              maxWait: TRANSACTION_MAX_WAIT_MS,
              timeout: TRANSACTION_TIMEOUT_MS,
            },
          );
        } catch (error) {
          if (attempt + 1 < SERIALIZATION_RETRIES && this.isRetryable(error)) {
            await this.retryBackoff(attempt);
            continue;
          }
          throw error;
        }
      }
      throw new Error('Error telemetry transaction retry exhausted');
    } finally {
      this.releaseIngestionSlot();
    }
  }

  /** Best-effort exception telemetry must never mask the original request failure. */
  captureException(exception: unknown, context: Omit<ErrorEventInput, 'source'> & { source?: ErrorEventSource } = {}): void {
    const error = exception instanceof Error ? exception : new Error(typeof exception === 'string' ? exception : 'Unknown exception');
    const candidate = error as Error & { code?: unknown; status?: unknown; statusCode?: unknown };
    const status = typeof candidate.status === 'number' ? candidate.status : typeof candidate.statusCode === 'number' ? candidate.statusCode : null;
    const source = context.source ?? this.inferSource(candidate.code);
    const severity: ErrorSeverity = status && status >= 500 ? 'high' : source === 'security' ? 'high' : 'medium';
    void this.ingest({
      ...context,
      source,
      severity,
      errorCode: this.redact.boundedIdentifier(candidate.code),
      errorType: error.name,
      // Unknown exceptions can embed a provider payload or user content.
      // Preserve type/code and structural frames, never their prose.
      message: this.genericMessage(source),
      stack: this.structuralStack(error.stack),
      httpStatus: status,
    // Capture failures must not turn the logger into a second raw exception
    // channel. The original exception can contain provider or user prose.
    }).catch(() => this.logger.warn('ErrorEvent capture failed.'));
  }

  private async persist(tx: Prisma.TransactionClient, prepared: PreparedEvent): Promise<IngestedErrorEvent> {
    if (prepared.ingestId) {
      const existing = await tx.errorEvent.findFirst({
        where: { environment: prepared.environment, ingestId: prepared.ingestId },
        select: { id: true, bugGroupId: true, fingerprint: true },
      });
      if (existing?.bugGroupId) {
        return { eventId: existing.id, bugGroupId: existing.bugGroupId, fingerprint: existing.fingerprint, deduplicated: true };
      }
    }

    const initial = await tx.bugGroup.upsert({
      where: {
        environment_fingerprintVersion_fingerprint: {
          environment: prepared.environment,
          fingerprintVersion: FINGERPRINT_VERSION,
          fingerprint: prepared.fingerprint,
        },
      },
      create: {
        environment: prepared.environment,
        fingerprint: prepared.fingerprint,
        fingerprintVersion: FINGERPRINT_VERSION,
        title: this.title(prepared),
        status: BugStatus.new,
        severity: prepared.severity,
        source: prepared.source,
        feature: prepared.feature,
        firstSeen: prepared.occurredAt,
        lastSeen: prepared.occurredAt,
      },
      update: {},
    });

    const group = await tx.bugGroup.update({
      where: { id: initial.id },
      data: {
        occurrenceCount: { increment: 1 },
        firstSeen: prepared.occurredAt < initial.firstSeen ? prepared.occurredAt : initial.firstSeen,
        lastSeen: prepared.occurredAt > initial.lastSeen ? prepared.occurredAt : initial.lastSeen,
        severity: this.maxSeverity(initial.severity, prepared.severity),
      },
    });

    const event = await tx.errorEvent.create({
      data: {
        ingestId: prepared.ingestId,
        occurredAt: prepared.occurredAt,
        environment: prepared.environment,
        source: prepared.source,
        severity: prepared.severity,
        errorCode: prepared.errorCode,
        errorType: prepared.errorType,
        messageSanitized: prepared.messageSanitized,
        stackFingerprint: prepared.stackFingerprint,
        stackDetailSanitized: prepared.stackDetailSanitized,
        fingerprint: prepared.fingerprint,
        fingerprintVersion: FINGERPRINT_VERSION,
        userId: prepared.userId,
        sessionId: prepared.sessionId,
        requestId: prepared.requestId,
        operationId: prepared.operationId,
        route: prepared.route,
        feature: prepared.feature,
        provider: prepared.provider,
        model: prepared.model,
        appVersion: prepared.appVersion,
        buildVersion: prepared.buildVersion,
        platform: prepared.platform,
        deviceMetadataSanitized: prepared.deviceMetadata as Prisma.InputJsonValue | undefined,
        quotaState: prepared.quotaState,
        planSlug: prepared.planSlug,
        httpStatus: prepared.httpStatus,
        latencyMs: prepared.latencyMs,
        retryAttempt: prepared.retryAttempt,
        metadataSanitized: prepared.metadata as Prisma.InputJsonValue | undefined,
        providerUsageAttemptId: prepared.providerUsageAttemptId,
        bugGroupId: group.id,
      },
      select: { id: true },
    });

    if (prepared.userId) await this.recordAffectedUser(tx, group.id, prepared.userId, prepared.occurredAt);
    return { eventId: event.id, bugGroupId: group.id, fingerprint: prepared.fingerprint, deduplicated: false };
  }

  private async recordAffectedUser(tx: Prisma.TransactionClient, bugGroupId: string, userId: string, at: Date): Promise<void> {
    const existing = await tx.bugAffectedUser.findUnique({ where: { bugGroupId_userId: { bugGroupId, userId } } });
    if (existing) {
      await tx.bugAffectedUser.update({
        where: { bugGroupId_userId: { bugGroupId, userId } },
        data: {
          occurrenceCount: { increment: 1 },
          firstAffectedAt: at < existing.firstAffectedAt ? at : existing.firstAffectedAt,
          lastAffectedAt: at > existing.lastAffectedAt ? at : existing.lastAffectedAt,
        },
      });
      return;
    }
    await tx.bugAffectedUser.create({ data: { bugGroupId, userId, occurrenceCount: 1, firstAffectedAt: at, lastAffectedAt: at } });
    await tx.bugGroup.update({ where: { id: bugGroupId }, data: { affectedUsersCount: { increment: 1 } } });
  }

  private prepare(input: ErrorEventInput, explicit: ErrorEventContext): PreparedEvent {
    const current = this.context.current();
    const source = EVENT_SOURCES.has(input.source) ? input.source : ErrorEventSource.backend;
    const severity = input.severity && EVENT_SEVERITIES.has(input.severity) ? input.severity : ErrorSeverity.medium;
    const occurredAt = this.safeOccurredAt(input.occurredAt);
    const opaqueSource = source !== ErrorEventSource.frontend;
    const stack = this.redact.stack(opaqueSource ? this.structuralStack(input.stack) : input.stack);
    const errorCode = this.redact.boundedIdentifier(input.errorCode);
    const errorType = this.redact.boundedIdentifier(input.errorType);
    const route = this.redact.route(input.route);
    const feature = this.redact.boundedIdentifier(input.feature);
    const provider = this.redact.boundedIdentifier(input.provider);
    const model = this.redact.boundedIdentifier(input.model);
    const appVersion = this.redact.boundedIdentifier(input.appVersion);
    const buildVersion = this.redact.boundedIdentifier(input.buildVersion);
    const platform = this.redact.boundedIdentifier(input.platform);
    const requestId = explicit.requestId ?? current?.requestId ?? null;
    const operationId = explicit.trustedOperationId ? (explicit.operationId ?? input.operationId ?? null) : (explicit.operationId ?? null);
    return {
      ingestId: this.redact.boundedIdentifier(input.ingestId),
      occurredAt,
      environment: this.environment(),
      source,
      severity,
      errorCode,
      errorType,
      messageSanitized: opaqueSource ? this.genericMessage(source) : this.redact.text(input.message),
      stackFingerprint: stack.fingerprint,
      // Server/provider stacks can retain file names or interpolated provider
      // and user context.  The structural fingerprint is sufficient for
      // grouping; no stack detail is retained for opaque server sources.
      stackDetailSanitized: opaqueSource ? null : stack.detail,
      fingerprint: this.redact.fingerprint({ source, errorCode, errorType, route, feature, provider, model, stackFingerprint: stack.fingerprint }),
      userId: explicit.userId ?? current?.userId ?? null,
      sessionId: explicit.sessionId ?? current?.sessionId ?? null,
      requestId,
      operationId: this.redact.boundedIdentifier(operationId),
      route,
      feature,
      provider,
      model,
      appVersion,
      buildVersion,
      platform,
      // Metadata accepted from integrations is not a safe schema for arbitrary
      // prose.  Server-side telemetry persists only typed top-level fields;
      // public frontend telemetry is separately strict-allowlisted.
      metadata: opaqueSource ? null : this.redact.metadata(input.metadata),
      deviceMetadata: opaqueSource ? null : this.redact.metadata(input.deviceMetadata),
      retryAttempt: this.boundedInt(input.retryAttempt, 0, 10),
      httpStatus: this.boundedInt(input.httpStatus, 100, 599),
      latencyMs: this.boundedInt(input.latencyMs, 0, 120_000),
      quotaState: input.quotaState ?? null,
      planSlug: this.redact.boundedIdentifier(input.planSlug),
      providerUsageAttemptId: explicit.trustedOperationId ? this.redact.boundedIdentifier(input.providerUsageAttemptId) : null,
    };
  }

  private title(event: PreparedEvent): string {
    return (event.errorCode ?? event.errorType ?? `${event.source}_error`).replace(/[_-]+/g, ' ').slice(0, 180);
  }

  private maxSeverity(left: ErrorSeverity, right: ErrorSeverity): ErrorSeverity {
    const rank: Record<ErrorSeverity, number> = { low: 0, medium: 1, high: 2, critical: 3 };
    return rank[right] > rank[left] ? right : left;
  }

  private safeOccurredAt(value: Date | string | null | undefined): Date {
    const parsed = value ? new Date(value) : new Date();
    const now = Date.now();
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() < now - 7 * 24 * 60 * 60 * 1_000 || parsed.getTime() > now + 5 * 60 * 1_000) return new Date();
    return parsed;
  }

  private boundedInt(value: unknown, min: number, max: number): number | null {
    return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max ? value : null;
  }

  private environment(): string {
    const value = process.env.NODE_ENV ?? 'development';
    return /^[a-z0-9_-]{1,32}$/i.test(value) ? value.toLowerCase() : 'unknown';
  }

  private inferSource(code: unknown): ErrorEventSource {
    const normalized = String(code ?? '').toUpperCase();
    if (normalized.startsWith('P20') || normalized.startsWith('P10')) return ErrorEventSource.database;
    if (normalized.includes('REDIS')) return ErrorEventSource.redis;
    if (normalized.includes('QDRANT')) return ErrorEventSource.qdrant;
    return ErrorEventSource.backend;
  }

  private genericMessage(source: ErrorEventSource): string {
    return `${source} telemetry event recorded.`;
  }

  /** Keep stack shape for a stable fingerprint while dropping its first prose line. */
  private structuralStack(value: unknown): string | null {
    if (typeof value !== 'string') return null;
    const frames = value.split(/\r?\n/).filter((line) => /^\s*at\s+/i.test(line)).slice(0, 12);
    return frames.length ? frames.join('\n') : null;
  }

  private isRetryable(error: unknown): boolean {
    const candidate = error as { code?: unknown; message?: unknown };
    const code = candidate?.code;
    // P2034 is PostgreSQL serialization contention. P2028 is Prisma's
    // bounded interactive-transaction queue/timeout error; retrying it with
    // jitter lets a burst converge instead of dropping ErrorEvents.
    return code === 'P2034'
      || code === 'P2002'
      || code === 'P2024'
      || code === 'P2028'
      || /Unable to start a transaction|Transaction API error|connection pool/i.test(String(candidate?.message ?? ''));
  }

  private async retryBackoff(attempt: number): Promise<void> {
    const bounded = Math.min(500, 25 * 2 ** attempt);
    const jitter = Math.floor(Math.random() * 25);
    await new Promise<void>((resolve) => setTimeout(resolve, bounded + jitter));
  }

  private acquireIngestionSlot(): Promise<void> {
    if (this.activeIngestions < INGESTION_TRANSACTION_CONCURRENCY) {
      this.activeIngestions += 1;
      return Promise.resolve();
    }
    return new Promise<void>((resolve) => this.ingestionWaiters.push(resolve));
  }

  private releaseIngestionSlot(): void {
    const next = this.ingestionWaiters.shift();
    if (next) {
      next();
      return;
    }
    this.activeIngestions -= 1;
  }
}

interface PreparedEvent {
  ingestId: string | null;
  occurredAt: Date;
  environment: string;
  source: ErrorEventSource;
  severity: ErrorSeverity;
  errorCode: string | null;
  errorType: string | null;
  messageSanitized: string | null;
  stackFingerprint: string | null;
  stackDetailSanitized: string | null;
  fingerprint: string;
  userId: string | null;
  sessionId: string | null;
  requestId: string | null;
  operationId: string | null;
  route: string | null;
  feature: string | null;
  provider: string | null;
  model: string | null;
  appVersion: string | null;
  buildVersion: string | null;
  platform: string | null;
  metadata: Record<string, unknown> | null;
  deviceMetadata: Record<string, unknown> | null;
  retryAttempt: number | null;
  httpStatus: number | null;
  latencyMs: number | null;
  quotaState: QuotaState | null;
  planSlug: string | null;
  providerUsageAttemptId: string | null;
}
