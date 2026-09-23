import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma, ProviderCostStatus, type ProviderPricingStatus } from '@prisma/client';
import { containsSensitiveAdministrativeText, AdminAuditService, type AuditContext } from '../admin-audit.service';
import { PrismaService } from '../../prisma/prisma.service';

const DAY_MS = 86_400_000;
const RANGE_KEYS = ['today', '7d', '30d', '90d', 'billing_month', 'custom'] as const;
const PERSISTED_COST_STATUSES = new Set<ProviderCostStatus>([
  'MEASURED', 'ESTIMATED', 'UNKNOWN', 'NOT_AVAILABLE', 'NOT_INSTRUMENTED',
]);
const OPERATION_SELECT = {
  id: true, requestId: true, userId: true, subscriptionId: true, planSlug: true,
  planVersion: true, feature: true, resource: true, quotaReservationId: true,
  quotaState: true, status: true, unattributedReason: true,
} as const;

type CostAttempt = Prisma.ProviderUsageAttemptGetPayload<{
  include: { operation: { select: typeof OPERATION_SELECT } };
}>;

type CostStatusFilter = ProviderCostStatus | null;
interface CostRange { key: string; from: Date; to: Date; }
interface CostFilters {
  range: CostRange;
  plan?: string;
  feature?: string;
  provider?: string;
  model?: string;
  costStatus: CostStatusFilter;
}

export interface CreatePricingInput {
  provider: string;
  model: string;
  version: string;
  currency: string;
  effectiveFrom: string;
  effectiveTo?: string;
  sourceReference?: string;
  reason: string;
  status?: ProviderPricingStatus;
  inputTokenPrice?: unknown;
  cachedInputTokenPrice?: unknown;
  outputTokenPrice?: unknown;
  reasoningTokenPrice?: unknown;
  audioInputSecondPrice?: unknown;
  audioOutputSecondPrice?: unknown;
  ocrPagePrice?: unknown;
  visionCallPrice?: unknown;
  embeddingUnitPrice?: unknown;
  searchUnitPrice?: unknown;
  otherUnitPrice?: unknown;
  otherUnitName?: string;
}

export interface CreateBudgetInput {
  scope: string;
  scopeKey?: string;
  monthlyAmountUsd: unknown;
  warningPercent?: unknown;
  criticalPercent?: unknown;
  reason: string;
}

/**
 * Read-only Cost Center aggregates are rebuilt directly from immutable attempt
 * rows. This avoids treating a dashboard cache or a nullable old field as the
 * source of truth, and keeps UNKNOWN / NOT_INSTRUMENTED visible end-to-end.
 */
