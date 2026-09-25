import { ConflictException, Injectable, Logger } from '@nestjs/common';
import {
  Prisma,
  ProviderCostStatus,
  type QuotaResource,
  type QuotaState,
} from '@prisma/client';
import type { LLMGenerateResult } from '@second-brain/shared';
import { RequestContextService } from '../common/request-context.service';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import { QuotaService } from './quota.service';
import { ErrorEventService } from '../diagnostics/error-event.service';

type Primitive = string | number | boolean | null;
type SafeMetadata = Record<string, Primitive | undefined>;
type MeasurementSource = 'PROVIDER' | 'OBSERVED';

/** Normalized provider units. No prompt, audio, response body, or secret belongs here. */
export interface ProviderUsageMeasurement {
  providerRequestId?: string | null;
  model?: string | null;
  inputTokens?: number | null;
  cachedInputTokens?: number | null;
  outputTokens?: number | null;
  reasoningTokens?: number | null;
  audioInputSeconds?: number | null;
  audioOutputSeconds?: number | null;
  ocrPages?: number | null;
  visionCalls?: number | null;
  embeddingUnits?: number | null;
  searchUnits?: number | null;
  otherUnits?: number | null;
  /** PROVIDER = returned by provider; OBSERVED = transparent, bounded estimate. */
  measurementSource?: MeasurementSource;
  /**
   * A stable reason that a returned provider usage shape cannot be fully priced
   * by the current immutable catalog. It must force UNKNOWN, never a $0 total.
   */
  unpricedUsageReason?: string | null;
  metadata?: SafeMetadata;
}

export interface ProviderMeteringInput {
  provider: string;
  model?: string;
  feature: string;
  resource: QuotaResource;
  units: number;
  metadata?: SafeMetadata;
  operationId?: string;
  measure?: (result: unknown) => ProviderUsageMeasurement;
}

export interface ProviderAttemptInput {
  provider?: string;
  model?: string;
  metadata?: SafeMetadata;
  measure?: (result: unknown) => ProviderUsageMeasurement;
}

export interface ProviderAttemptRunner {
  attempt<T>(call: () => Promise<T>, input?: ProviderAttemptInput): Promise<T>;
}

interface CostCalculation {
  costStatus: ProviderCostStatus;
  originalAmount: Prisma.Decimal | null;
  originalCurrency: string | null;
  referenceAmountUsd: Prisma.Decimal | null;
  pricingVersionId: string | null;
  pricingVersion: string | null;
  pricingSnapshot: Prisma.InputJsonValue | undefined;
}

interface OpenOperation {
  id: string;
  reservationId: string | null;
  reservationStatus: string | null;
  legacyUsageId: string | null;
}

const UNIT_FIELDS = [
  'inputTokens', 'cachedInputTokens', 'outputTokens', 'reasoningTokens',
  'audioInputSeconds', 'audioOutputSeconds', 'ocrPages', 'visionCalls',
  'embeddingUnits', 'searchUnits', 'otherUnits',
] as const;

const SENSITIVE_METADATA = /(?:secret|token|authorization|password|prompt|content|audio|transcript|response|cookie|api[-_]?key)/i;

/**
 * Immutable provider-cost ledger. It deliberately separates the commercial
 * quota reservation from the provider attempts that one logical action can
 * create (retries / fallback). Unknown telemetry is recorded as a status,
 * never transformed into a numeric zero.
 */
@Injectable()
export class ProviderMeteringService {
  private readonly logger = new Logger(ProviderMeteringService.name);
  private readonly inFlight = new Map<string, Promise<unknown>>();

  constructor(
    private readonly context: RequestContextService,
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
    private readonly quotas: QuotaService,
    private readonly errorEvents: ErrorEventService,
  ) {}

  /** One-attempt compatibility API used by simple provider seams. */
  execute<T>(input: ProviderMeteringInput, operation: () => Promise<T>): Promise<T> {
    return this.executeWithAttempts(input, (runner) => runner.attempt(operation));
  }

