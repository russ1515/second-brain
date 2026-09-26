import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type QuotaResource, type QuotaState } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import {
  QuotaService,
  STAGING_QUOTA_CAP_KEY,
  STAGING_QUOTA_CAP_KIND,
  STAGING_QUOTA_CAP_RESOURCE,
} from '../../usage/quota.service';
import { EntitlementsService } from '../../subscription/entitlements.service';
import { AdminAuditService, type AuditContext } from '../admin-audit.service';
import type { AdminCapability, AdminIdentity } from '../admin-rbac';
import {
  type AdminPaginationQueryDto,
  type BetaAccessDto,
  type CreateSupportNoteDto,
  type LearnerProfileQueryDto,
  type PlanOverrideDto,
  type QuotaAdjustmentDto,
  type StagingQuotaCapDto,
  type UserDirectoryQueryDto,
} from '../dto/user-admin.dto';

const QUOTA_RESOURCES: readonly QuotaResource[] = [
  'AI_TEXT', 'VOICE_SECONDS', 'DOCUMENT_PAGES', 'OCR_PAGES',
  'EMBEDDING_UNITS', 'WEB_SEARCH', 'DEEP_RESEARCH', 'ACADEMIC_AI',
];
const DURABLY_INSTRUMENTED_RESOURCES = new Set<QuotaResource>([
  'AI_TEXT', 'VOICE_SECONDS', 'OCR_PAGES', 'EMBEDDING_UNITS', 'ACADEMIC_AI',
]);
const PRIVATE_BETA_ACCESS_KIND = 'feature';
const PRIVATE_BETA_ACCESS_KEY = 'private_beta_access';
const SECRET_LIKE_TEXT = /(?:\b(?:password|passcode|secret|api[ _-]?key|access[ _-]?token|refresh[ _-]?token|totp|one[ _-]?time[ _-]?password|\botp\b|recovery[ _-]?code|\bcvv\b|card[ _-]?number)\b|\bBearer\s+[A-Za-z0-9._~+\/-]+=*|\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b|\b(?:sk|pk|whsec|rk|pi|ch|sub|cus|in|evt|cs|pm|seti)_[A-Za-z0-9_]{8,}\b|\b(?:\d[ -]?){13,19}\b|\bhttps?:\/\/[^\s<>{}"']+|\b[A-Za-z0-9_-]{32,}\b)/i;

type Section<T> =
  | { status: 'available'; data: T }
  | { status: 'unavailable'; data: null; reason: 'FORBIDDEN_SECTION' }
  | { status: 'error'; data: null; reason: 'UNAVAILABLE' };

/**
 * Privacy-first administrative reads for one learner.  The service is kept
 * separate from the legacy AdminService so the existing account-state and
 * billing primitives stay authoritative for mutations.
 */
@Injectable()
export class UserAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly quota: QuotaService,
    private readonly audit: AdminAuditService,
    private readonly entitlements: EntitlementsService,
  ) {}

  async list(identity: AdminIdentity, query: UserDirectoryQueryDto, context?: AuditContext) {
    this.require(identity, 'users.read');
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const search = query.search?.trim();
    const now = new Date();

    if ((query.plan || query.subscriptionStatus) && !this.has(identity, 'subscriptions.read')) {
      throw this.denied('subscriptions.read');
    }
    if (query.quotaState && !this.has(identity, 'quotas.read')) {
      throw this.denied('quotas.read');
    }

    const where: Prisma.UserWhereInput = {
      ...(query.accountStatus ? { accountStatus: query.accountStatus } : {}),
      ...(search ? {
        OR: [
          { id: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
          { profile: { displayName: { contains: search, mode: 'insensitive' } } },
        ],
      } : {}),
      ...((query.plan || query.subscriptionStatus) ? {
        subscription: {
          ...(query.plan ? { plan: { slug: query.plan } } : {}),
          ...(query.subscriptionStatus ? { status: query.subscriptionStatus } : {}),
        },
      } : {}),
      ...(query.quotaState ? {
        quotaCycles: {
          some: {
            status: 'ACTIVE',
            startsAt: { lte: now },
            endsAt: { gt: now },
            accounts: { some: { state: query.quotaState } },
          },
        },
      } : {}),
    };

    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip: (page - 1) * pageSize,
        take: pageSize,
        orderBy: this.directoryOrder(query),
        select: {
          id: true,
          email: true,
          accountStatus: true,
          createdAt: true,
          lastActiveAt: true,
          profile: { select: { displayName: true, preferredLanguage: true } },
          subscription: { select: { status: true, plan: { select: { slug: true } } } },
          quotaCycles: {
            where: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } },
            select: { accounts: { select: { state: true, primaryLimit: true, primaryUsed: true, fallbackLimit: true, fallbackUsed: true } } },
          },
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    if (search && context) {
      // Audit that a lookup happened without storing the searched identifier or
      // turning the audit log into another personal-data index.
      await this.audit.record(context, {
        action: 'admin.user_directory.search',
        targetType: 'UserDirectory',
        metadata: { searchPresent: true, page, pageSize },
      });
    }

    const subscriptionsAllowed = this.has(identity, 'subscriptions.read');
    const quotasAllowed = this.has(identity, 'quotas.read');
    return {
      items: rows.map((user) => {
        const quota = this.quotaSummary(user.quotaCycles);
        return {
          id: user.id,
          email: user.email,
          displayName: user.profile?.displayName ?? null,
          accountStatus: user.accountStatus,
          plan: subscriptionsAllowed ? user.subscription?.plan.slug ?? null : null,
          subscriptionStatus: subscriptionsAllowed ? user.subscription?.status ?? null : null,
          quotaState: quotasAllowed ? quota.state : null,
          usagePercent: quotasAllowed ? quota.percent : null,
          country: null,
          countryStatus: 'NOT_AVAILABLE',
          interfaceLanguage: user.profile?.preferredLanguage ?? null,
          createdAt: user.createdAt.toISOString(),
          lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
        };
      }),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async detail(userId: string, identity: AdminIdentity, context?: AuditContext) {
    this.require(identity, 'users.read');
    const user = await this.baseUser(userId);
    const account = this.accountView(user);

    return {
      header: {
        id: user.id,
        email: user.email,
        displayName: user.profile?.displayName ?? null,
        avatar: null,
        accountStatus: user.accountStatus,
        plan: this.has(identity, 'subscriptions.read') ? user.subscription?.plan.slug ?? null : null,
        subscriptionStatus: this.has(identity, 'subscriptions.read') ? user.subscription?.status ?? null : null,
        quotaState: this.has(identity, 'quotas.read') ? this.quotaSummary(user.quotaCycles).state : null,
        createdAt: user.createdAt.toISOString(),
        lastActiveAt: user.lastActiveAt?.toISOString() ?? null,
      },
      identityVerification: { status: 'NOT_IMPLEMENTED' },
      sections: {
        overview: { status: 'available', data: account },
        // The overview is intentionally the sole eager panel.  Every other
        // panel has its own capability-gated, paginated endpoint and is fetched
        // only when the administrator selects it.  This keeps a detail view
        // responsive on real PostgreSQL and avoids probing sensitive sections
        // merely by opening a user's header.
        support: this.has(identity, 'users.manage')
          ? { status: 'available', data: { status: 'AVAILABLE', lazy: true } }
          : { status: 'unavailable', data: null, reason: 'FORBIDDEN_SECTION' },
        errors: { status: 'available', data: { status: 'NOT_INSTRUMENTED' } },
      },
    };
  }

  async subscription(userId: string, identity: AdminIdentity) {
    this.require(identity, 'subscriptions.read');
    await this.requireUser(userId);
    const now = new Date();
    const [subscription, overrides] = await Promise.all([
      this.prisma.subscription.findUnique({
        where: { userId },
        select: {
          id: true, status: true, interval: true, provider: true, providerSubscriptionId: true,
          currentPeriodStart: true, currentPeriodEnd: true, cancelAtPeriodEnd: true,
          trialEndsAt: true, planVersion: true, plan: { select: { slug: true, name: true } },
        },
      }),
      this.prisma.entitlementOverride.findMany({
        where: { userId, kind: 'plan' },
        orderBy: { startsAt: 'desc' },
        select: { id: true, value: true, startsAt: true, endsAt: true, revokedAt: true, createdAt: true, grantedById: true, reason: true },
      }),
    ]);
    const activeOverride = overrides.find((override) =>
      !override.revokedAt && override.startsAt <= now && (!override.endsAt || override.endsAt > now),
    );
    const planValue = activeOverride && typeof activeOverride.value === 'string' ? activeOverride.value : null;
    const auditAllowed = this.has(identity, 'audit.read');
    const mayReadReasons = this.has(identity, 'audit.reasons.read');

    return {
      plan: subscription?.plan.slug ?? null,
      effectivePlan: planValue ?? subscription?.plan.slug ?? null,
      planSource: planValue ? 'ADMIN_OVERRIDE' : 'SUBSCRIPTION',
      planName: subscription?.plan.name ?? null,
      subscriptionStatus: subscription?.status ?? null,
      billingInterval: subscription?.interval ?? null,
      currentPeriodStart: iso(subscription?.currentPeriodStart),
      currentPeriodEnd: iso(subscription?.currentPeriodEnd),
      nextRenewal: iso(subscription?.currentPeriodEnd),
      provider: subscription?.provider ?? null,
      providerReferenceMasked: maskReference(subscription?.providerSubscriptionId ?? null),
      cancelAtPeriodEnd: subscription?.cancelAtPeriodEnd ?? false,
      trialEndsAt: iso(subscription?.trialEndsAt),
      planVersion: subscription?.planVersion ?? null,
      overrides: overrides.map((override) => ({
        id: override.id,
        source: 'ADMIN_OVERRIDE',
        plan: typeof override.value === 'string' ? override.value : null,
        startsAt: override.startsAt.toISOString(),
        expiresAt: iso(override.endsAt),
        revokedAt: iso(override.revokedAt),
        createdAt: override.createdAt.toISOString(),
        ...(auditAllowed ? { grantedById: override.grantedById } : {}),
        ...(mayReadReasons ? { reason: override.reason, reasonVisibility: 'AVAILABLE' } : { reason: override.reason ? '[REDACTED]' : null, reasonVisibility: 'REDACTED' }),
      })),
      historyStatus: auditAllowed ? 'AVAILABLE' : 'FORBIDDEN_SECTION',
    };
  }

  async quotas(userId: string, identity: AdminIdentity) {
    this.require(identity, 'quotas.read');
    await this.requireUser(userId);
    const now = new Date();
    const cycle = await this.prisma.quotaCycle.findFirst({
      where: { userId, status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } },
      orderBy: { startsAt: 'desc' },
      select: {
        id: true, planSlug: true, planVersion: true, startsAt: true, endsAt: true,
        accounts: { select: { id: true, resource: true, state: true, primaryLimit: true, primaryUsed: true, fallbackLimit: true, fallbackUsed: true, updatedAt: true } },
      },
    });
    if (!cycle) {
      return { status: 'EMPTY', cycle: null, resources: [], overallUsagePercent: null };
    }
    const ledger = await this.prisma.usageLedger.groupBy({
      by: ['resource'],
      where: { userId, cycleId: cycle.id },
      _sum: { primaryDelta: true, fallbackDelta: true },
    });
    const byResource = new Map(ledger.map((row) => [row.resource, row]));
    const resources = cycle.accounts.map((account) => {
      const totals = byResource.get(account.resource);
      const ledgerPrimary = totals?._sum.primaryDelta ?? 0;
      const ledgerFallback = totals?._sum.fallbackDelta ?? 0;
      const totalLimit = account.primaryLimit === null ? null : account.primaryLimit + account.fallbackLimit;
      const totalUsed = account.primaryUsed + account.fallbackUsed;
      return {
        id: account.id,
        resource: account.resource,
        state: account.state,
        primary: { used: account.primaryUsed, limit: account.primaryLimit, percent: percent(account.primaryUsed, account.primaryLimit) },
        fallback: { used: account.fallbackUsed, limit: account.fallbackLimit, percent: percent(account.fallbackUsed, account.fallbackLimit) },
        usagePercent: percent(totalUsed, totalLimit),
        resetAt: cycle.endsAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
        ledger: {
          primaryDelta: ledgerPrimary,
          fallbackDelta: ledgerFallback,
          matchesAccount: ledgerPrimary === account.primaryUsed && ledgerFallback === account.fallbackUsed,
        },
      };
    });
    const measured = resources.filter((resource) => resource.usagePercent !== null);
    return {
      status: 'AVAILABLE',
      cycle: {
        id: cycle.id, planSlug: cycle.planSlug, planVersion: cycle.planVersion,
        startsAt: cycle.startsAt.toISOString(), endsAt: cycle.endsAt.toISOString(),
      },
      resources,
      overallUsagePercent: measured.length
        ? Math.round(measured.reduce((total, resource) => total + (resource.usagePercent ?? 0), 0) / measured.length * 100) / 100
        : null,
    };
  }

  async usage(userId: string, identity: AdminIdentity) {
    this.require(identity, 'usage.read');
    await this.requireUser(userId);
    const [byResource, documents, languageProfiles] = await Promise.all([
      this.prisma.providerUsage.groupBy({
        by: ['resource', 'status'],
        where: { userId },
        _count: { _all: true },
        _sum: {
          inputTokens: true, outputTokens: true, cachedTokens: true,
          audioInputSeconds: true, audioOutputSeconds: true, pages: true, searchCount: true,
        },
      }),
      this.prisma.document.groupBy({
        by: ['status'], where: { userId, deletedAt: null }, _count: { _all: true }, _sum: { charCount: true },
      }),
      this.prisma.languageProfile.count({ where: { userId } }),
    ]);
    const resources = QUOTA_RESOURCES.map((resource) => {
      const rows = byResource.filter((row) => row.resource === resource);
      const sum = <K extends keyof (typeof rows)[number]['_sum']>(key: K) =>
        rows.reduce((total, row) => total + Number(row._sum[key] ?? 0), 0);
      return {
        resource,
        instrumentation: rows.length || DURABLY_INSTRUMENTED_RESOURCES.has(resource) ? 'AVAILABLE' : 'NOT_INSTRUMENTED',
        calls: rows.reduce((total, row) => total + row._count._all, 0),
        states: rows.map((row) => ({ status: row.status, count: row._count._all })),
        inputTokens: sum('inputTokens'),
        outputTokens: sum('outputTokens'),
        cachedTokens: sum('cachedTokens'),
        audioInputSeconds: sum('audioInputSeconds'),
        audioOutputSeconds: sum('audioOutputSeconds'),
        pages: sum('pages'),
        searches: sum('searchCount'),
      };
    });
    return {
      resources,
      language: {
        configuredProfiles: languageProfiles,
        text: { status: 'NOT_INSTRUMENTED' },
        voice: { status: 'NOT_INSTRUMENTED' },
      },
      documents: {
        count: documents.reduce((total, row) => total + row._count._all, 0),
        states: documents.map((row) => ({ status: row.status, count: row._count._all })),
        extractedCharacters: documents.reduce((total, row) => total + Number(row._sum.charCount ?? 0), 0),
        pagesProcessed: { status: 'NOT_INSTRUMENTED' },
        storage: { status: 'NOT_INSTRUMENTED' },
        content: { status: 'HIGHLY_RESTRICTED_NOT_EXPOSED' },
      },
    };
  }

  async payments(userId: string, identity: AdminIdentity, query: AdminPaginationQueryDto) {
    this.require(identity, 'payments.read');
    await this.requireUser(userId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const [payments, total, failures, refunds, subscription, invoices] = await Promise.all([
      this.prisma.payment.findMany({
        where: { userId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, provider: true, providerRef: true, amount: true, currency: true, status: true, purpose: true, createdAt: true },
      }),
      this.prisma.payment.count({ where: { userId } }),
      this.prisma.payment.count({ where: { userId, status: 'failed' } }),
      this.prisma.payment.count({ where: { userId, status: 'refunded' } }),
      this.prisma.subscription.findUnique({ where: { userId }, select: { currentPeriodEnd: true } }),
      this.prisma.invoice.findMany({
        where: { userId }, orderBy: { createdAt: 'desc' }, take: Math.min(pageSize, 25),
        select: { id: true, number: true, provider: true, amount: true, currency: true, status: true, periodStart: true, periodEnd: true, createdAt: true, url: true },
      }),
    ]);
    return {
      items: payments.map((payment) => ({
        id: payment.id,
        provider: payment.provider,
        referenceMasked: maskReference(payment.providerRef),
        amount: payment.amount,
        currency: payment.currency,
        status: payment.status,
        purpose: payment.purpose,
        createdAt: payment.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
      summary: {
        lastPaymentAt: iso(payments[0]?.createdAt),
        nextRenewal: iso(subscription?.currentPeriodEnd),
        paymentFailures: failures,
        refunds,
      },
      invoices: invoices.map((invoice) => ({
        id: invoice.id,
        number: invoice.number,
        provider: invoice.provider,
        amount: invoice.amount,
        currency: invoice.currency,
        status: invoice.status,
        periodStart: iso(invoice.periodStart),
        periodEnd: iso(invoice.periodEnd),
        createdAt: invoice.createdAt.toISOString(),
        available: Boolean(invoice.url),
      })),
    };
  }

  async sessions(userId: string, identity: AdminIdentity, query: AdminPaginationQueryDto) {
    this.require(identity, 'security.read');
    await this.requireUser(userId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const now = new Date();
    const [sessions, total] = await Promise.all([
      this.prisma.session.findMany({
        where: { userId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, createdAt: true, expiresAt: true, revokedAt: true, userAgent: true, ipAddress: true, mfaVerifiedAt: true },
      }),
      this.prisma.session.count({ where: { userId } }),
    ]);
    return {
      items: sessions.map((session) => ({
        id: session.id,
        status: session.revokedAt ? 'REVOKED' : session.expiresAt <= now ? 'EXPIRED' : 'ACTIVE',
        createdAt: session.createdAt.toISOString(),
        lastUsedAt: null,
        lastUsedStatus: 'NOT_INSTRUMENTED',
        expiresAt: session.expiresAt.toISOString(),
        revokedAt: iso(session.revokedAt),
        mfaVerified: Boolean(session.mfaVerifiedAt),
        device: summarizeUserAgent(session.userAgent),
        ipMetadata: maskIp(session.ipAddress),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async security(userId: string, identity: AdminIdentity, query: AdminPaginationQueryDto) {
    this.require(identity, 'security.read');
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, emailVerified: true, twoFactorEnabled: true, accountStatus: true, suspendedAt: true, bannedAt: true },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const [events, total, activeSessions, deletionRequests] = await Promise.all([
      this.prisma.securityEvent.findMany({
        where: { userId }, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, type: true, severity: true, result: true, createdAt: true },
      }),
      this.prisma.securityEvent.count({ where: { userId } }),
      this.prisma.session.count({ where: { userId, revokedAt: null, expiresAt: { gt: new Date() } } }),
      this.prisma.accountDeletionRequest.findMany({
        where: { userId }, orderBy: { requestedAt: 'desc' }, take: 5,
        select: { id: true, requestedAt: true, requestedById: true, reason: true, status: true, resolvedAt: true },
      }),
    ]);
    const mayReadReasons = this.has(identity, 'audit.reasons.read');
    return {
      emailVerified: user.emailVerified,
      mfaEnabled: user.twoFactorEnabled,
      accountStatus: user.accountStatus,
      suspendedAt: iso(user.suspendedAt),
      bannedAt: iso(user.bannedAt),
      activeSessions,
      deletionRequests: deletionRequests.map((request) => ({
        id: request.id,
        requestedAt: request.requestedAt.toISOString(),
        requestedById: request.requestedById,
        reason: mayReadReasons ? request.reason : '[REDACTED]',
        reasonVisibility: mayReadReasons ? 'AVAILABLE' : 'REDACTED',
        status: request.status,
        resolvedAt: iso(request.resolvedAt),
      })),
      events: events.map((event) => ({
        id: event.id, type: event.type, severity: event.severity, result: event.result, createdAt: event.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async auditLog(userId: string, identity: AdminIdentity, query: AdminPaginationQueryDto) {
    this.require(identity, 'audit.read');
    await this.requireUser(userId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: Prisma.AuditLogWhereInput = { targetId: userId };
    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, actorId: true, actorRole: true, action: true, reason: true, result: true, createdAt: true },
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const mayReadReasons = this.has(identity, 'audit.reasons.read');
    return {
      items: items.map((item) => ({
        id: item.id, actorId: item.actorId, actorRole: item.actorRole,
        action: item.action,
        reason: mayReadReasons ? item.reason : item.reason ? '[REDACTED]' : null,
        reasonVisibility: mayReadReasons ? 'AVAILABLE' : 'REDACTED',
        result: item.result, createdAt: item.createdAt.toISOString(),
      })),
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async activity(userId: string, identity: AdminIdentity, query: AdminPaginationQueryDto) {
    this.require(identity, 'audit.read');
    const user = await this.requireUser(userId);
    const audit = await this.auditLog(userId, identity, query);
    const items = [
      { kind: 'ACCOUNT_CREATED', source: 'user', occurredAt: user.createdAt.toISOString() },
      ...audit.items.map((item) => ({ kind: item.action, source: 'audit', occurredAt: item.createdAt, result: item.result })),
    ].sort((left, right) => right.occurredAt.localeCompare(left.occurredAt));
    return { ...audit, items, content: 'NOT_EXPOSED' };
  }

  async reports(userId: string, identity: AdminIdentity, query: AdminPaginationQueryDto) {
    this.require(identity, 'bugs.read');
    await this.requireUser(userId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = { reporterId: userId };
    const [items, total] = await Promise.all([
      this.prisma.report.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, category: true, status: true, createdAt: true, reviewedAt: true },
      }),
      this.prisma.report.count({ where }),
    ]);
    return {
      items: items.map((item) => ({
        id: item.id, category: item.category, status: item.status,
        createdAt: item.createdAt.toISOString(), reviewedAt: iso(item.reviewedAt),
      })),
      page, pageSize, total, totalPages: Math.ceil(total / pageSize),
      incidents: { status: 'NOT_INSTRUMENTED' },
    };
  }

  async learnerProfile(
    userId: string,
    identity: AdminIdentity,
    query: LearnerProfileQueryDto,
    context?: AuditContext,
  ) {
    this.require(identity, 'learner_profile.read');
    const access = query.access ?? 'standard';
    if (access === 'restricted') this.require(identity, 'learner_profile.restricted');
    if (access === 'highly_restricted') {
      this.require(identity, 'learner_profile.highly_restricted');
      if (!query.reason?.trim()) throw new BadRequestException({ code: 'SENSITIVE_ACCESS_REASON_REQUIRED' });
      this.assertSafeAdministrativeText(query.reason);
    }
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        profile: { select: { preferredLanguage: true, timezone: true } },
        onboardingProfile: {
          select: {
            status: true, category: true, completedAt: true,
            education: true, languages: true, languageLearner: true, goals: true,
            subjects: true, preferences: true, teacher: true, academicSupport: true,
            assessment: true, extra: true,
          },
        },
        languageProfiles: { select: { language: true, nativeLanguage: true, mode: true, cefrLevel: true, goal: true } },
        profileReviewsForUser: {
          orderBy: { createdAt: 'desc' }, take: 1,
          select: { action: true, deliveryStatus: true, createdAt: true },
        },
      },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    const onboarding = user.onboardingProfile;
    const standard = {
      classification: 'STANDARD',
      status: onboarding?.status ?? 'NOT_STARTED',
      category: onboarding?.category ?? null,
      completedAt: iso(onboarding?.completedAt),
      interfaceLanguage: user.profile?.preferredLanguage ?? null,
      timezone: user.profile?.timezone ?? null,
      educationLevel: jsonString(onboarding?.education, ['level', 'educationLevel', 'currentLevel']),
      languages: user.languageProfiles.map((language) => ({
        language: language.language,
        nativeLanguage: language.nativeLanguage,
        mode: language.mode,
        cefrLevel: language.cefrLevel,
      })),
      profileReview: user.profileReviewsForUser[0]
        ? {
          action: user.profileReviewsForUser[0].action,
          deliveryStatus: user.profileReviewsForUser[0].deliveryStatus,
          createdAt: user.profileReviewsForUser[0].createdAt.toISOString(),
        }
        : null,
      identityVerification: { status: 'NOT_IMPLEMENTED' },
    };
    if (access === 'standard') return standard;

    const restricted = {
      ...standard,
      classification: 'RESTRICTED',
      goals: onboarding?.goals ?? null,
      preferences: onboarding?.preferences ?? null,
      teacherPreferences: onboarding?.teacher ?? null,
      languageGoals: user.languageProfiles.map((language) => ({ language: language.language, goal: language.goal })),
    };
    if (access === 'restricted') return restricted;

    const auditContext = context ?? { actorId: identity.userId };
    await this.prisma.$transaction(async (tx) => {
      await tx.auditLog.create({ data: this.audit.auditData(auditContext, {
        action: 'learner_profile.highly_restricted.access', targetType: 'User', targetId: userId,
        reason: query.reason!.trim(), metadata: { access: 'HIGHLY_RESTRICTED' },
      }) });
      await tx.securityEvent.create({ data: this.audit.securityData(auditContext, 'HIGHLY_RESTRICTED_LEARNER_PROFILE_ACCESSED', userId, { access: 'HIGHLY_RESTRICTED' }, 'high') });
    });
    return {
      ...restricted,
      classification: 'HIGHLY_RESTRICTED',
      pedagogicalDetails: {
        // Identity data, documents and conversations are intentionally omitted.
        education: onboarding?.education ?? null,
        languages: onboarding?.languages ?? null,
        languageLearner: onboarding?.languageLearner ?? null,
        subjects: onboarding?.subjects ?? null,
        academicSupport: onboarding?.academicSupport ?? null,
        assessment: onboarding?.assessment ?? null,
        extra: onboarding?.extra ?? null,
      },
      documents: { status: 'HIGHLY_RESTRICTED_NOT_IMPLEMENTED' },
      conversations: { status: 'HIGHLY_RESTRICTED_NOT_IMPLEMENTED' },
    };
  }

  async planOverride(userId: string, identity: AdminIdentity, dto: PlanOverrideDto, context: AuditContext, source = 'ADMIN_OVERRIDE') {
    this.require(identity, 'subscriptions.manage');
    this.assertSafeAdministrativeText(dto.reason);
    const timing = this.overrideTiming(dto);
    await this.requireUser(userId);
    const plan = await this.prisma.plan.findFirst({ where: { slug: dto.plan, isActive: true }, select: { slug: true } });
    if (!plan) throw new ConflictException({ code: 'PLAN_NOT_AVAILABLE' });
    const override = await this.serializable(async (tx) => {
      // A new effective plan supersedes a prior effective-plan exception from
      // its start time; its history remains identifiable and is never a payment.
      await tx.entitlementOverride.updateMany({
        where: {
          userId,
          kind: 'plan',
          revokedAt: null,
          startsAt: { lte: timing.startsAt },
          OR: [{ endsAt: null }, { endsAt: { gt: timing.startsAt } }],
        },
        data: { endsAt: timing.startsAt },
      });
      const override = await tx.entitlementOverride.create({
        data: {
          userId, kind: 'plan', key: 'effective_plan', value: dto.plan,
          reason: dto.reason.trim(), grantedById: context.actorId ?? identity.userId,
          startsAt: timing.startsAt, endsAt: timing.expiresAt,
        },
      });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: source === 'BETA_ACCESS' ? 'subscription.beta_access.grant' : 'subscription.plan_override.create',
        targetType: 'EntitlementOverride', targetId: override.id, reason: dto.reason.trim(),
        after: { userId, source, plan: dto.plan, startsAt: timing.startsAt.toISOString(), expiresAt: iso(timing.expiresAt) },
      }) });
      await tx.securityEvent.create({ data: this.audit.securityData(
        context,
        source === 'BETA_ACCESS' ? 'BETA_ACCESS_GRANTED' : 'PLAN_OVERRIDE_GRANTED',
        userId,
        { source, plan: dto.plan, overrideId: override.id },
        'high',
      ) });
      return override;
    });
    return {
      id: override.id, source, plan: dto.plan,
      startsAt: override.startsAt.toISOString(), expiresAt: iso(override.endsAt),
      subscriptionMutated: false, paymentCreated: false,
    };
  }

  async betaAccess(userId: string, identity: AdminIdentity, dto: BetaAccessDto, context: AuditContext) {
    return this.planOverride(userId, identity, dto, context, 'BETA_ACCESS');
  }

  async quotaAdjustment(userId: string, identity: AdminIdentity, dto: QuotaAdjustmentDto, context: AuditContext) {
    this.require(identity, 'quotas.adjust');
    this.assertSafeAdministrativeText(dto.reason);
    await this.requireUser(userId);
    const credit = await this.quota.adminCredit({
      userId,
      resource: dto.resource,
      amount: dto.amount,
      reason: dto.reason.trim(),
      actorId: context.actorId ?? identity.userId,
      cycleId: dto.cycleId,
      afterApplied: async (tx, result) => {
        await tx.auditLog.create({ data: this.audit.auditData(context, {
          action: 'quota.admin_credit', targetType: 'QuotaAccount', targetId: result.accountId,
          reason: dto.reason.trim(),
          after: {
            userId, source: 'ADMIN_CREDIT', resource: result.resource, cycleId: result.cycleId,
            requestedCredit: result.requestedCredit, appliedCredit: result.appliedCredit,
            unappliedCredit: result.unappliedCredit, primaryCredit: result.primaryCredit, fallbackCredit: result.fallbackCredit,
          },
        }) });
        await tx.securityEvent.create({ data: this.audit.securityData(context, 'QUOTA_ADMIN_CREDIT', userId, {
          resource: result.resource, cycleId: result.cycleId, appliedCredit: result.appliedCredit,
        }, 'high') });
      },
    });
    return { ...credit, source: 'ADMIN_CREDIT' };
  }

  /**
   * Create a bounded private-staging restriction for the one server-metered
   * learner unit.  It is intentionally neither a plan override nor a credit:
   * the cap can only reduce the user's effective allowance.
   */
  async createStagingQuotaCap(
    userId: string,
    identity: AdminIdentity,
    dto: StagingQuotaCapDto,
    context: AuditContext,
  ) {
    this.require(identity, 'quotas.adjust');
    this.assertSafeAdministrativeText(dto.reason);
    await this.requireUser(userId);
    if (dto.resource !== STAGING_QUOTA_CAP_RESOURCE) {
      throw new BadRequestException({ code: 'STAGING_QUOTA_CAP_RESOURCE_INVALID' });
    }

    const now = new Date();
    const expiresAt = new Date(dto.expiresAt);
    if (Number.isNaN(expiresAt.getTime()) || expiresAt <= now) {
      throw new BadRequestException({ code: 'STAGING_QUOTA_CAP_EXPIRY_INVALID' });
    }
    const effectiveLimit = await this.entitlements.quota(userId, STAGING_QUOTA_CAP_KEY);
    if (effectiveLimit !== null && dto.limit > effectiveLimit) {
      throw new ConflictException({ code: 'STAGING_QUOTA_CAP_MUST_NOT_INCREASE_ALLOWANCE' });
    }

    const cap = await this.serializable(async (tx) => {
      const betaAccess = await tx.entitlementOverride.findFirst({
        where: {
          userId,
          kind: PRIVATE_BETA_ACCESS_KIND,
          key: PRIVATE_BETA_ACCESS_KEY,
          value: { equals: true },
          revokedAt: null,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        orderBy: { endsAt: 'desc' },
        select: { endsAt: true },
      });
      if (!betaAccess?.endsAt) {
        throw new ConflictException({ code: 'PRIVATE_BETA_ACCESS_REQUIRED' });
      }
      if (expiresAt > betaAccess.endsAt) {
        throw new ConflictException({ code: 'STAGING_QUOTA_CAP_EXPIRY_EXCEEDS_BETA_ACCESS' });
      }

      const activeCaps = await tx.entitlementOverride.findMany({
        where: {
          userId,
          kind: STAGING_QUOTA_CAP_KIND,
          key: STAGING_QUOTA_CAP_KEY,
          revokedAt: null,
          startsAt: { lte: now },
          endsAt: { gt: now },
        },
        select: { id: true, value: true },
      });
      const limits = activeCaps.map((row) => row.value);
      if (limits.some((value) => typeof value !== 'number' || !Number.isSafeInteger(value) || value < 0)) {
        throw new ConflictException({ code: 'STAGING_QUOTA_CAP_INVALID' });
      }
      const activeLimit = limits.length ? Math.min(...(limits as number[])) : null;
      if (activeLimit !== null && dto.limit > activeLimit) {
        throw new ConflictException({ code: 'STAGING_QUOTA_CAP_CAN_ONLY_RESTRICT' });
      }

      // Keep superseded caps as auditable history.  Equal/lower replacements
      // never introduce a more generous effective allowance.
      if (activeCaps.length) {
        await tx.entitlementOverride.updateMany({
          where: { id: { in: activeCaps.map((row) => row.id) } },
          data: { endsAt: now },
        });
      }
      const row = await tx.entitlementOverride.create({
        data: {
          userId,
          kind: STAGING_QUOTA_CAP_KIND,
          key: STAGING_QUOTA_CAP_KEY,
          value: dto.limit,
          reason: dto.reason.trim(),
          grantedById: context.actorId ?? identity.userId,
          startsAt: now,
          endsAt: expiresAt,
        },
      });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: 'quota.staging_cap.create',
        targetType: 'EntitlementOverride',
        targetId: row.id,
        reason: dto.reason.trim(),
        after: {
          userId,
          source: 'STAGING_QUOTA_CAP',
          resource: STAGING_QUOTA_CAP_RESOURCE,
          limit: dto.limit,
          startsAt: now.toISOString(),
          expiresAt: expiresAt.toISOString(),
        },
      }) });
      await tx.securityEvent.create({ data: this.audit.securityData(
        context,
        'STAGING_QUOTA_CAP_CREATED',
        userId,
        { capId: row.id, resource: STAGING_QUOTA_CAP_RESOURCE, limit: dto.limit, expiresAt: expiresAt.toISOString() },
        'high',
      ) });
      return row;
    });
    return {
      id: cap.id,
      source: 'STAGING_QUOTA_CAP',
      resource: STAGING_QUOTA_CAP_RESOURCE,
      limit: dto.limit,
      startsAt: cap.startsAt.toISOString(),
      expiresAt: cap.endsAt?.toISOString() ?? null,
    };
  }

  async revokeStagingQuotaCap(
    userId: string,
    capId: string,
    identity: AdminIdentity,
    reason: string,
    context: AuditContext,
  ) {
    this.require(identity, 'quotas.adjust');
    this.assertSafeAdministrativeText(reason);
    await this.requireUser(userId);
    const now = new Date();
    return this.serializable(async (tx) => {
      const cap = await tx.entitlementOverride.findFirst({
        where: {
          id: capId,
          userId,
          kind: STAGING_QUOTA_CAP_KIND,
          key: STAGING_QUOTA_CAP_KEY,
          revokedAt: null,
        },
        select: { id: true, value: true, startsAt: true, endsAt: true },
      });
      if (!cap) throw new NotFoundException({ code: 'STAGING_QUOTA_CAP_NOT_FOUND' });
      await tx.entitlementOverride.update({
        where: { id: cap.id },
        data: { revokedAt: now, revokedById: context.actorId ?? identity.userId },
      });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: 'quota.staging_cap.revoke',
        targetType: 'EntitlementOverride',
        targetId: cap.id,
        reason: reason.trim(),
        before: {
          userId,
          source: 'STAGING_QUOTA_CAP',
          resource: STAGING_QUOTA_CAP_RESOURCE,
          limit: typeof cap.value === 'number' ? cap.value : 'INVALID',
          startsAt: cap.startsAt.toISOString(),
          expiresAt: iso(cap.endsAt),
        },
      }) });
      await tx.securityEvent.create({ data: this.audit.securityData(
        context,
        'STAGING_QUOTA_CAP_REVOKED',
        userId,
        { capId: cap.id, resource: STAGING_QUOTA_CAP_RESOURCE },
        'high',
      ) });
      return { revoked: true, id: cap.id };
    });
  }

  async revokeSession(userId: string, sessionId: string, identity: AdminIdentity, reason: string, context: AuditContext) {
    this.require(identity, 'users.sessions.revoke');
    const session = await this.prisma.session.findFirst({ where: { id: sessionId, userId }, select: { id: true, revokedAt: true } });
    if (!session) throw new NotFoundException({ code: 'SESSION_NOT_FOUND' });
    const result = await this.prisma.$transaction(async (tx) => {
      const result = session.revokedAt
        ? { count: 0 }
        : await tx.session.updateMany({ where: { id: sessionId, userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: 'user.session.revoke', targetType: 'Session', targetId: sessionId,
        reason, after: { userId, revoked: result.count === 1 },
      }) });
      await tx.securityEvent.create({ data: this.audit.securityData(context, 'SESSION_REVOKED', userId, { sessionId, revoked: result.count === 1 }, 'high') });
      return result;
    });
    return { revoked: result.count === 1 };
  }

  async supportNotes(userId: string, identity: AdminIdentity, query: AdminPaginationQueryDto) {
    this.require(identity, 'users.manage');
    await this.requireUser(userId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.adminSupportNote.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, body: true, actorId: true, createdAt: true },
      }),
      this.prisma.adminSupportNote.count({ where }),
    ]);
    return {
      items: items.map((item) => ({ id: item.id, body: item.body, actorId: item.actorId, createdAt: item.createdAt.toISOString() })),
      page, pageSize, total, totalPages: Math.ceil(total / pageSize),
    };
  }

  async createSupportNote(userId: string, identity: AdminIdentity, dto: CreateSupportNoteDto, context: AuditContext) {
    this.require(identity, 'users.manage');
    const body = dto.body.trim();
    const reason = dto.reason.trim();
    this.assertSafeAdministrativeText(body, reason, 'SUPPORT_NOTE_SENSITIVE_CONTENT_REJECTED');
    await this.requireUser(userId);
    const note = await this.prisma.$transaction(async (tx) => {
      const note = await tx.adminSupportNote.create({
        data: { userId, actorId: context.actorId ?? identity.userId, body },
        select: { id: true, actorId: true, body: true, createdAt: true },
      });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: 'support_note.create', targetType: 'AdminSupportNote', targetId: note.id,
        reason, metadata: { userId, bodyLength: body.length },
      }) });
      return note;
    });
    return { id: note.id, actorId: note.actorId, body: note.body, createdAt: note.createdAt.toISOString() };
  }

  async profileReviews(userId: string, identity: AdminIdentity, query: AdminPaginationQueryDto) {
    this.require(identity, 'users.manage');
    await this.requireUser(userId);
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where = { userId };
    const [items, total] = await Promise.all([
      this.prisma.adminProfileReview.findMany({
        where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        select: { id: true, adminId: true, action: true, reason: true, deliveryStatus: true, createdAt: true },
      }),
      this.prisma.adminProfileReview.count({ where }),
    ]);
    const mayReadReasons = this.has(identity, 'audit.reasons.read');
    return {
      items: items.map((item) => ({
        id: item.id, adminId: item.adminId, action: item.action,
        reason: mayReadReasons ? item.reason : '[REDACTED]',
        reasonVisibility: mayReadReasons ? 'AVAILABLE' : 'REDACTED',
        deliveryStatus: item.deliveryStatus, createdAt: item.createdAt.toISOString(),
      })),
      page, pageSize, total, totalPages: Math.ceil(total / pageSize),
    };
  }

  async reviewProfile(
    userId: string,
    identity: AdminIdentity,
    dto: { action: 'MARK_REVIEWED' | 'REQUEST_USER_UPDATE'; reason: string },
    context: AuditContext,
  ) {
    this.require(identity, 'users.manage');
    this.require(identity, 'learner_profile.read');
    this.assertSafeAdministrativeText(dto.reason);
    await this.requireUser(userId);
    const deliveryStatus = dto.action === 'REQUEST_USER_UPDATE' ? 'NOT_INSTRUMENTED' : 'NOT_APPLICABLE';
    const review = await this.prisma.$transaction(async (tx) => {
      const review = await tx.adminProfileReview.create({
        data: {
          userId,
          adminId: context.actorId ?? identity.userId,
          action: dto.action,
          reason: dto.reason.trim(),
          deliveryStatus,
        },
      });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: dto.action === 'MARK_REVIEWED' ? 'learner_profile.review.marked' : 'learner_profile.update_requested',
        targetType: 'AdminProfileReview', targetId: review.id, reason: dto.reason.trim(),
        after: { userId, action: dto.action, deliveryStatus },
      }) });
      await tx.securityEvent.create({ data: this.audit.securityData(
        context, 'LEARNER_PROFILE_REVIEW_RECORDED', userId, { action: dto.action, deliveryStatus, reviewId: review.id }, 'medium',
      ) });
      return review;
    });
    return {
      id: review.id, action: review.action, deliveryStatus: review.deliveryStatus,
      createdAt: review.createdAt.toISOString(),
    };
  }

  private async baseUser(userId: string) {
    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, email: true, emailVerified: true, accountStatus: true,
        suspendedAt: true, bannedAt: true, createdAt: true, lastActiveAt: true,
        profile: { select: { displayName: true, preferredLanguage: true, timezone: true } },
        subscription: { select: { status: true, plan: { select: { slug: true } } } },
        quotaCycles: {
          where: { status: 'ACTIVE', startsAt: { lte: now }, endsAt: { gt: now } },
          select: { accounts: { select: { state: true, primaryLimit: true, primaryUsed: true, fallbackLimit: true, fallbackUsed: true } } },
        },
      },
    });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    return user;
  }

  private async requireUser(userId: string) {
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { id: true, createdAt: true } });
    if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });
    return user;
  }

  private accountView(user: Awaited<ReturnType<UserAdminService['baseUser']>>) {
    return {
      accountStatus: user.accountStatus,
      emailVerified: user.emailVerified,
      createdAt: user.createdAt.toISOString(),
      lastActiveAt: iso(user.lastActiveAt),
      interfaceLanguage: user.profile?.preferredLanguage ?? null,
      timezone: user.profile?.timezone ?? null,
      suspendedAt: iso(user.suspendedAt),
      bannedAt: iso(user.bannedAt),
    };
  }

  private async section<T>(identity: AdminIdentity, capability: AdminCapability, compute: () => Promise<T>): Promise<Section<T>> {
    if (!this.has(identity, capability)) return { status: 'unavailable', data: null, reason: 'FORBIDDEN_SECTION' };
    try {
      return { status: 'available', data: await compute() };
    } catch {
      // A dependent panel must not erase an otherwise useful user detail.
      return { status: 'error', data: null, reason: 'UNAVAILABLE' };
    }
  }

  private directoryOrder(query: UserDirectoryQueryDto): Prisma.UserOrderByWithRelationInput {
    const direction = query.sortDirection ?? 'desc';
    switch (query.sortBy ?? 'createdAt') {
      case 'email': return { email: direction };
      case 'lastActiveAt': return { lastActiveAt: direction };
      case 'accountStatus': return { accountStatus: direction };
      case 'plan': return { subscription: { plan: { slug: direction } } };
      case 'subscriptionStatus': return { subscription: { status: direction } };
      default: return { createdAt: direction };
    }
  }

  private quotaSummary(cycles: Array<{ accounts: Array<{ state: QuotaState; primaryLimit: number | null; primaryUsed: number; fallbackLimit: number; fallbackUsed: number }> }>) {
    let state: QuotaState | null = null;
    let used = 0;
    let limit = 0;
    for (const cycle of cycles) {
      for (const account of cycle.accounts) {
        if (account.state === 'BLOCKED') state = 'BLOCKED';
        else if (account.state === 'FALLBACK' && state !== 'BLOCKED') state = 'FALLBACK';
        else if (!state) state = 'PRIMARY';
        if (account.primaryLimit !== null) {
          used += account.primaryUsed + account.fallbackUsed;
          limit += account.primaryLimit + account.fallbackLimit;
        }
      }
    }
    return { state, percent: limit > 0 ? Math.round(used / limit * 10_000) / 100 : null };
  }

  private overrideTiming(dto: PlanOverrideDto) {
    const startsAt = dto.startsAt ? new Date(dto.startsAt) : new Date();
    const expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;
    if (Number.isNaN(startsAt.getTime()) || (expiresAt && Number.isNaN(expiresAt.getTime()))) {
      throw new BadRequestException({ code: 'PLAN_OVERRIDE_DATE_INVALID' });
    }
    if (expiresAt && expiresAt <= startsAt) {
      throw new BadRequestException({ code: 'PLAN_OVERRIDE_EXPIRY_INVALID' });
    }
    return { startsAt, expiresAt };
  }

  private has(identity: AdminIdentity, capability: AdminCapability): boolean {
    return identity.capabilities.includes(capability);
  }

  private require(identity: AdminIdentity, capability: AdminCapability): void {
    if (!this.has(identity, capability)) throw this.denied(capability);
  }

  private denied(capability: AdminCapability): ForbiddenException {
    return new ForbiddenException({ code: 'ADMIN_CAPABILITY_DENIED', required: [capability] });
  }

  /** Superseding effective-plan overrides must not become order-dependent. */
  private async serializable<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 1; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        const retryable = error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2034';
        if (!retryable || attempt >= 4) throw error;
        await new Promise((resolve) => setTimeout(resolve, attempt * 5));
      }
    }
  }

  private assertSafeAdministrativeText(...values: string[]): void {
    let code = 'ADMIN_TEXT_SENSITIVE_CONTENT_REJECTED';
    // The optional final argument is a response code for a narrow endpoint;
    // callers still pass only prose in the normal case.
    if (values.length > 1 && /^[A-Z_]+$/.test(values.at(-1) ?? '')) code = values.pop() as string;
    if (values.some((value) => SECRET_LIKE_TEXT.test(value))) {
      throw new BadRequestException({ code });
    }
  }
}