@Injectable()
export class CostCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async overview(query: Record<string, unknown>) {
    const filters = this.filters(query);
    const attempts = await this.attempts(filters);
    const cost = this.summary(attempts);
    const unattributed = attempts.filter((attempt) => this.unattributed(attempt));
    const unattributedCost = this.summary(unattributed);
    const blocked = attempts.filter((attempt) => attempt.operation.quotaState === 'BLOCKED');
    const retries = this.retryOperationCount(attempts);
    const [budgets, blockedOperations] = await Promise.all([
      this.prisma.providerCostBudget.findMany({
        where: { active: true }, orderBy: { createdAt: 'desc' }, take: 100,
        select: { id: true, scope: true, scopeKey: true, monthlyAmountUsd: true, warningPercent: true, criticalPercent: true, currency: true },
      }),
      this.blockedOperations(filters),
    ]);
    return this.envelope(filters, {
      cost, dataStatus: summaryAvailability(cost),
      providerCalls: attempts.length,
      logicalRequests: new Set(attempts.map((attempt) => attempt.operationId)).size,
      unattributedProviderUsage: unattributed.length,
      unattributedCost: unattributedCost.knownUsd,
      unattributedCostStatus: unattributedCost.costStatus,
      unattributedCostSummary: unattributedCost,
      providerUsageAfterQuotaBlock: blocked.length,
      blockedProviderCalls: blocked.length,
      blockedOperations: blockedOperations.count,
      blockedOperationsStatus: blockedOperations.status,
      retryOperations: retries,
      budgets: budgets.length ? budgets.map((budget) => ({
        id: budget.id, scope: budget.scope, scopeKey: budget.scopeKey,
        monthlyAmountUsd: decimal(budget.monthlyAmountUsd), currency: budget.currency,
        warningPercent: budget.warningPercent, criticalPercent: budget.criticalPercent,
      })) : { status: 'NOT_INSTRUMENTED', reason: 'NO_BUDGET_CONFIGURED' },
      infrastructureCost: { status: 'NOT_INSTRUMENTED', reason: 'DEFERRED_TO_SPRINT_6' },
      emailCost: { status: 'NOT_INSTRUMENTED' },
      paymentFees: { status: 'NOT_AVAILABLE' },
    });
  }

  async plans(query: Record<string, unknown>) {
    const filters = this.filters(query);
    const attempts = await this.attempts(filters);
    const catalog = await this.prisma.plan.findMany({
      where: { slug: { in: ['free', 'pro', 'pro_max'] } },
      select: { slug: true, priceMonthly: true, priceYearly: true, currency: true },
    });
    const priceByPlan = new Map(catalog.map((plan) => [plan.slug, plan]));
    const grouped = new Map(this.group(attempts, (attempt) => attempt.operation.planSlug ?? 'UNATTRIBUTED'));
    const defaultPlans = filters.plan ? [filters.plan] : ['free', 'pro', 'pro_max'];
    const planKeys = [...defaultPlans, ...[...grouped.keys()].filter((plan) => !defaultPlans.includes(plan))];
    const rows = planKeys.map((plan) => {
      const items = grouped.get(plan) ?? [];
      const catalogPlan = priceByPlan.get(plan);
      const cost = this.summary(items);
      return {
        plan, activeUsers: new Set(items.map((item) => item.operation.userId).filter(Boolean)).size,
        providerCalls: items.length, logicalRequests: new Set(items.map((item) => item.operationId)).size,
        quotaStates: quotaStateCounts(items), cost, dataStatus: summaryAvailability(cost),
        // This is catalog information, not booked accounting revenue.
        catalogMonthlyPriceUsd: catalogPlan?.currency.toUpperCase() === 'USD' && catalogPlan.priceMonthly !== null
          ? (catalogPlan.priceMonthly / 100).toFixed(2) : null,
        catalogYearlyPriceUsd: catalogPlan?.currency.toUpperCase() === 'USD' && catalogPlan.priceYearly !== null
          ? (catalogPlan.priceYearly / 100).toFixed(2) : null,
        revenueStatus: catalogPlan ? 'CATALOG_ONLY_NOT_RECOGNIZED_REVENUE' : 'NOT_INSTRUMENTED',
      };
    });
    const cost = this.summary(attempts);
    return this.envelope(filters, { items: rows, cost, dataStatus: summaryAvailability(cost) });
  }

  async features(query: Record<string, unknown>) {
    return this.breakdown(query, (attempt) => attempt.operation.feature || 'FEATURE_NOT_REPORTED', (label, items) => ({
      feature: label, providerCalls: items.length, logicalRequests: new Set(items.map((item) => item.operationId)).size,
      quotaStates: quotaStateCounts(items), cost: this.summary(items),
    }));
  }

  async providers(query: Record<string, unknown>) {
    return this.breakdown(query, (attempt) => attempt.provider || 'PROVIDER_NOT_REPORTED', (label, items) => ({
      provider: label, providerCalls: items.length,
      success: items.filter((item) => item.status === 'SUCCEEDED').length,
      failures: items.filter((item) => item.status === 'FAILED').length,
      averageLatencyMs: average(items.map((item) => item.latencyMs)),
      retryOperations: this.retryOperationCount(items), cost: this.summary(items),
    }));
  }

  async models(query: Record<string, unknown>) {
    return this.breakdown(query, (attempt) => `${attempt.provider} / ${attempt.model ?? 'MODEL_NOT_REPORTED'}`, (label, items) => ({
      model: label, provider: items[0]?.provider ?? null, modelName: items[0]?.model ?? null,
      providerCalls: items.length, inputTokens: sumUnits(items, 'inputTokens'),
      cachedInputTokens: sumUnits(items, 'cachedInputTokens'), outputTokens: sumUnits(items, 'outputTokens'),
      reasoningTokens: sumUnits(items, 'reasoningTokens'), embeddingUnits: sumUnits(items, 'embeddingUnits'),
      searchUnits: sumUnits(items, 'searchUnits'), ocrPages: sumUnits(items, 'ocrPages'), visionCalls: sumUnits(items, 'visionCalls'),
      averageLatencyMs: average(items.map((item) => item.latencyMs)),
      errorRate: ratio(items.filter((item) => item.status === 'FAILED').length, items.length), cost: this.summary(items),
    }));
  }

  async users(query: Record<string, unknown>) {
    const filters = this.filters(query);
    const attempts = await this.attempts(filters);
    const rows = this.group(attempts, (attempt) => attempt.operation.userId ?? 'UNATTRIBUTED').map(([userId, items]) => ({
      maskedIdentity: userId === 'UNATTRIBUTED' ? 'UNATTRIBUTED' : maskId(userId),
      plan: oneValue(items.map((item) => item.operation.planSlug)) ?? 'PLAN_NOT_REPORTED',
      providerCalls: items.length, logicalRequests: new Set(items.map((item) => item.operationId)).size,
      quotaStates: quotaStateCounts(items), cost: this.summary(items),
    })).sort((left, right) => compareCost(right.cost.knownSubtotalUsd, left.cost.knownSubtotalUsd));
    return this.envelope(filters, { items: rows.slice(0, 250), totalUsers: rows.length, cost: this.summary(attempts) });
  }

  async voice(query: Record<string, unknown>) {
    return this.category(query, (attempt) => attempt.operation.feature.includes('VOICE') || attempt.operation.resource === 'VOICE_SECONDS');
  }

  async documents(query: Record<string, unknown>) {
    return this.category(query, (attempt) => attempt.operation.feature.startsWith('DOCUMENT_') || ['OCR_PAGES', 'EMBEDDING_UNITS'].includes(attempt.operation.resource ?? ''));
  }

  async research(query: Record<string, unknown>) {
    return this.category(query, (attempt) => ['FREE_SEARCH', 'WEB_SEARCH', 'DEEP_RESEARCH'].includes(attempt.operation.feature));
  }

  async languages(query: Record<string, unknown>) {
    const filters = this.filters(query);
    const attempts = (await this.attempts(filters)).filter((attempt) => ['LANGUAGE_TEXT', 'LANGUAGE_VOICE'].includes(attempt.operation.feature));
    const items = ['LANGUAGE_TEXT', 'LANGUAGE_VOICE'].map((feature) => {
      const rows = attempts.filter((attempt) => attempt.operation.feature === feature);
      return {
        feature, providerCalls: rows.length,
        dataStatus: rows.length ? 'AVAILABLE' : 'INSUFFICIENT_DATA', cost: this.summary(rows),
      };
    });
    return this.envelope(filters, { items, cost: this.summary(attempts) });
  }

  async anomalies(query: Record<string, unknown>) {
    const filters = this.filters(query);
    const attempts = await this.attempts(filters);
    const blockedOperations = await this.blockedOperations(filters);
    const rows = [
      anomaly('QUOTA_BLOCKED_OPERATION', 'INFO', blockedOperations.count ?? 0),
      anomaly('PROVIDER_USAGE_AFTER_QUOTA_BLOCK', 'CRITICAL', attempts.filter((item) => item.operation.quotaState === 'BLOCKED').length),
      anomaly('UNATTRIBUTED_PROVIDER_USAGE', 'HIGH', attempts.filter((item) => this.unattributed(item)).length),
      anomaly('UNGUARDED_PROVIDER_USAGE', 'HIGH', attempts.filter((item) => Boolean(item.operation.userId) && !item.operation.quotaReservationId).length),
      anomaly('USAGE_WITH_UNKNOWN_PRICE', 'HIGH', attempts.filter((item) => item.costStatus === 'UNKNOWN' || item.costStatus === 'NOT_AVAILABLE').length),
      anomaly('PROVIDER_RETRY_COST', 'MEDIUM', this.retryOperationCount(attempts)),
      anomaly('MISSING_PROVIDER_OR_MODEL', 'MEDIUM', attempts.filter((item) => !item.provider || !item.model).length),
      anomaly('FINALIZATION_PENDING', 'HIGH', await this.prisma.providerUsageOperation.count({ where: { status: 'FINALIZATION_PENDING', startedAt: { gte: filters.range.from, lt: filters.range.to } } })),
    ].filter((row) => row.count > 0);
    return this.envelope(filters, { items: rows, cost: this.summary(attempts) });
  }

  async instrumentation(query: Record<string, unknown>) {
    const filters = this.filters(query);
    const attempts = await this.attempts(filters);
    const featureStatus = (feature: string, fallback: string) => {
      const rows = attempts.filter((attempt) => attempt.operation.feature === feature);
      const cost = this.summary(rows);
      return {
        feature, providerCalls: rows.length, coverage: cost.coverage.known,
        costStatus: cost.costStatus, dataStatus: rows.length ? summaryAvailability(cost) : fallback, cost,
      };
    };
    return this.envelope(filters, {
      items: [
        featureStatus('TUTOR_TEXT', 'INSUFFICIENT_DATA'),
        featureStatus('LANGUAGE_TEXT', 'INSUFFICIENT_DATA'),
        featureStatus('TUTOR_VOICE', 'INSUFFICIENT_DATA'),
        featureStatus('LANGUAGE_VOICE', 'INSUFFICIENT_DATA'),
        featureStatus('DOCUMENT_OCR', 'INSUFFICIENT_DATA'),
        featureStatus('DOCUMENT_EMBEDDING', 'INSUFFICIENT_DATA'),
        featureStatus('DOCUMENT_RAG', 'INSUFFICIENT_DATA'),
        featureStatus('WEB_SEARCH', 'NOT_INSTRUMENTED'),
        featureStatus('DEEP_RESEARCH', 'INSUFFICIENT_DATA'),
        { feature: 'INFRASTRUCTURE_COST', providerCalls: null, coverage: null, costStatus: 'NOT_INSTRUMENTED', dataStatus: 'NOT_INSTRUMENTED', reason: 'DEFERRED_TO_SPRINT_6' },
        { feature: 'EMAIL_COST', providerCalls: null, coverage: null, costStatus: 'NOT_INSTRUMENTED', dataStatus: 'NOT_INSTRUMENTED' },
      ],
    });
  }

  async pricing(query: Record<string, unknown>) {
    const filters = this.filters(query);
    const items = await this.prisma.providerPricingVersion.findMany({
      where: {
        ...(filters.provider ? { provider: filters.provider } : {}),
        ...(filters.model ? { model: filters.model } : {}),
      },
      orderBy: [{ provider: 'asc' }, { model: 'asc' }, { effectiveFrom: 'desc' }],
    });
    return this.envelope(filters, {
      items: items.map((item) => this.publicPricing(item)),
      dataStatus: items.length ? 'AVAILABLE' : 'INSUFFICIENT_DATA',
      note: 'Historical attempts retain their immutable pricing snapshot.',
    });
  }

  async budgets(query: Record<string, unknown>) {
    const filters = this.filters(query);
    const items = await this.prisma.providerCostBudget.findMany({ orderBy: { createdAt: 'desc' }, take: 500 });
    return this.envelope(filters, {
      items: items.map((item) => ({
        id: item.id, scope: item.scope, scopeKey: item.scopeKey, active: item.active,
        monthlyAmountUsd: decimal(item.monthlyAmountUsd), currency: item.currency,
        warningPercent: item.warningPercent, criticalPercent: item.criticalPercent, createdAt: item.createdAt.toISOString(),
      })),
      dataStatus: items.length ? 'AVAILABLE' : 'NOT_INSTRUMENTED',
    });
  }

  async createPricing(input: CreatePricingInput, context: AuditContext) {
    const provider = identifier(input.provider, 'provider');
    const model = identifier(input.model, 'model');
    const version = identifier(input.version, 'version');
    const currency = identifier(input.currency, 'currency').toUpperCase();
    const reason = requiredReason(input.reason);
    const effectiveFrom = requiredDate(input.effectiveFrom, 'effectiveFrom');
    const effectiveTo = input.effectiveTo ? requiredDate(input.effectiveTo, 'effectiveTo') : null;
    if (effectiveTo && effectiveTo <= effectiveFrom) throw new BadRequestException({ code: 'PRICING_EFFECTIVE_WINDOW_INVALID' });
    if (input.status !== undefined && input.status !== 'DRAFT' && input.status !== 'ACTIVE') {
      throw new BadRequestException({ code: 'PRICING_STATUS_INVALID' });
    }
    const status: ProviderPricingStatus = input.status ?? 'ACTIVE';
    const data = {
      provider, model, version, currency, status, effectiveFrom, effectiveTo,
      sourceReference: optionalText(input.sourceReference, 'sourceReference'), reason,
      createdById: context.actorId ?? null,
      inputTokenPrice: decimalInput(input.inputTokenPrice, 'inputTokenPrice'),
      cachedInputTokenPrice: decimalInput(input.cachedInputTokenPrice, 'cachedInputTokenPrice'),
      outputTokenPrice: decimalInput(input.outputTokenPrice, 'outputTokenPrice'),
      reasoningTokenPrice: decimalInput(input.reasoningTokenPrice, 'reasoningTokenPrice'),
      audioInputSecondPrice: decimalInput(input.audioInputSecondPrice, 'audioInputSecondPrice'),
      audioOutputSecondPrice: decimalInput(input.audioOutputSecondPrice, 'audioOutputSecondPrice'),
      ocrPagePrice: decimalInput(input.ocrPagePrice, 'ocrPagePrice'),
      visionCallPrice: decimalInput(input.visionCallPrice, 'visionCallPrice'),
      embeddingUnitPrice: decimalInput(input.embeddingUnitPrice, 'embeddingUnitPrice'),
      searchUnitPrice: decimalInput(input.searchUnitPrice, 'searchUnitPrice'),
      otherUnitPrice: decimalInput(input.otherUnitPrice, 'otherUnitPrice'),
      otherUnitName: optionalText(input.otherUnitName, 'otherUnitName'),
    };
    const activeRates = Object.values(data).filter((value) => value instanceof Prisma.Decimal);
    if (activeRates.length === 0) throw new BadRequestException({ code: 'PRICING_RATE_REQUIRED' });
    const created = await this.prisma.$transaction(async (tx) => {
      if (status === 'ACTIVE') {
        const overlaps = await tx.providerPricingVersion.findMany({
          where: {
            provider, model, status: 'ACTIVE',
            ...(effectiveTo ? { effectiveFrom: { lt: effectiveTo } } : {}),
            OR: [{ effectiveTo: null }, { effectiveTo: { gt: effectiveFrom } }],
          },
          orderBy: { effectiveFrom: 'asc' },
        });
        const predecessor = overlaps.length === 1 && overlaps[0].effectiveTo === null && overlaps[0].effectiveFrom < effectiveFrom
          ? overlaps[0] : null;
        if (overlaps.length && !predecessor) {
          throw new BadRequestException({ code: 'PRICING_WINDOW_OVERLAP' });
        }
        if (predecessor) {
          await tx.providerPricingVersion.update({ where: { id: predecessor.id }, data: { effectiveTo: effectiveFrom } });
          await tx.auditLog.create({ data: this.audit.auditData(context, {
            action: 'PROVIDER_PRICING_VERSION_SUPERSEDED', targetType: 'provider_pricing_version', targetId: predecessor.id,
            reason, after: { effectiveTo: effectiveFrom.toISOString(), supersededByVersion: version },
          }) });
        }
      }
      const row = await tx.providerPricingVersion.create({ data });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: 'PROVIDER_PRICING_VERSION_CREATED', targetType: 'provider_pricing_version', targetId: row.id,
        reason, after: { provider, model, version, currency, status, effectiveFrom: effectiveFrom.toISOString(), effectiveTo: effectiveTo?.toISOString() ?? null },
      }) });
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.publicPricing(created);
  }

  async createBudget(input: CreateBudgetInput, context: AuditContext) {
    const scope = identifier(input.scope, 'scope');
    const reason = requiredReason(input.reason);
    const monthlyAmountUsd = requiredDecimal(input.monthlyAmountUsd, 'monthlyAmountUsd');
    const warningPercent = percentage(input.warningPercent, 80, 'warningPercent');
    const criticalPercent = percentage(input.criticalPercent, 100, 'criticalPercent');
    if (criticalPercent < warningPercent) throw new BadRequestException({ code: 'BUDGET_THRESHOLDS_INVALID' });
    const created = await this.prisma.$transaction(async (tx) => {
      const row = await tx.providerCostBudget.create({
        data: { scope, scopeKey: optionalText(input.scopeKey, 'scopeKey'), monthlyAmountUsd, warningPercent, criticalPercent, reason, createdById: context.actorId ?? null },
      });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: 'COST_BUDGET_CREATED', targetType: 'provider_cost_budget', targetId: row.id, reason,
        after: { scope, scopeKey: row.scopeKey, monthlyAmountUsd: decimal(monthlyAmountUsd), warningPercent, criticalPercent },
      }) });
      return row;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { id: created.id, scope: created.scope, scopeKey: created.scopeKey, monthlyAmountUsd: decimal(created.monthlyAmountUsd), currency: created.currency, warningPercent: created.warningPercent, criticalPercent: created.criticalPercent };
  }

  private async breakdown(
    query: Record<string, unknown>, key: (attempt: CostAttempt) => string,
    row: (label: string, attempts: CostAttempt[]) => Record<string, unknown>,
  ) {
    const filters = this.filters(query);
    const attempts = await this.attempts(filters);
    return this.envelope(filters, { items: this.group(attempts, key).map(([label, items]) => row(label, items)), cost: this.summary(attempts) });
  }

  private async category(query: Record<string, unknown>, include: (attempt: CostAttempt) => boolean) {
    const filters = this.filters(query);
    const attempts = (await this.attempts(filters)).filter(include);
    const items = this.group(attempts, (attempt) => attempt.operation.feature).map(([feature, rows]) => ({
      feature, providerCalls: rows.length, cost: this.summary(rows),
      inputTokens: sumUnits(rows, 'inputTokens'), cachedInputTokens: sumUnits(rows, 'cachedInputTokens'), outputTokens: sumUnits(rows, 'outputTokens'),
      audioInputSeconds: sumUnits(rows, 'audioInputSeconds'), audioOutputSeconds: sumUnits(rows, 'audioOutputSeconds'),
      ocrPages: sumUnits(rows, 'ocrPages'), embeddingUnits: sumUnits(rows, 'embeddingUnits'), searchUnits: sumUnits(rows, 'searchUnits'),
    }));
    return this.envelope(filters, { items, cost: this.summary(attempts), dataStatus: attempts.length ? 'AVAILABLE' : 'INSUFFICIENT_DATA' });
  }

  private async attempts(filters: CostFilters): Promise<CostAttempt[]> {
    const operation = this.operationWhere(filters);
    return this.prisma.providerUsageAttempt.findMany({
      where: {
        startedAt: { gte: filters.range.from, lt: filters.range.to }, operation,
        ...(filters.provider ? { provider: filters.provider } : {}),
        ...(filters.model ? { model: filters.model } : {}),
        ...(filters.costStatus ? { costStatus: filters.costStatus } : {}),
      },
      include: { operation: { select: OPERATION_SELECT } },
      orderBy: { startedAt: 'desc' },
    });
  }

  private operationWhere(filters: CostFilters): Prisma.ProviderUsageOperationWhereInput {
    return {
      ...(filters.plan ? { planSlug: filters.plan } : {}),
      ...(filters.feature ? { feature: filters.feature } : {}),
    };
  }

  private async blockedOperations(filters: CostFilters): Promise<{ count: number | null; status: string }> {
    // A blocked operation has no provider attempt by design, so an
    // attempt-specific provider/model/cost-status filter cannot truthfully
    // include it. Return an explicit unavailable status rather than a zero.
    if (filters.provider || filters.model || filters.costStatus) return { count: null, status: 'NOT_AVAILABLE_FOR_ATTEMPT_FILTER' };
    const count = await this.prisma.providerUsageOperation.count({
      where: {
        ...this.operationWhere(filters), status: 'BLOCKED',
        startedAt: { gte: filters.range.from, lt: filters.range.to },
      },
    });
    return { count, status: 'MEASURED' };
  }

  private filters(query: Record<string, unknown>): CostFilters {
    const rangeKey = stringQuery(query.range) ?? 'today';
    if (!RANGE_KEYS.includes(rangeKey as (typeof RANGE_KEYS)[number])) throw new BadRequestException({ code: 'COST_RANGE_INVALID' });
    const now = new Date();
    const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
    let from: Date;
    if (rangeKey === 'today') from = today;
    else if (rangeKey === '7d') from = new Date(now.getTime() - 7 * DAY_MS);
    else if (rangeKey === '30d' || rangeKey === 'billing_month') from = rangeKey === 'billing_month' ? new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1)) : new Date(now.getTime() - 30 * DAY_MS);
    else if (rangeKey === '90d') from = new Date(now.getTime() - 90 * DAY_MS);
    else {
      from = requiredDate(stringQuery(query.from), 'from');
      const to = requiredDate(stringQuery(query.to), 'to');
      if (to <= from || to.getTime() - from.getTime() > 366 * DAY_MS) throw new BadRequestException({ code: 'COST_RANGE_INVALID' });
      return this.filterValues({ key: rangeKey, from, to }, query);
    }
    return this.filterValues({ key: rangeKey, from, to: now }, query);
  }

  private filterValues(range: CostRange, query: Record<string, unknown>): CostFilters {
    const requestedStatus = stringQuery(query.status);
    if (requestedStatus === 'INSUFFICIENT_DATA') throw new BadRequestException({ code: 'COST_STATUS_NOT_PERSISTED' });
    const costStatus = requestedStatus as ProviderCostStatus | undefined;
    if (costStatus && !PERSISTED_COST_STATUSES.has(costStatus)) throw new BadRequestException({ code: 'COST_STATUS_INVALID' });
    return {
      range, plan: optionalFilter(query.plan), feature: optionalFilter(query.feature), provider: optionalFilter(query.provider), model: optionalFilter(query.model), costStatus: costStatus ?? null,
    };
  }

  private envelope(filters: CostFilters, data: Record<string, unknown>) {
    return {
      range: { key: filters.range.key, from: filters.range.from.toISOString(), to: filters.range.to.toISOString() },
      generatedAt: new Date().toISOString(), data,
    };
  }

  private group(attempts: CostAttempt[], key: (attempt: CostAttempt) => string): Array<[string, CostAttempt[]]> {
    const groups = new Map<string, CostAttempt[]>();
    for (const attempt of attempts) {
      const label = key(attempt);
      groups.set(label, [...(groups.get(label) ?? []), attempt]);
    }
    return [...groups.entries()].sort(([left], [right]) => left.localeCompare(right));
  }

  private summary(attempts: CostAttempt[]) {
    let measured: Prisma.Decimal | null = null;
    let estimated: Prisma.Decimal | null = null;
    let unknown = 0;
    let notInstrumented = 0;
    let notAvailable = 0;
    let measuredCount = 0;
    let estimatedCount = 0;
    for (const attempt of attempts) {
      if (attempt.costStatus === 'MEASURED' && attempt.referenceAmountUsd) {
        measured = (measured ?? new Prisma.Decimal(0)).plus(attempt.referenceAmountUsd); measuredCount += 1;
      } else if (attempt.costStatus === 'ESTIMATED' && attempt.referenceAmountUsd) {
        estimated = (estimated ?? new Prisma.Decimal(0)).plus(attempt.referenceAmountUsd); estimatedCount += 1;
      } else if (attempt.costStatus === 'NOT_INSTRUMENTED') notInstrumented += 1;
      else if (attempt.costStatus === 'NOT_AVAILABLE') notAvailable += 1;
      else unknown += 1;
    }
    const knownSubtotal = measured || estimated ? (measured ?? new Prisma.Decimal(0)).plus(estimated ?? new Prisma.Decimal(0)) : null;
    const total = attempts.length;
    const costStatus = !total ? 'INSUFFICIENT_DATA'
      : unknown || notAvailable ? 'UNKNOWN'
        : notInstrumented ? 'NOT_INSTRUMENTED'
          : estimatedCount ? 'ESTIMATED'
            : measuredCount ? 'MEASURED'
              : 'UNKNOWN';
    // `knownUsd` is a complete total only. A subtotal remains available under
    // an explicit name for reconciliation, but must not be rendered as the
    // total when any attempt has an unknown cost.
    const known = costStatus === 'MEASURED' || costStatus === 'ESTIMATED' ? knownSubtotal : null;
    return {
      currency: 'USD', costStatus, measuredUsd: decimal(measured), estimatedUsd: decimal(estimated),
      knownUsd: decimal(known), knownSubtotalUsd: decimal(knownSubtotal),
      unknownAttempts: unknown, notInstrumentedAttempts: notInstrumented, notAvailableAttempts: notAvailable, totalAttempts: total,
      coverage: {
        measured: ratio(measuredCount, total), estimated: ratio(estimatedCount, total), known: ratio(measuredCount + estimatedCount, total),
        unknown: ratio(unknown, total), notInstrumented: ratio(notInstrumented, total), notAvailable: ratio(notAvailable, total),
      },
    };
  }

  private unattributed(attempt: CostAttempt): boolean {
    const op = attempt.operation;
    return !op.userId || !op.planSlug || !op.feature || !op.requestId;
  }

  private retryOperationCount(attempts: CostAttempt[]): number {
    return this.group(attempts, (attempt) => attempt.operationId).filter(([, items]) => items.length > 1).length;
  }

  private publicPricing(item: Awaited<ReturnType<PrismaService['providerPricingVersion']['findFirst']>>) {
    if (!item) return null;
    return {
      id: item.id, provider: item.provider, model: item.model, version: item.version, status: item.status, currency: item.currency,
      inputTokenPrice: decimal(item.inputTokenPrice), cachedInputTokenPrice: decimal(item.cachedInputTokenPrice), outputTokenPrice: decimal(item.outputTokenPrice), reasoningTokenPrice: decimal(item.reasoningTokenPrice),
      audioInputSecondPrice: decimal(item.audioInputSecondPrice), audioOutputSecondPrice: decimal(item.audioOutputSecondPrice), ocrPagePrice: decimal(item.ocrPagePrice), visionCallPrice: decimal(item.visionCallPrice),
      embeddingUnitPrice: decimal(item.embeddingUnitPrice), searchUnitPrice: decimal(item.searchUnitPrice), otherUnitPrice: decimal(item.otherUnitPrice), otherUnitName: item.otherUnitName,
      effectiveFrom: item.effectiveFrom.toISOString(), effectiveTo: item.effectiveTo?.toISOString() ?? null, sourceReference: item.sourceReference,
    };
  }
}