  /** Use for retry/fallback-aware callers. Every runner.attempt is durable. */
  executeWithAttempts<T>(
    input: ProviderMeteringInput,
    operation: (runner: ProviderAttemptRunner) => Promise<T>,
  ): Promise<T> {
    const current = this.context.current();
    const operationId = input.operationId ?? this.context.nextOperationId(input.provider, input.resource);
    // No AsyncLocalStorage context means startup/unit work, not request traffic.
    // A request with no user remains visible below as unattributed usage.
    if (!current || !operationId) return operation({ attempt: (call) => call() });
    const active = this.inFlight.get(operationId) as Promise<T> | undefined;
    if (active) return active;
    const run = this.run(input, operationId, operation).finally(() => this.inFlight.delete(operationId));
    this.inFlight.set(operationId, run);
    return run;
  }

  private async run<T>(
    input: ProviderMeteringInput,
    operationId: string,
    operation: (runner: ProviderAttemptRunner) => Promise<T>,
  ): Promise<T> {
    // Supports pre-Sprint-4 unit doubles only. A generated Prisma client always
    // has these delegates once the additive migration is deployed.
    if (!this.hasSprint4Ledger()) return this.executeLegacy(input, operation);

    let opened: OpenOperation | null = null;
    let providerSucceeded = false;
    try {
      opened = await this.open(input, operationId);
      let attemptNumber = await this.prisma.providerUsageAttempt.count({
        where: { operationId: opened.id },
      });
      const runner: ProviderAttemptRunner = {
        attempt: async <R>(call: () => Promise<R>, override: ProviderAttemptInput = {}) => {
          attemptNumber += 1;
          const provider = cleanIdentifier(override.provider ?? input.provider) ?? 'unknown';
          const model = cleanIdentifier(override.model ?? input.model);
          const startedAt = new Date();
          const attempt = await this.prisma.providerUsageAttempt.create({
            data: {
              operationId: opened!.id,
              attemptNumber,
              attemptId: `${opened!.id}:attempt:${attemptNumber}`,
              provider,
              model,
              measurementSource: 'PROVIDER',
              metadata: safeMetadata({ ...input.metadata, ...override.metadata }),
              startedAt,
            },
          });
          try {
            const result = await call();
            const measurement = this.normalizeMeasurement(
              (override.measure ?? input.measure)?.(result) ?? {},
              model,
            );
            const cost = await this.calculateCost(provider, measurement, startedAt);
            const completedAt = new Date();
            await this.prisma.providerUsageAttempt.update({
              where: { id: attempt.id },
              data: {
                status: 'SUCCEEDED',
                costStatus: cost.costStatus,
                measurementSource: measurement.measurementSource,
                providerRequestId: measurement.providerRequestId,
                model: measurement.model,
                inputTokens: measurement.inputTokens,
                cachedInputTokens: measurement.cachedInputTokens,
                outputTokens: measurement.outputTokens,
                reasoningTokens: measurement.reasoningTokens,
                audioInputSeconds: measurement.audioInputSeconds,
                audioOutputSeconds: measurement.audioOutputSeconds,
                ocrPages: measurement.ocrPages,
                visionCalls: measurement.visionCalls,
                embeddingUnits: measurement.embeddingUnits,
                searchUnits: measurement.searchUnits,
                otherUnits: measurement.otherUnits,
                originalAmount: cost.originalAmount,
                originalCurrency: cost.originalCurrency,
                referenceAmountUsd: cost.referenceAmountUsd,
                pricingVersionId: cost.pricingVersionId,
                pricingVersion: cost.pricingVersion,
                pricingSnapshot: cost.pricingSnapshot,
                latencyMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
                metadata: safeMetadata({ ...input.metadata, ...override.metadata, ...measurement.metadata }),
                completedAt,
                finalizedAt: completedAt,
              },
            });
            providerSucceeded = true;
            return result;
          } catch (error) {
            const completedAt = new Date();
            // Failed provider calls can be billable. Without returned units the
            // correct state is UNKNOWN rather than an invented zero-dollar cost.
            await this.prisma.providerUsageAttempt.update({
              where: { id: attempt.id },
              data: {
                status: 'FAILED', costStatus: 'UNKNOWN', errorCode: errorCode(error),
                latencyMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
                completedAt, finalizedAt: completedAt,
              },
            }).catch(() => this.logger.error('Failed provider-attempt persistence.'));
            // An ErrorEvent is immutable diagnostic evidence, separate from
            // the billing attempt. It receives only server-derived operation
            // identifiers and redacts the provider error before persistence.
            void this.errorEvents.ingest({
              source: 'provider', severity: 'high', errorCode: errorCode(error),
              errorType: error instanceof Error ? error.name : 'ProviderError',
              message: error instanceof Error ? error.message : 'Provider call failed.',
              feature: input.feature, provider, model, retryAttempt: attemptNumber,
              latencyMs: Math.max(0, completedAt.getTime() - startedAt.getTime()),
              providerUsageAttemptId: attempt.id,
            }, { operationId: opened!.id, trustedOperationId: true }).catch(() => undefined);
            throw error;
          }
        },
      };

      const result = await operation(runner);
      const completedAt = new Date();
      await this.prisma.providerUsageOperation.update({
        where: { id: opened.id }, data: { status: 'SUCCEEDED', completedAt },
      });
      await this.updateLegacy(opened.legacyUsageId, opened.id, 'succeeded', completedAt);

      // Provider success happens outside PostgreSQL. If quota finalization ever
      // fails, retain the reservation and a reconcilable pending state; release
      // would create free provider work and invite a duplicate retry.
      if (opened.reservationId && opened.reservationStatus === 'RESERVED') {
        try {
          await this.quotas.finalize(opened.reservationId, input.units);
        } catch (error) {
          await this.prisma.providerUsageOperation.update({
            where: { id: opened.id },
            data: { status: 'FINALIZATION_PENDING', completedAt: new Date() },
          }).catch(() => undefined);
          this.logger.error('Quota finalization pending.');
        }
      }
      return result;
    } catch (error) {
      if (opened) {
        const completedAt = new Date();
        if (providerSucceeded) {
          await this.prisma.providerUsageOperation.update({
            where: { id: opened.id }, data: { status: 'FINALIZATION_PENDING', completedAt },
          }).catch(() => undefined);
        } else {
          await this.prisma.providerUsageOperation.update({
            where: { id: opened.id }, data: { status: 'FAILED', completedAt },
          }).catch(() => undefined);
          await this.updateLegacy(opened.legacyUsageId, opened.id, 'failed', completedAt);
          if (opened.reservationId && opened.reservationStatus === 'RESERVED') {
            await this.quotas.release(opened.reservationId, 'provider_failure').catch(() => {
              this.logger.error('Failed provider reservation release.');
            });
          }
        }
      } else if (this.isQuotaBlocked(error)) {
        // BLOCKED is the expected terminal state of PRIMARY → FALLBACK →
        // BLOCKED. It remains in the immutable provider-operation ledger but
        // is not an ErrorEvent or BugGroup. Only evidence of an actual provider
        // call after this guard would be a diagnostic anomaly.
        await this.recordBlocked(input, operationId).catch(() => undefined);
      }
      throw error;
    }
  }