function iso(value: Date | null | undefined): string | null {
  return value?.toISOString() ?? null;
}

function percent(used: number, limit: number | null): number | null {
  if (limit === null || limit <= 0) return null;
  return Math.round(used / limit * 10_000) / 100;
}

function maskReference(value: string | null): string | null {
  if (!value) return null;
  if (value.length <= 4) return '••••';
  return `${value.slice(0, 3)}••••${value.slice(-4)}`;
}

function maskIp(value: string | null): string | null {
  if (!value) return null;
  if (/^\d{1,3}(?:\.\d{1,3}){3}$/.test(value)) return `***.***.***.${value.split('.').at(-1)}`;
  return 'masked';
}

function summarizeUserAgent(value: string | null): string {
  if (!value) return 'Unknown device';
  const browser = /edg\//i.test(value) ? 'Edge' : /firefox\//i.test(value) ? 'Firefox' : /chrome\//i.test(value) ? 'Chrome' : /safari\//i.test(value) ? 'Safari' : 'Unknown browser';
  return /mobile|android|iphone|ipad/i.test(value) ? `${browser} mobile` : `${browser} desktop`;
}

function jsonString(value: unknown, keys: readonly string[]): string | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const object = value as Record<string, unknown>;
  for (const key of keys) {
    if (typeof object[key] === 'string' && object[key].trim()) return object[key].trim();
  }
  return null;
}
