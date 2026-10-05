import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type QuotaState } from '@prisma/client';
import { FeatureFlagsService } from '../../config/feature-flags.service';
import { PrismaService } from '../../prisma/prisma.service';
import {
  AdminAuditService,
  containsSensitiveAdministrativeText,
  type AuditContext,
} from '../admin-audit.service';
import type { AdminIdentity } from '../admin-rbac';
import type {
  CommercialAuditQueryDto,
  CommercialSubscriptionQueryDto,
  CommercialUsageQueryDto,
  UpdatePlanPricingDto,
} from '../dto/commercial-control.dto';

const PUBLIC_PLAN_SLUGS = ['free', 'pro', 'pro_max'] as const;
const QUOTA_STATE_PRIORITY: Record<QuotaState, number> = {
  PRIMARY: 0,
  FALLBACK: 1,
  BLOCKED: 2,
};
const SAFE_PRICING_AUDIT_FIELDS = new Set([
  'priceMonthly',
  'priceYearly',
  'currency',
  'configurationVersion',
  'fallbackRatio',
]);

type PublicPlanSlug = (typeof PUBLIC_PLAN_SLUGS)[number];
type JsonRecord = Record<string, unknown>;

/**
 * A narrow administrative read/write facade for commercial state.  It consumes
 * the existing catalog, quota, billing and provider-ledger tables directly; it
 * never substitutes a dashboard cache for those sources of truth.
 */
