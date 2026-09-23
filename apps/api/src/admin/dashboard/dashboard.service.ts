import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { AdminCapability, AdminIdentity } from '../admin-rbac';
import { PrismaService } from '../../prisma/prisma.service';
import { RedisService } from '../../redis/redis.service';
import { CacheService } from '../../redis/cache.service';
import { QdrantService } from '../../qdrant/qdrant.service';
import {
  DASHBOARD_RANGE_KEYS,
  type DashboardAvailabilityReason,
  type DashboardRange,
  type DashboardRangeKey,
  type DashboardResponse,
  type DashboardSection,
} from './dashboard.types';

type DashboardSectionName =
  | 'overview'
  | 'subscriptions'
  | 'quotas'
  | 'usage'
  | 'learning'
  | 'health'
  | 'incidents'
  | 'security'
  | 'alerts'
  | 'activity';

type HealthComponentStatus = 'healthy' | 'degraded' | 'down' | 'unknown';

const DAY_MS = 86_400_000;
const PLAN_SLUGS = ['free', 'pro', 'pro_max'] as const;
const SUBSCRIPTION_STATES = [
  'free',
  'payment_pending',
  'active',
  'trialing',
  'past_due',
  'canceled',
  'incomplete',
  'expired',
  'payment_failed',
] as const;
const QUOTA_STATES = ['PRIMARY', 'FALLBACK', 'BLOCKED'] as const;
const QUOTA_RESOURCES = [
  'AI_TEXT',
  'DOCUMENT_PAGES',
  'VOICE_SECONDS',
  'WEB_SEARCH',
  'DEEP_RESEARCH',
  'ACADEMIC_AI',
  'OCR_PAGES',
  'EMBEDDING_UNITS',
] as const;
const DASHBOARD_SECTION_CONCURRENCY = 2;

// Only these resources have a durable, request-level ProviderUsage writer in
// the current product.  A quota enum by itself is not evidence of telemetry.
const DURABLY_INSTRUMENTED_RESOURCES = new Set<string>([
  'AI_TEXT',
  'VOICE_SECONDS',
  'OCR_PAGES',
  'EMBEDDING_UNITS',
  'ACADEMIC_AI',
]);

/**
 * Read-only aggregate queries used by the Admin Control Center.  The service
 * deliberately selects only aggregate values and event category/timestamp data;
 * it never returns learner identity, content, payment references, or audit
 * details.
 */