function decimal(value: Prisma.Decimal | null | undefined): string | null { return value ? value.toFixed(12) : null; }
function ratio(part: number, total: number): number | null { return total ? Number((part / total).toFixed(6)) : null; }
function average(values: Array<number | null>): number | null { const usable = values.filter((value): value is number => typeof value === 'number'); return usable.length ? Number((usable.reduce((a, b) => a + b, 0) / usable.length).toFixed(2)) : null; }
function oneValue(values: Array<string | null>): string | null { return values.find((value): value is string => Boolean(value)) ?? null; }
function maskId(value: string): string { return `${value.slice(0, 8)}…`; }
function compareCost(left: string | null, right: string | null): number { return Number(left ?? '-1') - Number(right ?? '-1'); }
function quotaStateCounts(attempts: CostAttempt[]): Record<string, number> { return attempts.reduce<Record<string, number>>((out, item) => { const state = item.operation.quotaState ?? 'NOT_REPORTED'; out[state] = (out[state] ?? 0) + 1; return out; }, {}); }
function sumUnits(attempts: CostAttempt[], field: 'inputTokens' | 'cachedInputTokens' | 'outputTokens' | 'reasoningTokens' | 'audioInputSeconds' | 'audioOutputSeconds' | 'ocrPages' | 'embeddingUnits' | 'searchUnits' | 'visionCalls'): number | null { const values = attempts.map((attempt) => attempt[field]).filter((value): value is number => typeof value === 'number'); return values.length ? values.reduce((total, value) => total + value, 0) : null; }
function summaryAvailability(summary: ReturnType<CostCenterService['summary']>): string { if (!summary.totalAttempts) return 'INSUFFICIENT_DATA'; return summary.costStatus === 'MEASURED' || summary.costStatus === 'ESTIMATED' ? 'AVAILABLE' : 'PARTIAL'; }
function anomaly(signal: string, severity: string, count: number) { return { signal, severity, count, dataStatus: count ? 'OBSERVED' : 'INSUFFICIENT_DATA' }; }
function stringQuery(value: unknown): string | undefined { if (Array.isArray(value)) throw new BadRequestException({ code: 'COST_QUERY_MULTIPLE_VALUES' }); return typeof value === 'string' && value.trim() ? value.trim() : undefined; }
function optionalFilter(value: unknown): string | undefined { const text = stringQuery(value); return text ? identifier(text, 'filter') : undefined; }
function identifier(value: string, field: string): string { const result = value.trim(); if (!/^[A-Za-z0-9_.:*\/-]{1,180}$/.test(result)) throw new BadRequestException({ code: 'COST_IDENTIFIER_INVALID', field }); return result; }
function optionalText(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string' || value.trim().length > 1_000) throw new BadRequestException({ code: 'COST_TEXT_INVALID', field });
  const text = value.trim();
  if (field === 'sourceReference') return publicSourceReference(text, field);
  if (containsSensitiveAdministrativeText(text)) throw new BadRequestException({ code: 'COST_TEXT_INVALID', field });
  return text;
}
function publicSourceReference(value: string, field: string): string {
  try {
    const url = new URL(value);
    const sensitive = /(?:password|passcode|secret|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|totp|\botp\b|recovery|\b(?:sk|pk|whsec|rk)_[A-Za-z0-9_]{8,}\b)/i;
    if (url.protocol !== 'https:' || url.username || url.password || sensitive.test(value)) throw new Error('unsafe');
    return url.toString();
  } catch {
    throw new BadRequestException({ code: 'COST_TEXT_INVALID', field });
  }
}
function requiredReason(value: unknown): string { const reason = optionalText(value, 'reason'); if (!reason) throw new BadRequestException({ code: 'COST_REASON_REQUIRED' }); return reason; }
function requiredDate(value: unknown, field: string): Date { if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) throw new BadRequestException({ code: 'COST_DATE_INVALID', field }); return new Date(value); }
function decimalInput(value: unknown, field: string): Prisma.Decimal | null { if (value === undefined || value === null || value === '') return null; try { const result = new Prisma.Decimal(String(value)); if (result.isNegative()) throw new Error('negative'); return result; } catch { throw new BadRequestException({ code: 'COST_DECIMAL_INVALID', field }); } }
function requiredDecimal(value: unknown, field: string): Prisma.Decimal { const result = decimalInput(value, field); if (!result) throw new BadRequestException({ code: 'COST_DECIMAL_REQUIRED', field }); return result; }
function percentage(value: unknown, fallback: number, field: string): number { if (value === undefined || value === null || value === '') return fallback; const number = Number(value); if (!Number.isInteger(number) || number < 0 || number > 100) throw new BadRequestException({ code: 'COST_PERCENTAGE_INVALID', field }); return number; }
