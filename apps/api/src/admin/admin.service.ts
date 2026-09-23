import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type {
  AdminStats,
  AdminUserRow,
  AdminUsersResponse,
  AiUsageRow,
  AiUsageView,
  AuditLogView,
  CreateIncidentRequest,
  CreateReportRequest,
  IncidentSeverity,
  IncidentStatus,
  IncidentView,
  PlanSlug,
  ReportStatus,
  ReportView,
} from '@second-brain/shared';
import type { AuditLog, Incident, Report } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { SubscriptionService } from '../subscription/subscription.service';
import type { AuditContext } from './admin-audit.service';
import { AdminAuditService, containsSensitiveAdministrativeText } from './admin-audit.service';
import type { BanUserDto } from './dto/admin.dto';
import type { EntitlementOverrideDto } from './dto/admin.dto';
import { Prisma, type AdminRole } from '@prisma/client';
import { SafeRedactionService } from '../diagnostics/safe-redaction.service';

/** The platform back office (Sprint 8.5). Cross-tenant reads + admin actions,
 *  every mutation writing an audit-log entry. Guarded by AdminGuard. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
    private readonly auditV2: AdminAuditService,
    private readonly redact: SafeRedactionService,
  ) {}

  // ── statistics ─────────────────────────────────────────────────────────

  async stats(): Promise<AdminStats> {
    const [totalUsers, suspendedUsers, totalOrganizations, totalDocuments, openIncidents, openReports, invoiceAgg, plans, subsByPlan] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.user.count({ where: { suspendedAt: { not: null } } }),
        this.prisma.organization.count(),
        this.prisma.document.count({ where: { deletedAt: null } }),
        this.prisma.incident.count({ where: { status: { not: 'resolved' } } }),
        this.prisma.report.count({ where: { status: 'open' } }),
        this.prisma.invoice.aggregate({ _sum: { amount: true }, where: { status: 'paid' } }),
        this.prisma.plan.findMany({ select: { id: true, slug: true } }),
        this.prisma.subscription.groupBy({ by: ['planId'], _count: { _all: true } }),
      ]);

    const slugById = new Map(plans.map((p) => [p.id, p.slug]));
    const subscriptionsByPlan: Record<string, number> = {};
    for (const row of subsByPlan) {
      const slug = slugById.get(row.planId) ?? 'unknown';
      subscriptionsByPlan[slug] = row._count._all;
    }

    return {
      totalUsers,
      suspendedUsers,
      totalOrganizations,
      subscriptionsByPlan,
      invoicesTotal: invoiceAgg._sum.amount ?? 0,
      totalDocuments,
      openIncidents,
      openReports,
    };
  }

  // ── users & subscriptions ────────────────────────────────────────────────

  async listUsers(): Promise<AdminUsersResponse> {
    const [rows, total] = await Promise.all([
      this.prisma.user.findMany({
        orderBy: { createdAt: 'desc' },
        take: 200,
        select: {
          id: true,
          email: true,
          isAdmin: true,
          suspendedAt: true,
          createdAt: true,
          profile: { select: { displayName: true } },
          subscription: { select: { plan: { select: { slug: true } } } },
        },
      }),
      this.prisma.user.count(),
    ]);
    const items: AdminUserRow[] = rows.map((u) => ({
      id: u.id,
      email: u.email,
      displayName: u.profile?.displayName ?? null,
      planSlug: (u.subscription?.plan.slug as PlanSlug | undefined) ?? null,
      isAdmin: u.isAdmin,
      suspended: u.suspendedAt !== null,
      createdAt: u.createdAt.toISOString(),
    }));
    return { items, total };
  }

  async suspendUser(context: AuditContext, userId: string, suspend: boolean, reason: string): Promise<void> {
    this.assertSafeAdministrativeText(reason);
    const now = new Date();
    await this.serializable(async (tx) => {
      // Read/check/write must share a SERIALIZABLE transaction: otherwise a
      // concurrent ban could be overwritten by a stale suspend/reactivate.
      const before = await tx.user.findUniqueOrThrow({
        where: { id: userId }, select: { accountStatus: true, suspendedAt: true, bannedAt: true },
      });
      if (suspend && before.accountStatus !== 'active') {
        throw new ConflictException({ code: before.accountStatus === 'banned' ? 'ACCOUNT_BANNED' : 'ACCOUNT_NOT_ACTIVE' });
      }
      if (!suspend && (before.accountStatus !== 'suspended' || before.bannedAt)) {
        throw new ConflictException({ code: 'ACCOUNT_NOT_SUSPENDED' });
      }
      const updated = await tx.user.update({
        where: { id: userId },
        data: {
          accountStatus: suspend ? 'suspended' : 'active',
          suspendedAt: suspend ? now : null,
          suspensionReason: suspend ? reason : null,
          accountStateActorId: context.actorId ?? null,
        },
        select: { accountStatus: true, suspendedAt: true },
      });
      if (suspend) {
        await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      }
      await tx.auditLog.create({ data: this.auditV2.auditData(context, {
        action: suspend ? 'user.suspend' : 'user.reactivate', targetType: 'User', targetId: userId, before, after: updated, reason,
      }) });
      await tx.securityEvent.create({ data: this.auditV2.securityData(
        context, suspend ? 'ACCOUNT_SUSPENDED' : 'ACCOUNT_REACTIVATED', userId, { reason }, suspend ? 'high' : 'medium',
      ) });
      void updated;
    });
  }

  async banUser(context: AuditContext, userId: string, dto: Pick<BanUserDto, 'reason' | 'internalNote' | 'reference'>): Promise<void> {
    this.assertSafeAdministrativeText(dto.reason, dto.internalNote, dto.reference);
    const now = new Date();
    await this.serializable(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({ where: { id: userId }, select: { accountStatus: true, bannedAt: true } });
      const updated = await tx.user.update({
        where: { id: userId },
        data: { accountStatus: 'banned', bannedAt: now, banReason: dto.reason, banInternalNote: dto.internalNote ?? null, banReference: dto.reference ?? null, accountStateActorId: context.actorId ?? null },
        select: { accountStatus: true, bannedAt: true },
      });
      await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } });
      await tx.auditLog.create({ data: this.auditV2.auditData(context, {
        action: 'user.ban', targetType: 'User', targetId: userId, before, after: updated, reason: dto.reason,
        metadata: { reference: dto.reference, internalNotePresent: !!dto.internalNote },
      }) });
      await tx.securityEvent.create({ data: this.auditV2.securityData(
        context, 'ACCOUNT_BANNED', userId, { reason: dto.reason, reference: dto.reference }, 'critical',
      ) });
      void updated;
    });
  }

  async revokeSessions(context: AuditContext, userId: string, reason: string): Promise<void> {
    this.assertSafeAdministrativeText(reason);
    await this.prisma.$transaction(async (tx) => {
      const result = await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: this.auditV2.auditData(context, {
        action: 'user.sessions.revoke_all', targetType: 'User', targetId: userId, reason, after: { revokedCount: result.count },
      }) });
      await tx.securityEvent.create({ data: this.auditV2.securityData(context, 'SESSIONS_REVOKED', userId, { count: result.count, reason }, 'high') });
    });
  }

  async requestDeletion(context: AuditContext, userId: string, reason: string) {
    this.assertSafeAdministrativeText(reason);
    let outcome: { request: { id: string; status: string; requestedAt: Date; requestedById: string; reason: string }; before: unknown; after: unknown };
    try {
      outcome = await this.serializable(async (tx) => {
      const before = await tx.user.findUniqueOrThrow({
        where: { id: userId },
        select: { accountStatus: true },
      });
      const pending = await tx.accountDeletionRequest.findFirst({
        where: { userId, status: { in: ['requested', 'approved'] } },
        orderBy: { requestedAt: 'desc' },
      });
      if (pending) {
        const updated = await tx.user.update({
          where: { id: userId },
          data: { accountStatus: 'deletion_pending', accountStateActorId: context.actorId ?? null },
          select: { accountStatus: true },
        });
        await tx.auditLog.create({ data: this.auditV2.auditData(context, {
          action: 'user.deletion.request', targetType: 'AccountDeletionRequest', targetId: pending.id,
          before, after: updated, reason, metadata: { userId, status: pending.status, duplicate: true },
        }) });
        await tx.securityEvent.create({ data: this.auditV2.securityData(
          context, 'ACCOUNT_DELETION_REQUESTED', userId, { requestId: pending.id, status: pending.status, duplicate: true }, 'high',
        ) });
        return { request: pending, before, after: updated };
      }
      const request = await tx.accountDeletionRequest.create({
        data: { userId, requestedById: context.actorId ?? 'system', reason },
      });
      const updated = await tx.user.update({
        where: { id: userId },
        data: { accountStatus: 'deletion_pending', accountStateActorId: context.actorId ?? null },
        select: { accountStatus: true },
      });
      await tx.auditLog.create({ data: this.auditV2.auditData(context, {
        action: 'user.deletion.request', targetType: 'AccountDeletionRequest', targetId: request.id,
        before, after: updated, reason, metadata: { userId, status: request.status },
      }) });
      await tx.securityEvent.create({ data: this.auditV2.securityData(
        context, 'ACCOUNT_DELETION_REQUESTED', userId, { requestId: request.id, status: request.status }, 'high',
      ) });
        return { request, before, after: updated };
      });
    } catch (error) {
      // The partial unique index is a second line of defense against two
      // simultaneous requests.  The winning transaction already emitted the
      // durable audit/security record; return its workflow rather than create a
      // duplicate or expose a failed destructive operation.
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== 'P2002') throw error;
      const existing = await this.prisma.accountDeletionRequest.findFirst({
        where: { userId, status: { in: ['requested', 'approved'] } },
        orderBy: { requestedAt: 'desc' },
      });
      if (!existing) throw error;
      return {
        id: existing.id,
        status: existing.status,
        requestedAt: existing.requestedAt.toISOString(),
        requestedById: existing.requestedById,
        reasonVisibility: 'REDACTED',
      };
    }
    const { request, before, after } = outcome;
    void before;
    void after;
    return {
      id: request.id,
      status: request.status,
      requestedAt: request.requestedAt.toISOString(),
      requestedById: request.requestedById,
      reasonVisibility: 'REDACTED',
    };
  }

  async assignRole(context: AuditContext, userId: string, role: AdminRole, reason: string) {
    this.assertSafeAdministrativeText(reason);
    const assignment = await this.prisma.$transaction(async (tx) => {
      const assignment = await tx.adminRoleAssignment.upsert({
        where: { userId_role: { userId, role } },
        create: { userId, role, grantedById: context.actorId, reason },
        update: { revokedAt: null, grantedById: context.actorId, reason },
      });
      await tx.auditLog.create({ data: this.auditV2.auditData(context, {
        action: 'admin.role.assign', targetType: 'User', targetId: userId, after: { role }, reason,
      }) });
      await tx.securityEvent.create({ data: this.auditV2.securityData(
        context, 'ADMIN_ROLE_CHANGED', userId, { role, change: 'assigned', reason }, 'critical',
      ) });
      return assignment;
    });
    return { id: assignment.id, role: assignment.role };
  }

  async revokeRole(context: AuditContext, userId: string, role: AdminRole, reason: string): Promise<void> {
    this.assertSafeAdministrativeText(reason);
    await this.serializable(async (tx) => {
      if (role === 'SUPER_ADMIN') {
        const activeSuperAdmins = await tx.adminRoleAssignment.count({ where: { role: 'SUPER_ADMIN', revokedAt: null } });
        if (activeSuperAdmins <= 1) throw new ConflictException({ code: 'LAST_SUPER_ADMIN', message: 'The final active SUPER_ADMIN cannot be revoked.' });
      }
      await tx.adminRoleAssignment.update({ where: { userId_role: { userId, role } }, data: { revokedAt: new Date() } });
      await tx.auditLog.create({ data: this.auditV2.auditData(context, {
        action: 'admin.role.revoke', targetType: 'User', targetId: userId, before: { role }, reason,
      }) });
      await tx.securityEvent.create({ data: this.auditV2.securityData(
        context, 'ADMIN_ROLE_CHANGED', userId, { role, change: 'revoked', reason }, 'critical',
      ) });
    });
  }

  async createEntitlementOverride(context: AuditContext, userId: string, dto: EntitlementOverrideDto) {
    this.assertSafeAdministrativeText(dto.reason);
    if (dto.kind === 'quota' && (!Number.isSafeInteger(dto.value) || (dto.value as number) < 0)) {
      throw new BadRequestException('Quota override value must be a non-negative integer.');
    }
    if (dto.kind === 'feature' && typeof dto.value !== 'boolean') {
      throw new BadRequestException('Feature override value must be boolean.');
    }
    const row = await this.prisma.$transaction(async (tx) => {
      const row = await tx.entitlementOverride.create({
        data: { userId, kind: dto.kind, key: dto.key, value: dto.value as Prisma.InputJsonValue, reason: dto.reason, grantedById: context.actorId ?? 'system', endsAt: dto.endsAt ? new Date(dto.endsAt) : null },
      });
      await tx.auditLog.create({ data: this.auditV2.auditData(context, {
        action: 'entitlement.override.create', targetType: 'EntitlementOverride', targetId: row.id,
        after: { userId, kind: dto.kind, key: dto.key, endsAt: dto.endsAt }, reason: dto.reason,
      }) });
      return row;
    });
    return { id: row.id, kind: row.kind, key: row.key, startsAt: row.startsAt.toISOString(), endsAt: row.endsAt?.toISOString() ?? null };
  }

  async revokeEntitlementOverride(context: AuditContext, id: string, reason: string): Promise<void> {
    this.assertSafeAdministrativeText(reason);
    await this.prisma.$transaction(async (tx) => {
      const row = await tx.entitlementOverride.update({ where: { id }, data: { revokedAt: new Date(), revokedById: context.actorId } });
      await tx.auditLog.create({ data: this.auditV2.auditData(context, {
        action: 'entitlement.override.revoke', targetType: 'EntitlementOverride', targetId: id,
        before: { userId: row.userId, kind: row.kind, key: row.key }, reason,
      }) });
    });
  }

  async setUserPlan(context: AuditContext, userId: string, slug: PlanSlug, reason: string): Promise<void> {
    this.assertSafeAdministrativeText(reason);
    await this.subscriptions.setPlan(userId, slug);
    await this.auditV2.record(context, { action: 'subscription.plan.change', targetType: 'User', targetId: userId, after: { planSlug: slug }, reason });
  }

  // ── AI usage monitoring ────────────────────────────────────────────────

  async aiUsage(): Promise<AiUsageView> {
    const period = new Date().toISOString().slice(0, 7);
    const counters = await this.prisma.usageCounter.findMany({
      where: { period, metric: { in: ['ai_questions', 'voice_minutes'] } },
    });
    const byUser = new Map<string, { aiQuestions: number; voiceMinutes: number }>();
    let aiQuestions = 0;
    let voiceMinutes = 0;
    for (const c of counters) {
      const entry = byUser.get(c.userId) ?? { aiQuestions: 0, voiceMinutes: 0 };
      if (c.metric === 'ai_questions') {
        entry.aiQuestions += c.used;
        aiQuestions += c.used;
      } else {
        entry.voiceMinutes += c.used;
        voiceMinutes += c.used;
      }
      byUser.set(c.userId, entry);
    }
    const users = await this.prisma.user.findMany({
      where: { id: { in: [...byUser.keys()] } },
      select: { id: true, email: true },
    });
    const emailById = new Map(users.map((u) => [u.id, u.email]));
    const top: AiUsageRow[] = [...byUser.entries()]
      .map(([userId, v]) => ({ userId, email: emailById.get(userId) ?? '—', ...v }))
      .sort((a, b) => b.aiQuestions - a.aiQuestions)
      .slice(0, 10);
    return { period, totals: { aiQuestions, voiceMinutes }, top };
  }

  // ── incidents ─────────────────────────────────────────────────────────

  async listIncidents(query: { page?: number; pageSize?: number; status?: string; severity?: IncidentSeverity; source?: string; search?: string } = {}) {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 25;
    const where: Prisma.IncidentWhereInput = {
      ...(query.status ? { status: query.status as IncidentStatus } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.source ? { bugGroups: { some: { source: query.source as never } } } : {}),
      ...(query.search ? { title: { contains: query.search, mode: 'insensitive' } } : {}),
    };
    const [total, rows] = await this.prisma.$transaction([
      this.prisma.incident.count({ where }),
      this.prisma.incident.findMany({
        where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        include: { bugGroups: { select: { affectedUsersCount: true } }, _count: { select: { bugGroups: true } } },
      }),
    ]);
    const items = rows.map((incident) => ({
      ...this.incidentView(incident),
      bugCount: incident._count.bugGroups,
      affectedUsers: incident.bugGroups.reduce((sum, group) => sum + group.affectedUsersCount, 0),
      impact: 'NOT_INSTRUMENTED',
      assignedToMasked: this.redact.maskedIdentity(incident.assignedToId),
    }));
    return { items, incidents: items, total, page, pageSize };
  }

  async createIncident(actorId: string, dto: CreateIncidentRequest & { bugGroupIds?: string[]; assignedToId?: string }): Promise<IncidentView> {
    this.assertSafeAdministrativeText(dto.title, dto.description);
    // Do not copy incident prose into AuditLog.detail: it can contain sensitive
    // operational context, and audit readers are broader than incident readers.
    const incident = await this.serializable(async (tx) => {
      if (dto.assignedToId) {
        const assignment = await tx.adminRoleAssignment.findFirst({ where: { userId: dto.assignedToId, revokedAt: null }, select: { id: true } });
        if (!assignment) throw new BadRequestException('Assignee must be an active admin.');
      }
      const created = await tx.incident.create({
        data: {
          title: this.redact.text(dto.title, 200) ?? 'Incident',
          description: this.redact.text(dto.description, 2_000),
          severity: dto.severity as IncidentSeverity,
          status: 'investigating',
          assignedToId: dto.assignedToId ?? null,
        },
      });
      if (dto.bugGroupIds?.length) {
        await tx.bugGroup.updateMany({ where: { id: { in: dto.bugGroupIds } }, data: { incidentId: created.id } });
      }
      await tx.incidentTimelineEvent.create({ data: { incidentId: created.id, actorId, type: 'created', note: 'Incident created after human review.' } });
      await tx.auditLog.create({ data: this.auditV2.auditData({ actorId }, {
        action: 'INCIDENT_CREATED', targetType: 'incident', targetId: created.id,
        after: { severity: dto.severity, bugCount: dto.bugGroupIds?.length ?? 0 },
      }) });
      return created;
    });
    return this.incidentView(incident);
  }

  async updateIncidentStatus(
    actorId: string,
    id: string,
    status: IncidentStatus,
  ): Promise<IncidentView> {
    const incident = await this.prisma.incident.update({
      where: { id },
      data: { status, resolvedAt: status === 'resolved' ? new Date() : null },
    });
    await this.audit(actorId, 'incident.status', `${id} → ${status}`);
    return this.incidentView(incident);
  }

  // ── audit logs ─────────────────────────────────────────────────────────

  async listAuditLogs(): Promise<AuditLogView[]> {
    const rows = await this.prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    // Historic rows may predate the centralized sanitizer.  Do not expose legacy
    // free-text details through this broad audit.read endpoint.
    return rows.map((a) => this.auditView({ ...a, detail: a.detail ? '[REDACTED]' : null }));
  }

  // ── reports / signalements ───────────────────────────────────────────────

  createReport(reporterId: string, dto: CreateReportRequest): Promise<Report> {
    return this.prisma.report.create({
      data: {
        reporterId,
        category: dto.category.trim() || 'other',
        message: dto.message.trim(),
      },
    });
  }

  async listReports(): Promise<ReportView[]> {
    const rows = await this.prisma.report.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((r) => this.reportView(r));
  }

  async resolveReport(
    actorId: string,
    id: string,
    status: 'reviewed' | 'dismissed',
  ): Promise<ReportView> {
    const report = await this.prisma.report.update({
      where: { id },
      data: { status, reviewedAt: new Date() },
    });
    await this.audit(actorId, 'report.resolve', `${id} → ${status}`);
    return this.reportView(report);
  }

  // ── internals ─────────────────────────────────────────────────────────

  private audit(actorId: string, action: string, detail?: string): Promise<unknown> {
    return this.prisma.auditLog.create({ data: { actorId, action, detail: detail ?? null } });
  }

  /** A stale critical write fails and is retried as a complete transaction. */
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

  private assertSafeAdministrativeText(...values: Array<string | null | undefined>): void {
    if (values.some((value) => containsSensitiveAdministrativeText(value))) {
      throw new BadRequestException({ code: 'ADMIN_TEXT_SENSITIVE_CONTENT_REJECTED' });
    }
  }

  private incidentView(i: Incident): IncidentView {
    return {
      id: i.id,
      title: this.redact.text(i.title, 200) ?? 'Incident',
      description: this.redact.text(i.description, 2_000),
      severity: i.severity as IncidentSeverity,
      status: i.status as IncidentStatus,
      createdAt: i.createdAt.toISOString(),
      resolvedAt: i.resolvedAt?.toISOString() ?? null,
    };
  }

  private auditView(a: AuditLog): AuditLogView {
    return {
      id: a.id,
      actorId: a.actorId,
      action: a.action,
      detail: a.detail,
      createdAt: a.createdAt.toISOString(),
    };
  }

  private reportView(r: Report): ReportView {
    return {
      id: r.id,
      reporterId: this.redact.maskedIdentity(r.reporterId) ?? 'user_redacted',
      category: this.redact.boundedIdentifier(r.category, 40) ?? 'other',
      message: this.redact.text(r.message, 1_024) ?? '[REDACTED]',
      status: r.status as ReportStatus,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
    };
  }
}