@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
    private readonly qdrant: QdrantService,
    private readonly cache: CacheService,
  ) {}

  async dashboard(identity: AdminIdentity, rawRange?: string | string[]): Promise<DashboardResponse> {
    const range = this.range(rawRange);
    return this.cache.wrap(this.cacheKey(identity, range, 'all'), 30, () => this.computeDashboard(identity, range));
  }

  private async computeDashboard(identity: AdminIdentity, range: DashboardRangeInternal): Promise<DashboardResponse> {
    const names: Array<Exclude<DashboardSectionName, 'alerts'>> = [
      'overview', 'subscriptions', 'quotas', 'usage', 'learning', 'health', 'incidents', 'security', 'activity',
    ];
    const base: Array<[Exclude<DashboardSectionName, 'alerts'>, DashboardSection<unknown>]> = [];
    // Each dashboard section performs its own bounded aggregate queries.  An
    // unbounded fan-out of all sections exhausted small real PostgreSQL pools
    // during Admin login, then made unrelated authenticated requests fail.  A
    // tiny batch preserves independent section failures without starving the
    // session guard or other Admin actions.
    for (let offset = 0; offset < names.length; offset += DASHBOARD_SECTION_CONCURRENCY) {
      base.push(...await Promise.all(names.slice(offset, offset + DASHBOARD_SECTION_CONCURRENCY).map((name) => this.section(name, identity, range))));
    }
    const sections = Object.fromEntries(base) as Record<string, DashboardSection<unknown>>;
    sections.alerts = await this.alertsSection(identity, sections);
    return { range: this.publicRange(range), generatedAt: new Date().toISOString(), sections };
  }

  async namedSection(
    name: DashboardSectionName,
    identity: AdminIdentity,
    rawRange?: string | string[],
  ): Promise<DashboardSection<unknown>> {
    const range = this.range(rawRange);
    return this.cache.wrap(this.cacheKey(identity, range, name), 30, () => this.computeNamedSection(name, identity, range));
  }

  private async computeNamedSection(
    name: DashboardSectionName,
    identity: AdminIdentity,
    range: DashboardRangeInternal,
  ): Promise<DashboardSection<unknown>> {
    if (name === 'alerts') {
      const dashboard = await this.dashboard(identity, range.key);
      return dashboard.sections.alerts;
    }
    const [, section] = await this.section(name, identity, range);
    return section;
  }

  /** Strict, UTC-only time ranges.  Multiple query values are rejected. */
  range(raw?: string | string[]): DashboardRangeInternal {
    if (Array.isArray(raw)) {
      throw new BadRequestException({ code: 'DASHBOARD_RANGE_INVALID' });
    }
    const key = (raw ?? 'today') as DashboardRangeKey;
    if (!DASHBOARD_RANGE_KEYS.includes(key)) {
      throw new BadRequestException({ code: 'DASHBOARD_RANGE_INVALID' });
    }
    const now = new Date();
    const today = startOfUtcDay(now);
    const from = key === 'today' ? today : new Date(now.getTime() - (key === '7d' ? 7 : 30) * DAY_MS);
    return { key, from, to: now, today };
  }

  private async section(
    name: Exclude<DashboardSectionName, 'alerts'>,
    identity: AdminIdentity,
    range: DashboardRangeInternal,
  ): Promise<[Exclude<DashboardSectionName, 'alerts'>, DashboardSection<unknown>]> {
    const requirement = this.requirement(name);
    if (requirement && !requirement.some((capability) => identity.capabilities.includes(capability))) {
      return [name, unavailable('FORBIDDEN_SECTION')];
    }

    const compute = (): Promise<unknown> => {
      switch (name) {
        case 'overview': return this.overview(range);
        case 'subscriptions': return this.subscriptions();
        case 'quotas': return this.quotas(range);
        case 'usage': return this.usage(range);
        case 'learning': return this.learning(range);
        case 'health': return this.health();
        case 'incidents': return this.incidents(range);
        case 'security': return this.security(range);
        case 'activity': return this.activity(range);
      }
    };
    return [name, await this.safe<unknown>(compute)];
  }

  private requirement(name: DashboardSectionName): readonly AdminCapability[] | null {
    switch (name) {
      case 'subscriptions': return ['plans.read', 'subscriptions.read'];
      case 'quotas': return ['quotas.read'];
      case 'usage':
      case 'learning': return ['usage.read'];
      case 'health': return ['infrastructure.read'];
      case 'incidents': return ['bugs.read'];
      case 'security': return ['security.read'];
      case 'activity': return ['audit.read'];
      default: return null;
    }
  }

  private async safe<T>(compute: () => Promise<T>): Promise<DashboardSection<T>> {
    try {
      return { status: 'available', data: await compute() };
    } catch {
      // Avoid relaying dependency errors: connection strings and provider errors
      // can contain operationally sensitive details.
      this.logger.warn('Dashboard section unavailable.');
      return { status: 'error', data: null, reason: 'UNAVAILABLE' };
    }
  }

  private async overview(range: DashboardRangeInternal) {
    const sevenDaysAgo = new Date(range.to.getTime() - 7 * DAY_MS);
    const fourteenDaysAgo = new Date(range.to.getTime() - 14 * DAY_MS);
    const thirtyDaysAgo = new Date(range.to.getTime() - 30 * DAY_MS);
    const sixtyDaysAgo = new Date(range.to.getTime() - 60 * DAY_MS);
    const monthStart = startOfUtcMonth(range.to);

    const [
      totalUsers,
      activeToday,
      active7Days,
      activePrevious7Days,
      active30Days,
      activePrevious30Days,
      newToday,
      newThisMonth,
    ] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.user.count({ where: { lastActiveAt: { gte: range.today, lt: range.to } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: sevenDaysAgo, lt: range.to } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: fourteenDaysAgo, lt: sevenDaysAgo } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: thirtyDaysAgo, lt: range.to } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: sixtyDaysAgo, lt: thirtyDaysAgo } } }),
      this.prisma.user.count({ where: { createdAt: { gte: range.today, lt: range.to } } }),
      this.prisma.user.count({ where: { createdAt: { gte: monthStart, lt: range.to } } }),
    ]);

    return {
      kpis: [
        kpi('total_users', totalUsers, null, 'all_time', 'dashboard.kpi.totalUsers'),
        kpi('active_today', activeToday, null, 'utc_day_to_now', 'dashboard.kpi.activeToday'),
        kpi('active_7_days', active7Days, delta(active7Days, activePrevious7Days), 'rolling_7_days', 'dashboard.kpi.active7Days'),
        kpi('active_30_days', active30Days, delta(active30Days, activePrevious30Days), 'rolling_30_days', 'dashboard.kpi.active30Days'),
        kpi('new_users_today', newToday, null, 'utc_day_to_now', 'dashboard.kpi.newUsersToday'),
        kpi('new_users_this_month', newThisMonth, null, 'utc_month_to_now', 'dashboard.kpi.newUsersThisMonth'),
      ],
    };
  }

  private async subscriptions() {
    const [totalUsers, plans, subscriptions, states] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.plan.findMany({ where: { slug: { in: [...PLAN_SLUGS] } }, select: { id: true, slug: true } }),
      this.prisma.subscription.groupBy({ by: ['planId', 'status'], _count: { _all: true } }),
      this.prisma.subscription.groupBy({ by: ['status'], _count: { _all: true } }),
    ]);
    const idToSlug = new Map(plans.map((plan) => [plan.id, plan.slug]));
    const byPlan = new Map<string, { count: number; active: number }>();
    for (const row of subscriptions) {
      const slug = idToSlug.get(row.planId);
      if (!slug) continue;
      const item = byPlan.get(slug) ?? { count: 0, active: 0 };
      item.count += row._count._all;
      if (row.status === 'active') item.active += row._count._all;
      byPlan.set(slug, item);
    }
    const byState = new Map(states.map((row) => [row.status, row._count._all]));
    const displayedPlanSubscriptions = [...byPlan.values()].reduce((sum, item) => sum + item.count, 0);
    // Subscription is one-to-one with User, so this is the real assigned-user
    // count even when legacy organization plans exist outside the three cards.
    const assignedUsers = subscriptions.reduce((sum, row) => sum + row._count._all, 0);
    return {
      items: PLAN_SLUGS.map((plan) => {
        const item = byPlan.get(plan) ?? { count: 0, active: 0 };
        return {
          plan,
          count: item.count,
          percent: totalUsers === 0 ? null : round2(item.count / totalUsers * 100),
          active: item.active,
        };
      }),
      states: SUBSCRIPTION_STATES.map((state) => ({ state, count: byState.get(state) ?? 0 })),
      unassignedUsers: Math.max(0, totalUsers - assignedUsers),
      otherPlanSubscriptions: Math.max(0, assignedUsers - displayedPlanSubscriptions),
    };
  }

  private async quotas(range: DashboardRangeInternal) {
    const cycles = await this.prisma.quotaCycle.findMany({
      where: { status: 'ACTIVE', startsAt: { lte: range.to }, endsAt: { gt: range.to } },
      select: {
        userId: true,
        accounts: {
          select: {
            state: true,
            primaryLimit: true,
            primaryUsed: true,
            fallbackLimit: true,
            fallbackUsed: true,
          },
        },
      },
    });
    const userState = new Map<string, (typeof QUOTA_STATES)[number]>();
    let measuredAccounts = 0;
    const thresholdUsers = { at70: new Set<string>(), at85: new Set<string>(), at95: new Set<string>() };
    for (const cycle of cycles) {
      let strongest: (typeof QUOTA_STATES)[number] = 'PRIMARY';
      for (const account of cycle.accounts) {
        if (account.state === 'BLOCKED') strongest = 'BLOCKED';
        else if (account.state === 'FALLBACK' && strongest !== 'BLOCKED') strongest = 'FALLBACK';
        const limit = account.primaryLimit === null ? null : account.primaryLimit + account.fallbackLimit;
        const used = account.primaryUsed + account.fallbackUsed;
        if (limit && limit > 0) {
          measuredAccounts += 1;
          const utilization = used / limit;
          if (utilization >= 0.70) thresholdUsers.at70.add(cycle.userId);
          if (utilization >= 0.85) thresholdUsers.at85.add(cycle.userId);
          if (utilization >= 0.95) thresholdUsers.at95.add(cycle.userId);
        }
      }
      // A cycle without quota accounts has no measurable PRIMARY/FALLBACK/
      // BLOCKED state and must not be silently counted as PRIMARY.
      if (cycle.accounts.length > 0) userState.set(cycle.userId, strongest);
    }
    const counts = new Map(QUOTA_STATES.map((state) => [state, 0]));
    for (const state of userState.values()) counts.set(state, (counts.get(state) ?? 0) + 1);
    const total = userState.size;
    return {
      states: QUOTA_STATES.map((state) => ({
        state,
        count: counts.get(state) ?? 0,
        percent: total === 0 ? null : round2((counts.get(state) ?? 0) / total * 100),
      })),
      items: {
        usersInFallback: counts.get('FALLBACK') ?? 0,
        usersBlocked: counts.get('BLOCKED') ?? 0,
        usersAtOrAbove70: thresholdUsers.at70.size,
        usersAtOrAbove85: thresholdUsers.at85.size,
        usersAtOrAbove95: thresholdUsers.at95.size,
        usersWithActiveQuota: total,
        measuredQuotaAccounts: measuredAccounts,
      },
    };
  }

  private async usage(range: DashboardRangeInternal) {
    const where = { startedAt: { gte: range.from, lt: range.to } };
    const [byResource, ai, voice, documents, languageProfiles, activeLanguageLearners, languageSessions] = await Promise.all([
      this.prisma.providerUsage.groupBy({
        by: ['resource', 'status'], where,
        _count: { _all: true },
        _sum: { inputTokens: true, outputTokens: true, audioInputSeconds: true, audioOutputSeconds: true, pages: true, searchCount: true },
        _avg: { latencyMs: true },
      }),
      this.prisma.providerUsage.groupBy({ by: ['status'], where: { ...where, resource: 'AI_TEXT' }, _count: { _all: true }, _avg: { latencyMs: true } }),
      this.prisma.providerUsage.groupBy({ by: ['status'], where: { ...where, resource: 'VOICE_SECONDS' }, _count: { _all: true }, _avg: { latencyMs: true } }),
      this.prisma.document.groupBy({
        by: ['status'], where: { createdAt: { gte: range.from, lt: range.to }, deletedAt: null }, _count: { _all: true },
      }),
      this.prisma.languageProfile.count(),
      this.prisma.languageProfile.findMany({
        where: { user: { lastActiveAt: { gte: range.from, lt: range.to } } },
        distinct: ['userId'],
        select: { userId: true },
      }),
      this.prisma.experienceSession.count({ where: { type: 'language', startedAt: { gte: range.from, lt: range.to } } }),
    ]);
    const resources = QUOTA_RESOURCES.map((resource) => resourceUsage(resource, byResource));
    return {
      resources,
      ai: activitySummary(ai),
      voice: activitySummary(voice),
      documents: {
        uploaded: documents.reduce((sum, row) => sum + row._count._all, 0),
        states: documents.map((row) => ({ state: row.status, count: row._count._all })),
        pagesProcessed: null,
        pagesProcessedReason: 'NOT_INSTRUMENTED',
      },
      languages: {
        learnersConfigured: languageProfiles,
        activeLearners: activeLanguageLearners.length,
        sessions: languageSessions,
        textUsage: unavailable('NOT_INSTRUMENTED'),
        voiceUsage: unavailable('NOT_INSTRUMENTED'),
        // These fields are free text today; expose neither raw values nor a
        // potentially identifying low-cardinality aggregate until a canonical
        // language/CEFR telemetry taxonomy is persisted.
        topTargetLanguages: unavailable('NOT_INSTRUMENTED'),
        cefrDistribution: unavailable('NOT_INSTRUMENTED'),
      },
    };
  }

  private async learning(range: DashboardRangeInternal) {
    const [
      tutor,
      academicWorkspaces,
      documents,
      flashcards,
      reviews,
      activeDigitalTwins,
      concepts,
      graphUpdates,
      languageSessions,
    ] = await Promise.all([
      this.prisma.tutorSession.count({ where: { createdAt: { gte: range.from, lt: range.to } } }),
      this.prisma.academicWorkspace.count({ where: { createdAt: { gte: range.from, lt: range.to } } }),
      this.prisma.document.count({ where: { createdAt: { gte: range.from, lt: range.to }, deletedAt: null } }),
      this.prisma.card.count({ where: { createdAt: { gte: range.from, lt: range.to } } }),
      this.prisma.reviewLog.count({ where: { reviewedAt: { gte: range.from, lt: range.to } } }),
      this.prisma.learningDna.count({ where: { updatedAt: { gte: range.from, lt: range.to } } }),
      this.prisma.concept.count({ where: { createdAt: { gte: range.from, lt: range.to } } }),
      this.prisma.conceptEdge.count({ where: { createdAt: { gte: range.from, lt: range.to } } }),
      this.prisma.experienceSession.count({ where: { type: 'language', startedAt: { gte: range.from, lt: range.to } } }),
    ]);
    return {
      engines: {
        items: [
          availableMetric('tutor', tutor, 'sessions'),
          availableMetric('documents', documents, 'documents'),
          availableMetric('academic_workspace', academicWorkspaces, 'workspaces'),
          availableMetric('flashcards', flashcards, 'cards'),
          unavailableMetric('quiz', 'NOT_INSTRUMENTED'),
          availableMetric('fsrs_reviews', reviews, 'reviews'),
          availableMetric('digital_twin', activeDigitalTwins, 'active_twins'),
          availableMetric('knowledge_graph', graphUpdates, 'updates'),
          availableMetric('languages', languageSessions, 'sessions'),
        ],
      },
      brain: {
        activeDigitalTwins,
        conceptsTracked: concepts,
        knowledgeGraphUpdates: graphUpdates,
        fsrsReviewsCompleted: reviews,
      },
    };
  }

  private async health() {
    const [postgresql, redis, qdrant] = await Promise.all([
      this.check(() => this.prisma.$queryRaw`SELECT 1`),
      this.check(() => this.redis.ping()),
      this.check(() => this.qdrant.listCollections()),
    ]);
    return {
      components: [
        { key: 'api', status: 'healthy' as const, availability: 'verified_by_response' },
        component('postgresql', postgresql),
        component('redis', redis),
        component('qdrant', qdrant),
        unknownComponent('mailer'),
        unknownComponent('llm_provider'),
        unknownComponent('speech'),
        unknownComponent('storage'),
        unknownComponent('payment_provider'),
        unknownComponent('workers_queues'),
      ],
    };
  }

  private async check(operation: () => Promise<unknown>): Promise<boolean> {
    try {
      await operation();
      return true;
    } catch {
      return false;
    }
  }

  private async incidents(range: DashboardRangeInternal) {
    const [open, critical, high, medium, resolvedToday] = await Promise.all([
      this.prisma.incident.count({ where: { status: { not: 'resolved' } } }),
      this.prisma.incident.count({ where: { status: { not: 'resolved' }, severity: 'critical' } }),
      this.prisma.incident.count({ where: { status: { not: 'resolved' }, severity: 'high' } }),
      this.prisma.incident.count({ where: { status: { not: 'resolved' }, severity: 'medium' } }),
      this.prisma.incident.count({ where: { status: 'resolved', resolvedAt: { gte: range.today, lt: range.to } } }),
    ]);
    return { open, critical, high, medium, resolvedToday };
  }

  private async security(range: DashboardRangeInternal) {
    const [suspendedUsers, bannedUsers, adminSecurityEvents, failedAdminMfa] = await Promise.all([
      this.prisma.user.count({ where: { accountStatus: 'suspended' } }),
      this.prisma.user.count({ where: { accountStatus: 'banned' } }),
      this.prisma.securityEvent.count({ where: { createdAt: { gte: range.from, lt: range.to } } }),
      this.prisma.securityEvent.count({ where: { type: 'ADMIN_LOGIN_FAILED_MFA', createdAt: { gte: range.from, lt: range.to } } }),
    ]);
    return {
      metrics: [
        { key: 'suspended_users', value: suspendedUsers },
        { key: 'banned_users', value: bannedUsers },
        { key: 'admin_security_events', value: adminSecurityEvents },
        { key: 'failed_admin_mfa', value: failedAdminMfa },
        { key: 'token_reuse_detections', value: null, reason: 'NOT_INSTRUMENTED' },
      ],
    };
  }

  private async alertsSection(
    identity: AdminIdentity,
    sections: Record<string, DashboardSection<unknown>>,
  ): Promise<DashboardSection<unknown>> {
    const health = sections.health;
    const items: Array<{ key: string; severity: 'critical' | 'high'; component: string }> = [];
    if (health?.status === 'available') {
      const components = (health.data as { components?: Array<{ key: string; status: HealthComponentStatus }> } | null)?.components ?? [];
      for (const component of components) {
        if (component.status !== 'down') continue;
        items.push({
          key: `dependency_down:${component.key}`,
          severity: component.key === 'postgresql' || component.key === 'api' ? 'critical' : 'high',
          component: component.key,
        });
      }
    }
    const quotaData = sections.quotas?.status === 'available'
      ? (sections.quotas.data as { items?: { usersBlocked?: number } } | null)
      : null;
    const subscriptionData = sections.subscriptions?.status === 'available'
      ? (sections.subscriptions.data as { states?: Array<{ state: string; count: number }> } | null)
      : null;
    const paymentFailures = subscriptionData?.states?.find((state) => state.state === 'payment_failed')?.count ?? null;
    const canSeeSignals = identity.capabilities.includes('quotas.read') || identity.capabilities.includes('subscriptions.read');
    return {
      status: 'available',
      data: {
        items,
        signals: canSeeSignals
          ? { blockedUsers: quotaData?.items?.usersBlocked ?? null, paymentFailures }
          : null,
        rules: [
          {
            key: 'quota_blocked_threshold',
            status: 'unavailable',
            reason: 'BUSINESS_DECISION_REQUIRED',
          },
          {
            key: 'payment_failure_threshold',
            status: 'unavailable',
            reason: 'BUSINESS_DECISION_REQUIRED',
          },
        ],
      },
    };
  }

  private async activity(range: DashboardRangeInternal) {
    const [registrations, audits, payments, incidents, blockedQuotaAccounts] = await Promise.all([
      this.prisma.user.findMany({
        where: { createdAt: { gte: range.from, lt: range.to } },
        select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 15,
      }),
      this.prisma.auditLog.findMany({
        where: { createdAt: { gte: range.from, lt: range.to } },
        select: { action: true, createdAt: true }, orderBy: { createdAt: 'desc' }, take: 15,
      }),
      this.prisma.payment.findMany({
        where: { createdAt: { gte: range.from, lt: range.to } },
        select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 15,
      }),
      this.prisma.incident.findMany({
        where: { createdAt: { gte: range.from, lt: range.to } },
        select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 15,
      }),
      this.prisma.quotaAccount.findMany({
        where: { state: 'BLOCKED', updatedAt: { gte: range.from, lt: range.to } },
        select: { updatedAt: true }, orderBy: { updatedAt: 'desc' }, take: 15,
      }),
    ]);
    const items = [
      ...registrations.map((entry) => ({ kind: 'registration', source: 'user', occurredAt: entry.createdAt.toISOString() })),
      ...audits.map((entry) => ({ kind: activityKind(entry.action), source: 'audit', occurredAt: entry.createdAt.toISOString() })),
      ...payments.map((entry) => ({ kind: 'payment_event', source: 'payment', occurredAt: entry.createdAt.toISOString() })),
      ...incidents.map((entry) => ({ kind: 'incident_event', source: 'incident', occurredAt: entry.createdAt.toISOString() })),
      ...blockedQuotaAccounts.map((entry) => ({ kind: 'quota_blocked', source: 'quota', occurredAt: entry.updatedAt.toISOString() })),
    ].sort((a, b) => b.occurredAt.localeCompare(a.occurredAt)).slice(0, 25);
    return { items };
  }

  private publicRange(range: DashboardRangeInternal): DashboardRange {
    return { key: range.key, from: range.from.toISOString(), to: range.to.toISOString(), timezone: 'UTC' };
  }

  /** Cache key includes the effective capability set to prevent cross-role data leakage. */
  private cacheKey(identity: AdminIdentity, range: DashboardRangeInternal, view: string): string {
    const capabilities = [...identity.capabilities].sort().join(',');
    return `admin:dashboard:v1:${view}:${range.key}:${capabilities}`;
  }
}