  private async open(input: ProviderMeteringInput, operationId: string): Promise<OpenOperation> {
    const current = this.context.current();
    if (!current) throw new ConflictException({ code: 'PROVIDER_OPERATION_CONTEXT_MISSING' });

    let reservation: { id: string; status: string; primaryUnits: number; fallbackUnits: number } | null = null;
    let subscription: { id: string; planId: string; planVersion?: number | null } | null = null;
    let plan: { slug: string; configurationVersion: number } | null = null;
    if (current.userId) {
      const remembered = this.context.reservationFor(input.resource);
      reservation = remembered
        ? await this.prisma.quotaReservation.findUniqueOrThrow({ where: { id: remembered } })
        : await this.quotas.reserve({
            userId: current.userId, resource: input.resource, feature: input.feature,
            units: input.units, idempotencyKey: operationId,
          });
      subscription = await this.subscriptions.resolveForUser(current.userId);
      plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: subscription.planId } });
    }
    const quotaState: QuotaState | null = reservation
      ? reservation.primaryUnits > 0 ? 'PRIMARY' : reservation.fallbackUnits > 0 ? 'FALLBACK' : null
      : null;
    let record: { id: string };
    try {
      record = await this.prisma.providerUsageOperation.create({
        data: {
          idempotencyKey: operationId,
          requestId: current.requestId,
          userId: current.userId ?? null,
          subscriptionId: subscription?.id ?? null,
          planSlug: plan?.slug ?? null,
          planVersion: subscription?.planVersion ?? plan?.configurationVersion ?? null,
          feature: input.feature,
          resource: input.resource,
          quotaReservationId: reservation?.id ?? null,
          quotaState,
          unattributedReason: current.userId ? null : 'MISSING_AUTHENTICATED_PRINCIPAL',
          metadata: safeMetadata(input.metadata),
        },
        select: { id: true },
      });
    } catch (error) {
      if (!isUniqueViolation(error)) {
        if (reservation?.status === 'RESERVED') {
          await this.quotas.release(reservation.id, 'provider_ledger_open_failure').catch(() => undefined);
        }
        throw error;
      }
      const existing = await this.prisma.providerUsageOperation.findUniqueOrThrow({
        where: { idempotencyKey: operationId }, select: { status: true },
      });
      throw new ConflictException({
        code: existing.status === 'STARTED' ? 'PROVIDER_OPERATION_IN_PROGRESS' : 'PROVIDER_OPERATION_ALREADY_RECORDED',
      });
    }

    let legacyUsageId: string | null = null;
    if (current.userId && reservation && subscription && plan) {
      // Legacy ProviderUsage is a compatibility projection only. Failure to
      // write it must not cause a durable Sprint-4 operation to release quota
      // before the provider call, nor hide the new immutable ledger.
      try {
        const existing = await this.prisma.providerUsage.findUnique({
          where: { reservationId: reservation.id }, select: { id: true },
        });
        if (existing) legacyUsageId = existing.id;
        else {
          const legacy = await this.prisma.providerUsage.upsert({
            where: { internalOperationId: operationId },
            create: {
              userId: current.userId, subscriptionId: subscription.id, planSlug: plan.slug,
              planVersion: subscription.planVersion ?? plan.configurationVersion,
              feature: input.feature, resource: input.resource, provider: input.provider,
              model: input.model ?? null, requestId: current.requestId,
              internalOperationId: operationId, status: 'started', reservationId: reservation.id,
              metadata: safeMetadata(input.metadata),
            }, update: {}, select: { id: true },
          });
          legacyUsageId = legacy.id;
        }
      } catch (error) {
        this.logger.error('Legacy provider envelope creation failed.');
      }
    }
    return { id: record.id, reservationId: reservation?.id ?? null, reservationStatus: reservation?.status ?? null, legacyUsageId };
  }

  private async updateLegacy(
    legacyUsageId: string | null, operationId: string, status: 'succeeded' | 'failed', completedAt: Date,
  ): Promise<void> {
    if (!legacyUsageId) return;
    const attempts = await this.prisma.providerUsageAttempt.findMany({
      where: { operationId, status: 'SUCCEEDED' },
      select: {
        inputTokens: true, cachedInputTokens: true, outputTokens: true,
        audioInputSeconds: true, audioOutputSeconds: true, ocrPages: true,
        searchUnits: true, latencyMs: true, model: true,
      },
    });
    const sum = (field: 'inputTokens' | 'cachedInputTokens' | 'outputTokens' | 'audioInputSeconds' | 'audioOutputSeconds' | 'ocrPages' | 'searchUnits' | 'latencyMs') =>
      attempts.reduce((total, row) => total + (row[field] ?? 0), 0);
    const last = attempts.at(-1);
    await this.prisma.providerUsage.update({
      where: { id: legacyUsageId },
      data: {
        status, completedAt, model: last?.model ?? undefined,
        inputTokens: attempts.length ? sum('inputTokens') : null,
        cachedTokens: attempts.length ? sum('cachedInputTokens') : null,
        outputTokens: attempts.length ? sum('outputTokens') : null,
        audioInputSeconds: attempts.length ? sum('audioInputSeconds') : null,
        audioOutputSeconds: attempts.length ? sum('audioOutputSeconds') : null,
        pages: attempts.length ? sum('ocrPages') : null,
        searchCount: attempts.length ? sum('searchUnits') : null,
        latencyMs: attempts.length ? sum('latencyMs') : null,
      },
    }).catch(() => this.logger.error('Legacy provider envelope projection failed.'));
  }

  private normalizeMeasurement(
    raw: ProviderUsageMeasurement, fallbackModel: string | null,
  ): Required<Pick<ProviderUsageMeasurement, 'measurementSource'>> & ProviderUsageMeasurement {
    const measurement: Required<Pick<ProviderUsageMeasurement, 'measurementSource'>> & ProviderUsageMeasurement = {
      measurementSource: raw.measurementSource === 'OBSERVED' ? 'OBSERVED' : 'PROVIDER',
      model: cleanIdentifier(raw.model) ?? fallbackModel,
      providerRequestId: cleanIdentifier(raw.providerRequestId),
      unpricedUsageReason: cleanIdentifier(raw.unpricedUsageReason),
      metadata: raw.metadata,
    };
    for (const field of UNIT_FIELDS) {
      const value = raw[field];
      if (value === undefined || value === null) continue;
      if (Number.isSafeInteger(value) && value >= 0) measurement[field] = value;
      else measurement.metadata = { ...(measurement.metadata ?? {}), [`invalid_${field}`]: String(value).slice(0, 80) };
    }
    return measurement;
  }

  private async calculateCost(
    provider: string,
    measurement: Required<Pick<ProviderUsageMeasurement, 'measurementSource'>> & ProviderUsageMeasurement,
    at: Date,
  ): Promise<CostCalculation> {
    const priced = await this.pricedUnits(provider, measurement, at);
    if (measurement.unpricedUsageReason) {
      return {
        costStatus: 'UNKNOWN', originalAmount: null,
        originalCurrency: priced.pricing?.currency ?? null,
        referenceAmountUsd: null, pricingVersionId: priced.pricing?.id ?? null,
        pricingVersion: priced.pricing?.version ?? null,
        pricingSnapshot: {
          ...priced.snapshot,
          measurementConstraint: measurement.unpricedUsageReason,
        },
      };
    }
    if (priced.units.length === 0) {
      return { costStatus: 'NOT_INSTRUMENTED', originalAmount: null, originalCurrency: null, referenceAmountUsd: null, pricingVersionId: priced.pricing?.id ?? null, pricingVersion: priced.pricing?.version ?? null, pricingSnapshot: priced.snapshot };
    }
    if (!priced.pricing || priced.missing.length) {
      return {
        costStatus: 'UNKNOWN', originalAmount: null, originalCurrency: priced.pricing?.currency ?? null,
        referenceAmountUsd: null, pricingVersionId: priced.pricing?.id ?? null, pricingVersion: priced.pricing?.version ?? null,
        pricingSnapshot: { ...priced.snapshot, missingRates: priced.missing },
      };
    }
    const originalAmount = priced.units.reduce(
      (total, item) => total.plus((item.price as Prisma.Decimal).mul(item.units)), new Prisma.Decimal(0),
    );
    const currency = priced.pricing.currency.toUpperCase();
    if (currency !== 'USD') {
      return {
        costStatus: 'UNKNOWN', originalAmount, originalCurrency: currency, referenceAmountUsd: null,
        pricingVersionId: priced.pricing.id, pricingVersion: priced.pricing.version,
        pricingSnapshot: { ...priced.snapshot, currencyConversion: 'CURRENCY_CONVERSION_NOT_AVAILABLE' },
      };
    }
    return {
      costStatus: measurement.measurementSource === 'OBSERVED' ? 'ESTIMATED' : 'MEASURED',
      originalAmount, originalCurrency: currency, referenceAmountUsd: originalAmount,
      pricingVersionId: priced.pricing.id, pricingVersion: priced.pricing.version, pricingSnapshot: priced.snapshot,
    };
  }

  private async pricedUnits(provider: string, measurement: ProviderUsageMeasurement, at: Date) {
    const pricing = await this.findPricing(provider, measurement.model ?? null, at);
    const rates: Partial<Record<(typeof UNIT_FIELDS)[number], Prisma.Decimal | null>> = pricing ? {
      inputTokens: pricing.inputTokenPrice, cachedInputTokens: pricing.cachedInputTokenPrice,
      outputTokens: pricing.outputTokenPrice, reasoningTokens: pricing.reasoningTokenPrice,
      audioInputSeconds: pricing.audioInputSecondPrice, audioOutputSeconds: pricing.audioOutputSecondPrice,
      ocrPages: pricing.ocrPagePrice, visionCalls: pricing.visionCallPrice,
      embeddingUnits: pricing.embeddingUnitPrice, searchUnits: pricing.searchUnitPrice,
      otherUnits: pricing.otherUnitPrice,
    } : {};
    const units = UNIT_FIELDS.flatMap((name) => {
      const amount = measurement[name];
      return typeof amount === 'number' ? [{ name, units: amount, price: rates[name] ?? null }] : [];
    });
    const missing = units.filter((item) => item.price === null).map((item) => item.name);
    const snapshot: Record<string, Prisma.InputJsonValue> = {
      provider, model: measurement.model ?? 'MODEL_NOT_REPORTED', pricingVersionId: pricing?.id ?? 'NO_APPLICABLE_PRICING',
      pricingVersion: pricing?.version ?? 'NO_APPLICABLE_PRICING', currency: pricing?.currency ?? 'CURRENCY_NOT_REPORTED',
      sourceReference: pricing?.sourceReference ?? 'SOURCE_NOT_REPORTED',
      rates: pricing ? Object.fromEntries(Object.entries(rates).map(([key, value]) => [key, decimalSnapshot(value) ?? 'RATE_NOT_SET'])) : 'NO_APPLICABLE_PRICING',
    };
    return { pricing, units, missing, snapshot };
  }

  private async findPricing(provider: string, model: string | null, at: Date) {
    const models = [...new Set([model, '*'].filter((value): value is string => Boolean(value)))];
    for (const candidate of models) {
      const pricing = await this.prisma.providerPricingVersion.findFirst({
        where: { provider, model: candidate, status: 'ACTIVE', effectiveFrom: { lte: at }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: at } }] },
        orderBy: { effectiveFrom: 'desc' },
      });
      if (pricing) return pricing;
    }
    return null;
  }

  private async recordBlocked(input: ProviderMeteringInput, operationId: string): Promise<void> {
    const current = this.context.current();
    if (!current?.userId) return;
    await this.prisma.providerUsageOperation.create({
      data: {
        idempotencyKey: operationId, requestId: current.requestId, userId: current.userId,
        feature: input.feature, resource: input.resource, quotaState: 'BLOCKED', status: 'BLOCKED',
        metadata: safeMetadata(input.metadata), completedAt: new Date(),
      },
    });
  }

  private hasSprint4Ledger(): boolean {
    const client = this.prisma as unknown as Record<string, unknown>;
    return Boolean(client.providerUsageOperation && client.providerUsageAttempt && client.providerPricingVersion);
  }

  /** Narrow backwards compatibility for old unit-test doubles only. */
  private async executeLegacy<T>(
    input: ProviderMeteringInput, operation: (runner: ProviderAttemptRunner) => Promise<T>,
  ): Promise<T> {
    const current = this.context.current();
    const operationId = input.operationId ?? this.context.nextOperationId(input.provider, input.resource);
    if (!current?.userId || !operationId) return operation({ attempt: (call) => call() });
    const remembered = this.context.reservationFor(input.resource);
    const reservation = remembered
      ? await this.prisma.quotaReservation.findUniqueOrThrow({ where: { id: remembered } })
      : await this.quotas.reserve({ userId: current.userId, resource: input.resource, feature: input.feature, units: input.units, idempotencyKey: operationId });
    const sub = await this.subscriptions.resolveForUser(current.userId);
    const plan = await this.prisma.plan.findUniqueOrThrow({ where: { id: sub.planId } });
    const startedAt = Date.now();
    const usage = await this.prisma.providerUsage.upsert({
      where: { internalOperationId: operationId },
      create: {
        userId: current.userId, subscriptionId: sub.id, planSlug: plan.slug,
        planVersion: sub.planVersion ?? plan.configurationVersion, feature: input.feature, resource: input.resource,
        provider: input.provider, model: input.model ?? null, requestId: current.requestId,
        internalOperationId: operationId, status: 'started', reservationId: reservation.id,
        metadata: safeMetadata(input.metadata),
      }, update: {},
    });
    try {
      const result = await operation({ attempt: (call) => call() });
      const measured = result as LLMGenerateResult;
      await this.prisma.providerUsage.update({
        where: { id: usage.id },
        data: {
          status: 'succeeded', completedAt: new Date(), latencyMs: Date.now() - startedAt,
          model: measured?.model ?? input.model ?? null, inputTokens: measured?.usage?.inputTokens,
          outputTokens: measured?.usage?.outputTokens, cachedTokens: measured?.usage?.cachedTokens,
        },
      });
      if (reservation.status === 'RESERVED') await this.quotas.finalize(reservation.id, input.units);
      return result;
    } catch (error) {
      await this.prisma.providerUsage.update({ where: { id: usage.id }, data: { status: 'failed', completedAt: new Date(), latencyMs: Date.now() - startedAt } }).catch(() => undefined);
      await this.quotas.release(reservation.id, 'provider_failure').catch(() => undefined);
      throw error;
    }
  }

  private isQuotaBlocked(error: unknown): boolean {
    const candidate = error as { getResponse?: () => unknown; response?: unknown };
    const response = candidate?.getResponse?.() ?? candidate?.response;
    return Boolean(response && typeof response === 'object' && (response as { code?: string }).code === 'QUOTA_EXHAUSTED');
  }
}

