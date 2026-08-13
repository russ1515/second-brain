import { Injectable } from '@nestjs/common';
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

/** The platform back office (Sprint 8.5). Cross-tenant reads + admin actions,
 *  every mutation writing an audit-log entry. Guarded by AdminGuard. */
@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptions: SubscriptionService,
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

  async suspendUser(actorId: string, userId: string, suspend: boolean): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { suspendedAt: suspend ? new Date() : null },
    });
    await this.audit(actorId, suspend ? 'user.suspend' : 'user.reactivate', userId);
  }

  async setUserPlan(actorId: string, userId: string, slug: PlanSlug): Promise<void> {
    await this.subscriptions.setPlan(userId, slug);
    await this.audit(actorId, 'user.set_plan', `${userId} → ${slug}`);
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

  async listIncidents(): Promise<IncidentView[]> {
    const rows = await this.prisma.incident.findMany({ orderBy: { createdAt: 'desc' }, take: 100 });
    return rows.map((i) => this.incidentView(i));
  }

  async createIncident(actorId: string, dto: CreateIncidentRequest): Promise<IncidentView> {
    const incident = await this.prisma.incident.create({
      data: {
        title: dto.title.trim(),
        description: dto.description?.trim() || null,
        severity: dto.severity as IncidentSeverity,
      },
    });
    await this.audit(actorId, 'incident.create', incident.title);
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
    return rows.map((a) => this.auditView(a));
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

  private incidentView(i: Incident): IncidentView {
    return {
      id: i.id,
      title: i.title,
      description: i.description,
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
      reporterId: r.reporterId,
      category: r.category,
      message: r.message,
      status: r.status as ReportStatus,
      createdAt: r.createdAt.toISOString(),
      reviewedAt: r.reviewedAt?.toISOString() ?? null,
    };
  }
}