interface DashboardRangeInternal {
  key: DashboardRangeKey;
  from: Date;
  to: Date;
  today: Date;
}

function unavailable(reason: DashboardAvailabilityReason): DashboardSection<null> {
  return { status: 'unavailable', data: null, reason };
}

function kpi(key: string, value: number, change: { absolute: number; percentage: number | null } | null, period: string, definitionKey: string) {
  return { key, value, change, period, definitionKey };
}

function delta(current: number, previous: number): { absolute: number; percentage: number | null } {
  return { absolute: current - previous, percentage: previous === 0 ? null : round2((current - previous) / previous * 100) };
}

function resourceUsage(resource: (typeof QUOTA_RESOURCES)[number], rows: Array<{
  resource: string; status: string; _count: { _all: number };
  _sum: { inputTokens: number | null; outputTokens: number | null; audioInputSeconds: number | null; audioOutputSeconds: number | null; pages: number | null; searchCount: number | null };
  _avg: { latencyMs: number | null };
}>) {
  if (!DURABLY_INSTRUMENTED_RESOURCES.has(resource)) {
    return {
      resource,
      status: 'unavailable' as const,
      reason: 'NOT_INSTRUMENTED' as const,
      requests: null,
      successful: null,
      failed: null,
      successRate: null,
      averageLatencyMs: null,
      inputTokens: null,
      outputTokens: null,
      audioSeconds: null,
      pages: null,
      searches: null,
    };
  }
  const relevant = rows.filter((row) => row.resource === resource);
  const requests = relevant.reduce((sum, row) => sum + row._count._all, 0);
  const successful = relevant.filter((row) => row.status === 'succeeded').reduce((sum, row) => sum + row._count._all, 0);
  const failed = relevant.filter((row) => row.status === 'failed').reduce((sum, row) => sum + row._count._all, 0);
  const weightedLatency = relevant.reduce((sum, row) => sum + (row._avg.latencyMs ?? 0) * row._count._all, 0);
  return {
    resource,
    status: 'available' as const,
    requests,
    successful,
    failed,
    successRate: requests === 0 ? null : round2(successful / requests * 100),
    averageLatencyMs: requests === 0 ? null : Math.round(weightedLatency / requests),
    inputTokens: sumRows(relevant, 'inputTokens'),
    outputTokens: sumRows(relevant, 'outputTokens'),
    audioSeconds: sumRows(relevant, 'audioInputSeconds') + sumRows(relevant, 'audioOutputSeconds'),
    pages: sumRows(relevant, 'pages'),
    searches: sumRows(relevant, 'searchCount'),
  };
}