function safeMetadata(input: SafeMetadata | undefined): Prisma.InputJsonValue | undefined {
  if (!input) return undefined;
  const output: Record<string, Primitive> = {};
  for (const [key, value] of Object.entries(input)) {
    if (SENSITIVE_METADATA.test(key) || value === undefined) continue;
    if (typeof value === 'string') output[key] = value.slice(0, 160);
    else if (typeof value === 'number' && Number.isFinite(value)) output[key] = value;
    else if (typeof value === 'boolean' || value === null) output[key] = value;
  }
  return Object.keys(output).length ? output : undefined;
}

/** JSON pricing snapshots must be canonical decimal text: Decimal#toString can
 * use scientific notation, which makes an immutable provider price harder to
 * compare and audit even when its numeric value is correct. */
function decimalSnapshot(value: Prisma.Decimal | null | undefined): string | null {
  if (!value) return null;
  const fixed = value.toFixed(12);
  return fixed.includes('.') ? fixed.replace(/0+$/, '').replace(/\.$/, '') || '0' : fixed;
}

function cleanIdentifier(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = value.trim().slice(0, 180);
  return cleaned || null;
}

function errorCode(error: unknown): string {
  const candidate = error as { code?: unknown; name?: unknown; status?: unknown; statusCode?: unknown };
  const value = candidate?.code ?? candidate?.status ?? candidate?.statusCode ?? candidate?.name ?? 'PROVIDER_ERROR';
  return String(value).replace(/[^A-Za-z0-9_.:-]/g, '_').slice(0, 120) || 'PROVIDER_ERROR';
}

function isUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002';
}