@Injectable()
export class CommercialControlService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly featureFlags: FeatureFlagsService,
  ) {}

  async overview() {
    const plans = await this.catalogPlans();
    return {
      activePricing: plans.map((plan) => this.pricingSummary(plan)),
      quotaPolicy: {
        requestFlow: [
          'REQUEST',
          'ENTITLEMENT',
          'QUOTA_CHECK',
          'ATOMIC_RESERVATION',
          'SERVICE_OR_PROVIDER',
          'DURABLE_USAGE',
        ],
        stateFlow: ['PRIMARY', 'FALLBACK', 'BLOCKED'],
        paidFallback: '50_PERCENT_OF_CORRESPONDING_FREE_LIMIT',
        fallbackCarryOver: 'FORBIDDEN',
        overage: 'OFF',
        negativeQuota: 'FORBIDDEN',
        automaticReset: 'ON',
        hardStop: 'ON',
      },
      billing: {
        paidActivation: 'VERIFIED_PROVIDER_EVENT_ONLY',
        externalPriceCatalog: 'NOT_CONFIGURED',
        revenueMetrics: 'NOT_AVAILABLE_UNLESS_DURABLE_PAYMENT_ROWS_EXIST',
      },
      capabilities: {
        pricingMutation: 'PLANS_MANAGE_AND_PROVIDER_PRICING_MANAGE_WITH_STEP_UP',
        subscriptions: 'EXISTING_SUBSCRIPTION_WORKFLOW',
        featureControl: 'READ_ONLY_ENVIRONMENT_OWNED',
        settings: 'ALLOWLISTED_AUTHORITIES_ONLY',
      },
    };
  }

  async plans() {
    const plans = await this.catalogPlans();
    const free = plans.find((plan) => plan.slug === 'free') ?? null;
    return {
      items: plans.map((plan) => this.planView(plan, free)),
      quotaPolicyStatus: 'BUSINESS_DECISION_REQUIRED',
      quotaPolicyReason: 'Existing configured quota values remain authoritative; final paid quota policy values were not decided in Sprint 7.',
    };
  }

  async subscriptions(identity: AdminIdentity, query: CommercialSubscriptionQueryDto) {
    const page = query.page;
    const pageSize = query.pageSize;
    const where: Prisma.SubscriptionWhereInput = query.plan
      ? { plan: { slug: query.plan } }
      : { plan: { slug: { in: [...PUBLIC_PLAN_SLUGS] } } };
    const now = new Date();
    const [rows, total] = await Promise.all([
      this.prisma.subscription.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          status: true,
          interval: true,
          provider: true,
          providerSubscriptionId: true,
          currentPeriodStart: true,
          currentPeriodEnd: true,
          cancelAtPeriodEnd: true,
          trialEndsAt: true,
          planVersion: true,
          user: { select: { id: true, email: true } },
          plan: { select: { slug: true, name: true } },
          userId: true,
        },
      }),
      this.prisma.subscription.count({ where }),
    ]);
    const cycles = rows.length === 0 ? [] : await this.prisma.quotaCycle.findMany({
      where: {
        userId: { in: rows.map((row) => row.userId) },
        status: 'ACTIVE',
        startsAt: { lte: now },
        endsAt: { gt: now },
      },
      select: {
        userId: true,
        startsAt: true,
        endsAt: true,
        accounts: { select: { state: true, primaryLimit: true, primaryUsed: true, fallbackLimit: true, fallbackUsed: true } },
      },
    });
    const cycleByUser = new Map(cycles.map((cycle) => [cycle.userId, cycle]));
    const mayReadUsers = identity.capabilities.includes('users.read');
    return {
      items: rows.map((row) => {
        const cycle = cycleByUser.get(row.userId);
        const cycleEnd = iso(cycle?.endsAt);
        return {
          id: row.id,
          user: mayReadUsers
            ? { id: row.user.id, email: row.user.email }
            : { id: maskId(row.user.id), email: 'REDACTED' },
          plan: { slug: row.plan.slug, name: row.plan.name, version: row.planVersion },
          status: String(row.status).toUpperCase(),
          interval: row.interval ?? 'NOT_AVAILABLE',
          cycleStart: iso(row.currentPeriodStart),
          cycleEnd: iso(row.currentPeriodEnd),
          nextRenewal: row.status === 'active' && row.currentPeriodEnd ? iso(row.currentPeriodEnd) : null,
          cancellationScheduled: row.cancelAtPeriodEnd,
          expiration: ['expired', 'canceled'].includes(String(row.status)) ? iso(row.currentPeriodEnd) : null,
          trialEndsAt: iso(row.trialEndsAt),
          provider: row.provider ?? 'NOT_CONFIGURED',
          providerReference: row.providerSubscriptionId ? 'PRESENT_REDACTED' : null,
          entitlementState: entitlementState(row.status),
          quotaState: quotaState(cycle?.accounts ?? []),
          quotaCycle: cycle
            ? { startsAt: iso(cycle.startsAt), endsAt: cycleEnd }
            : { status: 'NOT_AVAILABLE' },
        };
      }),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async payments(identity: AdminIdentity, query: CommercialSubscriptionQueryDto) {
    const page = query.page;
    const pageSize = query.pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.payment.findMany({
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          provider: true,
          providerRef: true,
          amount: true,
          currency: true,
          status: true,
          purpose: true,
          createdAt: true,
          user: { select: { id: true, email: true } },
        },
      }),
      this.prisma.payment.count(),
    ]);
    const mayReadUsers = identity.capabilities.includes('users.read');
    return {
      items: rows.map((row) => ({
        id: row.id,
        user: mayReadUsers
          ? { id: row.user.id, email: row.user.email }
          : { id: maskId(row.user.id), email: 'REDACTED' },
        provider: row.provider,
        providerReference: row.providerRef ? 'PRESENT_REDACTED' : null,
        amountMinor: row.amount,
        currency: row.currency.toUpperCase(),
        status: String(row.status).toUpperCase(),
        purpose: row.purpose,
        // A Payment row does not carry an immutable plan snapshot. The user's
        // current subscription could have changed after the payment, so it is
        // deliberately not presented as historical payment evidence.
        plan: 'NOT_AVAILABLE',
        planStatus: 'NOT_RECORDED_ON_PAYMENT',
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      revenueMetrics: 'NOT_AVAILABLE',
      revenueMetricsReason: 'MRR, ARR and ARPU are not produced without a verified accounting calculation.',
    };
  }

  async usage(identity: AdminIdentity, query: CommercialUsageQueryDto) {
    if (query.userId && !identity.capabilities.includes('users.read')) {
      throw new ForbiddenException({ code: 'COMMERCIAL_USAGE_USER_FILTER_DENIED' });
    }
    const range = this.range(query.range);
    const operation: Prisma.ProviderUsageOperationWhereInput = {
      ...(query.plan ? { planSlug: query.plan } : {}),
      ...(query.feature ? { feature: query.feature } : {}),
      ...(query.userId ? { userId: query.userId } : {}),
    };
    const where: Prisma.ProviderUsageAttemptWhereInput = {
      startedAt: { gte: range.from, lt: range.to },
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.model ? { model: query.model } : {}),
      operation: { is: operation },
    };
    const page = query.page;
    const pageSize = query.pageSize;
    const [rows, total] = await Promise.all([
      this.prisma.providerUsageAttempt.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { startedAt: 'desc' },
        select: {
          provider: true,
          model: true,
          status: true,
          costStatus: true,
          inputTokens: true,
          cachedInputTokens: true,
          outputTokens: true,
          reasoningTokens: true,
          audioInputSeconds: true,
          audioOutputSeconds: true,
          ocrPages: true,
          visionCalls: true,
          embeddingUnits: true,
          searchUnits: true,
          otherUnits: true,
          referenceAmountUsd: true,
          startedAt: true,
          completedAt: true,
          operation: { select: { userId: true, planSlug: true, feature: true, resource: true, quotaState: true } },
        },
      }),
      this.prisma.providerUsageAttempt.count({ where }),
    ]);
    const mayReadUsers = identity.capabilities.includes('users.read');
    return {
      range: { key: query.range, from: range.from.toISOString(), to: range.to.toISOString() },
      items: rows.map((row) => ({
        user: row.operation.userId
          ? (mayReadUsers ? { id: row.operation.userId } : { id: maskId(row.operation.userId) })
          : { id: 'UNATTRIBUTED' },
        plan: row.operation.planSlug ?? 'UNATTRIBUTED',
        feature: row.operation.feature,
        resource: row.operation.resource ?? 'NOT_INSTRUMENTED',
        quotaState: row.operation.quotaState ?? 'NOT_AVAILABLE',
        provider: row.provider,
        model: row.model ?? 'MODEL_NOT_REPORTED',
        status: String(row.status),
        costStatus: String(row.costStatus),
        units: {
          inputTokens: row.inputTokens,
          cachedInputTokens: row.cachedInputTokens,
          outputTokens: row.outputTokens,
          reasoningTokens: row.reasoningTokens,
          audioInputSeconds: row.audioInputSeconds,
          audioOutputSeconds: row.audioOutputSeconds,
          ocrPages: row.ocrPages,
          visionCalls: row.visionCalls,
          embeddingUnits: row.embeddingUnits,
          searchUnits: row.searchUnits,
          otherUnits: row.otherUnits,
        },
        costUsd: row.referenceAmountUsd?.toString() ?? null,
        startedAt: row.startedAt.toISOString(),
        completedAt: iso(row.completedAt),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      dataStatus: rows.length ? 'AVAILABLE' : 'INSUFFICIENT_DATA',
      costAuthority: 'COST_CENTER',
    };
  }

  features() {
    const flags = this.featureFlags.all();
    return {
      items: Object.entries(flags).map(([key, enabled]) => ({
        key,
        enabled: enabled === true,
        source: 'ENVIRONMENT_CONFIGURATION',
        targeting: {
          allUsers: 'ENVIRONMENT_GLOBAL',
          betaTesters: 'NOT_SUPPORTED',
          free: 'NOT_SUPPORTED',
          pro: 'NOT_SUPPORTED',
          proMax: 'NOT_SUPPORTED',
          country: 'NOT_SUPPORTED',
          specificUser: 'NOT_SUPPORTED',
        },
        mutation: 'NOT_SUPPORTED',
      })),
      safety: 'Feature Control is read-only because runtime flags are environment-owned. No secret value is returned.',
    };
  }

  settings() {
    return {
      items: [
        {
          key: 'PLAN_PRICING',
          authority: 'VERSIONED_ADMIN_WORKFLOW',
          mutation: 'AVAILABLE_WITH_RBAC_STEP_UP_AUDIT',
          secrets: 'NOT_EXPOSED',
        },
        {
          key: 'QUOTA_ENGINE',
          authority: 'QUOTA_SERVICE',
          mutation: 'NOT_SUPPORTED_FROM_SETTINGS',
          secrets: 'NOT_EXPOSED',
        },
        {
          key: 'FEATURE_FLAGS',
          authority: 'ENVIRONMENT_CONFIGURATION',
          mutation: 'NOT_SUPPORTED_FROM_SETTINGS',
          secrets: 'NOT_EXPOSED',
        },
        {
          key: 'RUNTIME_SECRETS',
          authority: 'SERVER_ONLY',
          mutation: 'NOT_SUPPORTED',
          secrets: 'NOT_EXPOSED',
        },
      ],
    };
  }

  async auditLog(query: CommercialAuditQueryDto) {
    const page = query.page;
    const pageSize = query.pageSize;
    const commercialActions: Prisma.AuditLogWhereInput = {
      OR: [
        { action: { startsWith: 'plan.' } },
        { action: { startsWith: 'commercial.' } },
        { action: { startsWith: 'subscription.' } },
        { action: { startsWith: 'quota.' } },
        { action: { startsWith: 'feature.' } },
        { action: { startsWith: 'settings.' } },
      ],
      ...(query.action ? { action: { startsWith: query.action } } : {}),
    };
    const [rows, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: commercialActions,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          actorId: true,
          actorRole: true,
          action: true,
          targetType: true,
          targetId: true,
          before: true,
          after: true,
          reason: true,
          result: true,
          requestId: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.count({ where: commercialActions }),
    ]);
    return {
      items: rows.map((row) => ({
        actor: row.actorId ? maskId(row.actorId) : 'SYSTEM',
        actorRole: row.actorRole ?? 'SYSTEM',
        action: row.action,
        target: { type: row.targetType ?? 'NOT_AVAILABLE', id: row.targetId ? maskId(row.targetId) : null },
        before: safePricingAuditValue(row.before),
        after: safePricingAuditValue(row.after),
        reason: safeAuditText(row.reason),
        result: row.result,
        correlation: row.requestId ? 'PRESENT_REDACTED' : null,
        createdAt: row.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updatePricing(
    slug: string,
    input: UpdatePlanPricingDto,
    context: AuditContext,
  ) {
    if (!isPublicPlanSlug(slug)) {
      throw new NotFoundException({ code: 'COMMERCIAL_PLAN_NOT_FOUND' });
    }
    if (slug === 'free' && (input.priceMonthly !== 0 || input.priceYearly !== 0)) {
      throw new BadRequestException({ code: 'COMMERCIAL_FREE_PRICE_MUST_REMAIN_ZERO' });
    }
    if (containsSensitiveAdministrativeText(input.reason)) {
      throw new BadRequestException({ code: 'COMMERCIAL_REASON_CONTAINS_SENSITIVE_DATA' });
    }
    return this.prisma.$transaction(async (tx) => {
      const plan = await tx.plan.findUnique({ where: { slug } });
      if (!plan || !plan.publicV1 || !plan.isActive) {
        throw new NotFoundException({ code: 'COMMERCIAL_PLAN_NOT_FOUND' });
      }
      if (plan.configurationVersion !== input.expectedVersion) {
        throw new ConflictException({
          code: 'COMMERCIAL_PLAN_VERSION_CONFLICT',
          currentVersion: plan.configurationVersion,
        });
      }
      if (plan.priceMonthly === input.priceMonthly && plan.priceYearly === input.priceYearly) {
        throw new BadRequestException({ code: 'COMMERCIAL_PRICING_UNCHANGED' });
      }
      const now = new Date();
      const before = pricingSnapshot(plan);
      const nextVersion = plan.configurationVersion + 1;
      await tx.planVersion.updateMany({
        where: { planId: plan.id, effectiveTo: null },
        data: { effectiveTo: now },
      });
      await tx.planVersion.create({
        data: {
          planId: plan.id,
          version: nextVersion,
          priceMonthly: input.priceMonthly,
          priceYearly: input.priceYearly,
          currency: plan.currency,
          quotas: inputJson(plan.quotas),
          features: inputJson(plan.features),
          fallbackRatio: plan.fallbackRatio,
          effectiveFrom: now,
          publishedAt: now,
          createdById: context.actorId ?? null,
          reason: input.reason,
        },
      });
      const updated = await tx.plan.update({
        where: { id: plan.id },
        data: {
          priceMonthly: input.priceMonthly,
          priceYearly: input.priceYearly,
          configurationVersion: nextVersion,
        },
      });
      await tx.auditLog.create({
        data: this.audit.auditData(context, {
          action: 'plan.pricing.update',
          targetType: 'Plan',
          targetId: updated.id,
          before,
          after: pricingSnapshot(updated),
          reason: input.reason,
          metadata: { source: 'COMMERCIAL_CONTROL_CENTER' },
        }),
      });
      return {
        changed: true,
        plan: this.pricingSummary(updated),
      };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async catalogPlans() {
    return this.prisma.plan.findMany({
      where: { slug: { in: [...PUBLIC_PLAN_SLUGS] } },
      orderBy: { tier: 'asc' },
      select: {
        id: true,
        slug: true,
        name: true,
        tier: true,
        audience: true,
        quotas: true,
        features: true,
        priceMonthly: true,
        priceYearly: true,
        currency: true,
        isActive: true,
        publicV1: true,
        fallbackRatio: true,
        configurationVersion: true,
        updatedAt: true,
      },
    });
  }

  private planView(
    plan: Awaited<ReturnType<CommercialControlService['catalogPlans']>>[number],
    free: Awaited<ReturnType<CommercialControlService['catalogPlans']>>[number] | null,
  ) {
    return {
      ...this.pricingSummary(plan),
      entitlements: booleanEntries(plan.features),
      quotas: quotaPolicies(plan, free),
      configuration: {
        version: plan.configurationVersion,
        updatedAt: plan.updatedAt.toISOString(),
        source: 'VERSIONED_PLAN_CATALOG',
      },
    };
  }

  private pricingSummary(plan: {
    id: string;
    slug: string;
    name: string;
    priceMonthly: number | null;
    priceYearly: number | null;
    currency: string;
    isActive: boolean;
    publicV1: boolean;
    fallbackRatio: number;
    configurationVersion: number;
  }) {
    return {
      id: plan.id,
      slug: plan.slug,
      name: plan.name,
      priceMonthly: plan.priceMonthly,
      priceYearly: plan.priceYearly,
      currency: plan.currency.toUpperCase(),
      status: plan.isActive ? 'ACTIVE' : 'INACTIVE',
      publicV1: plan.publicV1,
      fallbackRatio: plan.fallbackRatio,
      configurationVersion: plan.configurationVersion,
    };
  }

  private range(key: CommercialUsageQueryDto['range']) {
    const to = new Date();
    const from = new Date(to);
    if (key === 'today') from.setUTCHours(0, 0, 0, 0);
    else from.setUTCDate(from.getUTCDate() - (key === '7d' ? 7 : key === '30d' ? 30 : 90));
    return { from, to };
  }
}

function isPublicPlanSlug(value: string): value is PublicPlanSlug {
  return (PUBLIC_PLAN_SLUGS as readonly string[]).includes(value);
}

function jsonRecord(value: Prisma.JsonValue): JsonRecord {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as JsonRecord
    : {};
}

/** Preserve a JSON null in the immutable plan snapshot rather than converting
 * it into a database NULL or manufacturing an empty entitlement object. */
function inputJson(value: Prisma.JsonValue): Prisma.InputJsonValue | typeof Prisma.JsonNull {
  return value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue;
}

function numericQuota(value: unknown): number | null {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : null;
}

function quotaPolicies(
  plan: { slug: string; quotas: Prisma.JsonValue; fallbackRatio: number },
  free: { quotas: Prisma.JsonValue } | null,
) {
  const quotas = jsonRecord(plan.quotas);
  const freeQuotas = free ? jsonRecord(free.quotas) : {};
  const atomic = (resource: string, sourceKey: string, unit: string, convert = (value: number) => value) => {
    const configured = numericQuota(quotas[sourceKey]);
    const freeLimit = numericQuota(freeQuotas[sourceKey]);
    const paid = plan.slug !== 'free';
    return {
      resource,
      sourceKey,
      configuredLimit: configured === null ? null : convert(configured),
      unit,
      configurationStatus: configured === null ? 'NOT_CONFIGURED' : 'CONFIGURED',
      enforcement: 'ATOMIC_RESERVATION',
      fallback: paid && configured !== null && freeLimit !== null
        ? {
          stateFlow: ['PRIMARY', 'FALLBACK', 'BLOCKED'],
          ratio: plan.fallbackRatio,
          limit: Math.floor(convert(freeLimit) * plan.fallbackRatio),
          source: 'CORRESPONDING_FREE_LIMIT',
        }
        : { status: paid ? 'NOT_CONFIGURED' : 'NOT_APPLICABLE' },
    };
  };
  const gauge = (resource: string, sourceKey: string, unit: string) => {
    const configured = numericQuota(quotas[sourceKey]);
    return {
      resource,
      sourceKey,
      configuredLimit: configured,
      unit,
      configurationStatus: configured === null ? 'NOT_CONFIGURED' : 'CONFIGURED',
      enforcement: 'USAGE_GAUGE_ONLY',
      fallback: { status: 'NOT_SUPPORTED' },
    };
  };
  const notConfigured = (resource: string) => ({
    resource,
    sourceKey: null,
    configuredLimit: null,
    configurationStatus: 'NOT_CONFIGURED',
    enforcement: 'NOT_CONFIGURED',
    fallback: { status: 'NOT_CONFIGURED' },
  });
  return [
    atomic('AI_TEXT', 'ai_questions', 'request'),
    atomic('VOICE_SECONDS', 'voice_minutes', 'second', (value) => value * 60),
    gauge('DOCUMENTS', 'documents', 'document'),
    gauge('STORAGE', 'storage', 'byte'),
    notConfigured('DOCUMENT_PAGES'),
    notConfigured('OCR_PAGES'),
    notConfigured('EMBEDDING_UNITS'),
    notConfigured('WEB_SEARCH'),
    notConfigured('DEEP_RESEARCH'),
    notConfigured('ACADEMIC_AI'),
  ];
}

function booleanEntries(value: Prisma.JsonValue) {
  return Object.entries(jsonRecord(value))
    .filter(([, enabled]) => typeof enabled === 'boolean')
    .map(([key, enabled]) => ({ key, enabled }));
}

function pricingSnapshot(plan: {
  priceMonthly: number | null;
  priceYearly: number | null;
  currency: string;
  configurationVersion: number;
  fallbackRatio: number;
}) {
  return {
    priceMonthly: plan.priceMonthly,
    priceYearly: plan.priceYearly,
    currency: plan.currency.toUpperCase(),
    configurationVersion: plan.configurationVersion,
    fallbackRatio: plan.fallbackRatio,
  };
}

function entitlementState(status: unknown) {
  return ['active', 'trialing', 'free'].includes(String(status)) ? 'ACTIVE' : 'INACTIVE';
}

function quotaState(accounts: Array<{ state: QuotaState }>) {
  if (accounts.length === 0) return 'NOT_AVAILABLE';
  return accounts.reduce<QuotaState>((worst, account) =>
    QUOTA_STATE_PRIORITY[account.state] > QUOTA_STATE_PRIORITY[worst] ? account.state : worst,
  'PRIMARY');
}

function iso(value: Date | null | undefined) {
  return value ? value.toISOString() : null;
}

function maskId(value: string) {
  return value.length <= 8 ? 'REDACTED' : `${value.slice(0, 4)}…${value.slice(-4)}`;
}

function safePricingAuditValue(value: Prisma.JsonValue | null) {
  const record = value === null ? {} : jsonRecord(value);
  const safe = Object.fromEntries(
    Object.entries(record).filter(([key, entry]) =>
      SAFE_PRICING_AUDIT_FIELDS.has(key) && ['string', 'number', 'boolean'].includes(typeof entry),
    ),
  );
  return Object.keys(safe).length ? safe : 'REDACTED_OR_NOT_APPLICABLE';
}

function safeAuditText(value: string | null) {
  if (!value) return null;
  return containsSensitiveAdministrativeText(value) ? '[REDACTED]' : value.slice(0, 500);
}