function activitySummary(rows: Array<{ status: string; _count: { _all: number }; _avg: { latencyMs: number | null } }>) {
  const requests = rows.reduce((sum, row) => sum + row._count._all, 0);
  const successful = rows.filter((row) => row.status === 'succeeded').reduce((sum, row) => sum + row._count._all, 0);
  const failed = rows.filter((row) => row.status === 'failed').reduce((sum, row) => sum + row._count._all, 0);
  const totalLatency = rows.reduce((sum, row) => sum + (row._avg.latencyMs ?? 0) * row._count._all, 0);
  return {
    requests,
    successful,
    failed,
    successRate: requests === 0 ? null : round2(successful / requests * 100),
    errorRate: requests === 0 ? null : round2(failed / requests * 100),
    averageLatencyMs: requests === 0 ? null : Math.round(totalLatency / requests),
  };
}

function sumRows<T extends Record<string, unknown>>(rows: T[], key: string): number {
  return rows.reduce((sum, row) => sum + Number((row._sum as Record<string, number | null>)[key] ?? 0), 0);
}

function availableMetric(key: string, value: number, unit: string) {
  return { key, status: 'available' as const, value, unit };
}

function unavailableMetric(key: string, reason: DashboardAvailabilityReason) {
  return { key, status: 'unavailable' as const, value: null, reason };
}

function component(key: string, up: boolean) {
  return { key, status: up ? 'healthy' as const : 'down' as const, availability: 'verified' };
}

function unknownComponent(key: string) {
  return { key, status: 'unknown' as const, availability: 'not_instrumented' };
}

function activityKind(action: string): string {
  if (action.startsWith('subscription.') || action.startsWith('billing.')) return 'subscription_change';
  if (action.startsWith('quota.')) return 'quota_event';
  if (action.startsWith('incident.')) return 'incident_event';
  if (action.startsWith('user.')) return 'admin_user_action';
  return 'admin_action';
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function startOfUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));
}

function startOfPreviousUtcMonth(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - 1, 1));
}

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
