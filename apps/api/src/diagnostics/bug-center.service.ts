import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  BugStatus,
  ErrorSeverity,
  IncidentSeverity,
  IncidentStatus,
  Prisma,
  SupportCasePriority,
  SupportCaseStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminAuditService, type AuditContext } from '../admin/admin-audit.service';
import type { AdminIdentity } from '../admin/admin-rbac';
import { SafeRedactionService } from './safe-redaction.service';
import { DiagnosticService, type DiagnosticView } from './diagnostic.service';
import type {
  AssignBugDto,
  BugListQueryDto,
  CreateIncidentControlDto,
  CreateSupportCaseDto,
  MarkDuplicateDto,
  SupportCaseListQueryDto,
  UpdateBugStatusDto,
  UpdateIncidentStatusControlDto,
  UpdateSupportCaseDto,
} from './dto/diagnostics.dto';

const STATUS_TRANSITIONS: Record<BugStatus, readonly BugStatus[]> = {
  new: ['triaged', 'investigating', 'wont_fix'],
  triaged: ['investigating', 'wont_fix', 'duplicate'],
  investigating: ['fix_in_progress', 'wont_fix', 'duplicate', 'triaged'],
  fix_in_progress: ['fixed', 'investigating'],
  fixed: ['monitoring', 'reopened'],
  monitoring: ['resolved', 'reopened'],
  resolved: ['reopened'],
  reopened: ['triaged', 'investigating', 'wont_fix'],
  wont_fix: ['reopened'],
  duplicate: ['reopened'],
};

@Injectable()
export class BugCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
    private readonly redact: SafeRedactionService,
    private readonly diagnostics: DiagnosticService,
  ) {}

  async overview(): Promise<Record<string, number | string>> {
    const [open, critical, high, newToday, affected, incidents, waitingReports] = await Promise.all([
      this.prisma.bugGroup.count({ where: { status: { in: ['new', 'triaged', 'investigating', 'fix_in_progress', 'fixed', 'monitoring', 'reopened'] } } }),
      this.prisma.bugGroup.count({ where: { severity: 'critical', status: { notIn: ['resolved', 'wont_fix', 'duplicate'] } } }),
      this.prisma.bugGroup.count({ where: { severity: 'high', status: { notIn: ['resolved', 'wont_fix', 'duplicate'] } } }),
      this.prisma.bugGroup.count({ where: { createdAt: { gte: this.startOfDay() } } }),
      this.prisma.bugGroup.aggregate({ _sum: { affectedUsersCount: true } }),
      this.prisma.incident.count({ where: { status: { not: 'resolved' } } }),
      this.prisma.report.count({ where: { status: 'open' } }),
    ]);
    return {
      openBugs: open,
      criticalBugs: critical,
      highBugs: high,
      newToday,
      affectedUsers: affected._sum.affectedUsersCount ?? 0,
      openIncidents: incidents,
      userReportsWaiting: waitingReports,
      regressions: 0, // regression detection needs a baseline release dataset.
      regressionsStatus: 'NOT_INSTRUMENTED',
    };
  }

  async list(query: BugListQueryDto) {
    const eventFilter: Prisma.ErrorEventWhereInput = {
      ...(query.provider ? { provider: query.provider } : {}),
      ...(query.model ? { model: query.model } : {}),
      ...(query.planSlug ?? query.plan ? { planSlug: query.planSlug ?? query.plan } : {}),
      ...(query.platform ? { platform: query.platform } : {}),
      ...(query.version ? { OR: [{ appVersion: query.version }, { buildVersion: query.version }] } : {}),
    };
    const hasEventFilter = Object.keys(eventFilter).length > 0;
    const lastSeen = query.dateFrom || query.dateTo
      ? { ...(query.dateFrom ? { gte: new Date(query.dateFrom) } : {}), ...(query.dateTo ? { lte: new Date(query.dateTo) } : {}) }
      : undefined;
    const where: Prisma.BugGroupWhereInput = {
      ...(query.status ? { status: query.status } : query.open ? { status: { in: ['new', 'triaged', 'investigating', 'fix_in_progress', 'fixed', 'monitoring', 'reopened'] } } : {}),
      ...(query.severity ? { severity: query.severity } : {}),
      ...(query.source ? { source: query.source } : {}),
      ...(query.feature ? { feature: query.feature } : {}),
      ...(query.environment ? { environment: query.environment } : {}),
      ...(query.assignedToId ? { assignedToId: query.assignedToId } : {}),
      ...(lastSeen ? { lastSeen } : {}),
      ...(hasEventFilter ? { errorEvents: { some: eventFilter } } : {}),
      ...(query.hasDiagnostics === true ? { diagnostics: { some: {} } } : query.hasDiagnostics === false ? { diagnostics: { none: {} } } : {}),
      ...(query.search ? {
        OR: [
          { title: { contains: query.search, mode: 'insensitive' } },
          { feature: { contains: query.search, mode: 'insensitive' } },
        ],
      } : {}),
    };
    const [result, summary] = await Promise.all([this.prisma.$transaction([
      this.prisma.bugGroup.count({ where }),
      this.prisma.bugGroup.findMany({
        where,
        orderBy: this.bugOrder(query.sortBy, query.sortOrder),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: { incident: { select: { id: true, title: true, status: true, severity: true } } },
      }),
    ]), this.overview()]);
    const [total, groups] = result;
    const items = groups.map((group) => this.bugView(group));
    return { items, bugs: items, total, page: query.page, pageSize: query.pageSize, summary };
  }

  /** Server allowlist prevents callers from sorting by sensitive relations. */
  private bugOrder(
    sortBy: BugListQueryDto['sortBy'],
    sortOrder: BugListQueryDto['sortOrder'],
  ): Prisma.BugGroupOrderByWithRelationInput[] {
    const direction = sortOrder ?? 'desc';
    switch (sortBy) {
      case 'firstSeen': return [{ firstSeen: direction }, { lastSeen: 'desc' }];
      case 'occurrenceCount': return [{ occurrenceCount: direction }, { lastSeen: 'desc' }];
      case 'affectedUsersCount': return [{ affectedUsersCount: direction }, { lastSeen: 'desc' }];
      case 'severity': return [{ severity: direction }, { lastSeen: 'desc' }];
      case 'status': return [{ status: direction }, { lastSeen: 'desc' }];
      case 'createdAt': return [{ createdAt: direction }, { lastSeen: 'desc' }];
      case 'lastSeen':
      default: return [{ lastSeen: direction }, { severity: 'desc' }];
    }
  }

  async detail(id: string) {
    const group = await this.prisma.bugGroup.findUnique({
      where: { id },
      include: {
        incident: { select: { id: true, title: true, status: true, severity: true, createdAt: true, resolvedAt: true } },
        comments: { orderBy: { createdAt: 'asc' }, select: { id: true, actorId: true, body: true, createdAt: true } },
      },
    });
    if (!group) throw new NotFoundException('Bug group not found.');
    return {
      ...this.bugView(group),
      comments: group.comments.map((comment) => ({
        id: comment.id,
        actor: this.redact.maskedIdentity(comment.actorId),
        body: this.redact.text(comment.body, 1_024),
        createdAt: comment.createdAt.toISOString(),
      })),
    };
  }

  async events(id: string, page = 1, pageSize = 50, sensitive = false) {
    await this.ensureBug(id);
    const [total, events] = await this.prisma.$transaction([
      this.prisma.errorEvent.count({ where: { bugGroupId: id } }),
      this.prisma.errorEvent.findMany({
        where: { bugGroupId: id },
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true, occurredAt: true, source: true, severity: true, errorCode: true, errorType: true,
          messageSanitized: true, stackFingerprint: true, stackDetailSanitized: sensitive,
          userId: true, requestId: true, operationId: true, route: true, feature: true,
          provider: true, model: true, appVersion: true, buildVersion: true, platform: true,
          quotaState: true, planSlug: true, httpStatus: true, latencyMs: true, retryAttempt: true,
          metadataSanitized: sensitive,
        },
      }),
    ]);
    return {
      items: events.map((event) => ({
        id: event.id,
        occurredAt: event.occurredAt.toISOString(),
        source: event.source,
        severity: event.severity,
        errorCode: event.errorCode,
        errorType: event.errorType,
        message: this.redact.text(event.messageSanitized, 1_024),
        stackFingerprint: event.stackFingerprint,
        ...(sensitive ? { stackDetail: this.redact.text(event.stackDetailSanitized, 2_000), metadata: event.metadataSanitized } : {}),
        user: this.redact.maskedIdentity(event.userId),
        requestId: event.requestId,
        operationId: event.operationId,
        route: event.route,
        feature: event.feature,
        provider: event.provider,
        model: event.model,
        appVersion: event.appVersion,
        buildVersion: event.buildVersion,
        platform: event.platform,
        quotaState: event.quotaState,
        planSlug: event.planSlug,
        httpStatus: event.httpStatus,
        latencyMs: event.latencyMs,
        retryAttempt: event.retryAttempt,
      })),
      total,
      page,
      pageSize,
    };
  }

  async affectedUsers(id: string, page = 1, pageSize = 50) {
    await this.ensureBug(id);
    const [total, users] = await this.prisma.$transaction([
      this.prisma.bugAffectedUser.count({ where: { bugGroupId: id } }),
      this.prisma.bugAffectedUser.findMany({
        where: { bugGroupId: id }, orderBy: { lastAffectedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
      }),
    ]);
    return {
      items: users.map((user) => ({
        identity: this.redact.maskedIdentity(user.userId),
        occurrenceCount: user.occurrenceCount,
        firstAffectedAt: user.firstAffectedAt.toISOString(),
        lastAffectedAt: user.lastAffectedAt.toISOString(),
      })),
      total,
      page,
      pageSize,
    };
  }

  async setStatus(id: string, dto: UpdateBugStatusDto, actor: AdminIdentity, context: AuditContext) {
    const group = await this.ensureBug(id);
    if (dto.status === 'duplicate') throw new BadRequestException('Use the duplicate workflow.');
    if (!STATUS_TRANSITIONS[group.status].includes(dto.status)) throw new BadRequestException(`Invalid transition from ${group.status} to ${dto.status}.`);
    if (dto.status === 'wont_fix' && !dto.reason) throw new BadRequestException('A reason is required for WONT_FIX.');
    if (dto.status === 'fixed' && !dto.fixReference && !dto.targetRelease) throw new BadRequestException('A fix reference or target release is required for FIXED.');
    const reason = this.redact.text(dto.reason, 1_024);
    const updated = await this.prisma.$transaction(async (tx) => {
      const item = await tx.bugGroup.update({
        where: { id },
        data: {
          status: dto.status,
          fixReference: this.redact.boundedIdentifier(dto.fixReference),
          targetRelease: this.redact.boundedIdentifier(dto.targetRelease),
          resolutionNote: dto.status === 'resolved' || dto.status === 'wont_fix' ? reason : undefined,
        },
      });
      if (reason) await tx.bugComment.create({ data: { bugGroupId: id, actorId: actor.userId, body: reason } });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: 'BUG_STATUS_CHANGED', targetType: 'bug_group', targetId: id,
        before: { status: group.status }, after: { status: dto.status, fixReference: dto.fixReference ?? null, targetRelease: dto.targetRelease ?? null }, reason: reason ?? undefined,
      }) });
      return item;
    });
    return this.bugView(updated);
  }

  async triage(id: string, reason: string | undefined, actor: AdminIdentity, context: AuditContext) {
    const group = await this.ensureBug(id);
    if (group.status === 'triaged') return this.bugView(group);
    if (group.status !== 'new' && group.status !== 'reopened') {
      throw new BadRequestException(`Bug ${group.status} cannot be triaged directly.`);
    }
    return this.setStatus(id, { status: 'triaged', reason }, actor, context);
  }

  async assign(id: string, dto: AssignBugDto, actor: AdminIdentity, context: AuditContext) {
    const group = await this.ensureBug(id);
    const assignedToId = dto.assignedToId ?? dto.assigneeId;
    if (!assignedToId) throw new BadRequestException('An assignee is required.');
    const assignment = await this.prisma.adminRoleAssignment.findFirst({ where: { userId: assignedToId, revokedAt: null } });
    if (!assignment) throw new BadRequestException('Assignee must be an active admin.');
    const reason = this.redact.text(dto.reason, 1_024);
    const item = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.bugGroup.update({ where: { id }, data: { assignedToId } });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: 'BUG_ASSIGNED', targetType: 'bug_group', targetId: id,
        before: { assigned: this.redact.maskedIdentity(group.assignedToId) },
        after: { assigned: this.redact.maskedIdentity(assignedToId) }, reason: reason ?? undefined,
      }) });
      return updated;
    });
    return this.bugView(item);
  }

  async markDuplicate(id: string, dto: MarkDuplicateDto, actor: AdminIdentity, context: AuditContext) {
    const group = await this.ensureBug(id);
    const duplicateOfId = dto.duplicateOfId ?? dto.duplicateOf;
    if (!duplicateOfId) throw new BadRequestException('A duplicate target is required.');
    if (id === duplicateOfId) throw new BadRequestException('A bug cannot be its own duplicate.');
    await this.ensureBug(duplicateOfId);
    const reason = this.redact.text(dto.reason, 1_024);
    if (!reason) throw new BadRequestException('A reason is required for duplicate workflow.');
    const item = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.bugGroup.update({ where: { id }, data: { status: 'duplicate', duplicateOfId, resolutionNote: reason } });
      await tx.bugComment.create({ data: { bugGroupId: id, actorId: actor.userId, body: reason } });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: 'BUG_MARKED_DUPLICATE', targetType: 'bug_group', targetId: id,
        before: { status: group.status }, after: { duplicateOf: duplicateOfId }, reason,
      }) });
      return updated;
    });
    return this.bugView(item);
  }

  async diagnose(id: string, actor: AdminIdentity, context: AuditContext, kind: 'rule_based' | 'ai_assisted' = 'rule_based', reason?: string): Promise<DiagnosticView> {
    const diagnostic = kind === 'rule_based'
      ? await this.diagnostics.ruleBased(id, actor.userId)
      : await this.diagnostics.unavailableAiAssist(id, actor.userId);
    await this.audit.record(context, {
      action: kind === 'rule_based' ? 'BUG_RULE_DIAGNOSTIC_RUN' : 'BUG_AI_DIAGNOSTIC_REQUESTED',
      targetType: 'bug_group', targetId: id,
      after: { diagnosticId: diagnostic.id, kind, status: diagnostic.status, confidence: diagnostic.confidence },
      reason: this.redact.text(reason, 1_024) ?? undefined,
    });
    return diagnostic;
  }

  diagnosticsFor(id: string): Promise<DiagnosticView[]> {
    return this.diagnostics.list(id);
  }

  async listSupport(query: SupportCaseListQueryDto, actorId?: string) {
    if (query.view === 'reports') return this.listUserReports(query);
    const status = this.supportStatus(query.status);
    const where: Prisma.SupportCaseWhereInput = {
      ...(status ? { status } : {}),
      ...(query.assignee === 'me' && actorId ? { assignedToId: actorId } : {}),
    };
    const page = query.page;
    const pageSize = query.pageSize;
    const [total, cases] = await this.prisma.$transaction([
      this.prisma.supportCase.count({ where }),
      this.prisma.supportCase.findMany({
        where, orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        include: { report: { select: { id: true, category: true, status: true, createdAt: true } }, bugGroup: { select: { id: true, title: true, status: true, severity: true } } },
      }),
    ]);
    const items = cases.map((item) => this.caseView(item));
    return { items, cases: items, total, page, pageSize };
  }

  private async listUserReports(query: SupportCaseListQueryDto) {
    const reportStatuses = ['open', 'reviewed', 'dismissed'] as const;
    const status = reportStatuses.includes(query.status as typeof reportStatuses[number]) ? query.status as typeof reportStatuses[number] : undefined;
    const where = status ? { status } : {};
    const [total, reports] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true, reporterId: true, category: true, status: true, createdAt: true, reviewedAt: true,
          correlationStatus: true, correlationConfidence: true, bugGroupId: true,
          bugGroup: { select: { id: true, title: true, status: true, severity: true } },
        },
      }),
    ]);
    const items = reports.map((report) => ({
      id: report.id,
      displayId: `REPORT-${report.id.slice(-8).toUpperCase()}`,
      reporter: this.redact.maskedIdentity(report.reporterId),
      category: report.category,
      status: report.status,
      createdAt: report.createdAt.toISOString(),
      reviewedAt: report.reviewedAt?.toISOString() ?? null,
      correlationStatus: report.correlationStatus,
      correlationConfidence: report.correlationConfidence,
      bugGroup: report.bugGroup ? { id: report.bugGroup.id, title: this.redact.text(report.bugGroup.title, 180), status: report.bugGroup.status, severity: report.bugGroup.severity } : report.bugGroupId ? { id: report.bugGroupId } : null,
      untrusted: true,
      content: 'REDACTED',
    }));
    return { items, reports: items, total, page: query.page, pageSize: query.pageSize };
  }

  async createSupport(dto: CreateSupportCaseDto, actor: AdminIdentity, context: AuditContext) {
    const user = await this.prisma.user.findUnique({ where: { id: dto.userId }, select: { id: true } });
    if (!user) throw new NotFoundException('User not found.');
    if (dto.reportId) {
      const report = await this.prisma.report.findFirst({ where: { id: dto.reportId, reporterId: dto.userId }, select: { id: true } });
      if (!report) throw new BadRequestException('Report does not belong to user.');
    }
    if (dto.bugGroupId) await this.ensureBug(dto.bugGroupId);
    const supportCase = await this.prisma.$transaction(async (tx) => {
      const created = await tx.supportCase.create({ data: { userId: dto.userId, reportId: dto.reportId ?? null, bugGroupId: dto.bugGroupId ?? null, priority: dto.priority ?? 'medium' } });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: 'SUPPORT_CASE_CREATED', targetType: 'support_case', targetId: created.id,
        after: { user: this.redact.maskedIdentity(dto.userId), reportId: dto.reportId ?? null, bugGroupId: dto.bugGroupId ?? null, priority: dto.priority ?? 'medium' },
      }) });
      return created;
    });
    return this.caseView(supportCase);
  }

  async updateSupport(id: string, dto: UpdateSupportCaseDto, actor: AdminIdentity, context: AuditContext) {
    const before = await this.prisma.supportCase.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Support case not found.');
    if (dto.assignedToId) {
      const assignment = await this.prisma.adminRoleAssignment.findFirst({ where: { userId: dto.assignedToId, revokedAt: null } });
      if (!assignment) throw new BadRequestException('Assignee must be an active admin.');
    }
    const note = this.redact.text(dto.note ?? dto.reason, 1_024);
    const supportCase = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.supportCase.update({
        where: { id },
        data: {
          status: dto.status,
          priority: dto.priority,
          assignedToId: dto.assignedToId,
          resolvedAt: dto.status === 'resolved' || dto.status === 'closed' ? new Date() : undefined,
        },
      });
      if (note) await tx.supportCaseNote.create({ data: { supportCaseId: id, actorId: actor.userId, body: note } });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: 'SUPPORT_CASE_UPDATED', targetType: 'support_case', targetId: id,
        before: { status: before.status, priority: before.priority },
        after: { status: updated.status, priority: updated.priority }, reason: note ?? undefined,
      }) });
      return updated;
    });
    return this.caseView(supportCase);
  }

  async listIncidents(page = 1, pageSize = 25) {
    const [total, incidents] = await this.prisma.$transaction([
      this.prisma.incident.count(),
      this.prisma.incident.findMany({
        orderBy: { updatedAt: 'desc' }, skip: (page - 1) * pageSize, take: pageSize,
        include: { _count: { select: { bugGroups: true } } },
      }),
    ]);
    const items = incidents.map((incident) => this.incidentView(incident));
    return { items, incidents: items, total, page, pageSize };
  }

  async incidentDetail(id: string) {
    const incident = await this.prisma.incident.findUnique({
      where: { id },
      include: {
        bugGroups: { select: { id: true, title: true, status: true, severity: true, lastSeen: true } },
        timeline: { orderBy: { createdAt: 'asc' }, select: { id: true, actorId: true, type: true, note: true, createdAt: true } },
      },
    });
    if (!incident) throw new NotFoundException('Incident not found.');
    return {
      ...this.incidentView(incident),
      bugGroups: incident.bugGroups.map((bug) => ({ ...bug, lastSeen: bug.lastSeen.toISOString() })),
      timeline: incident.timeline.map((event) => ({ id: event.id, actor: this.redact.maskedIdentity(event.actorId), type: event.type, note: this.redact.text(event.note, 1_024), createdAt: event.createdAt.toISOString() })),
    };
  }

  async createIncident(dto: CreateIncidentControlDto, actor: AdminIdentity, context: AuditContext) {
    const title = this.redact.text(dto.title, 180);
    if (!title) throw new BadRequestException('Incident title is required.');
    if (dto.assignedToId) {
      const assignment = await this.prisma.adminRoleAssignment.findFirst({ where: { userId: dto.assignedToId, revokedAt: null } });
      if (!assignment) throw new BadRequestException('Assignee must be an active admin.');
    }
    const incident = await this.prisma.$transaction(async (tx) => {
      const created = await tx.incident.create({ data: { title, description: this.redact.text(dto.description, 2_000), severity: dto.severity, status: 'investigating', assignedToId: dto.assignedToId ?? null } });
      if (dto.bugGroupIds?.length) await tx.bugGroup.updateMany({ where: { id: { in: dto.bugGroupIds } }, data: { incidentId: created.id } });
      await tx.incidentTimelineEvent.create({ data: { incidentId: created.id, actorId: actor.userId, type: 'created', note: 'Incident created after human review.' } });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: 'INCIDENT_CREATED', targetType: 'incident', targetId: created.id,
        after: { severity: dto.severity, bugCount: dto.bugGroupIds?.length ?? 0 },
      }) });
      return created;
    });
    return this.incidentView(incident);
  }

  async updateIncidentStatus(id: string, dto: UpdateIncidentStatusControlDto, actor: AdminIdentity, context: AuditContext) {
    const before = await this.prisma.incident.findUnique({ where: { id } });
    if (!before) throw new NotFoundException('Incident not found.');
    const note = this.redact.text(dto.note ?? dto.reason, 1_024);
    const now = new Date();
    const incident = await this.prisma.$transaction(async (tx) => {
      const updated = await tx.incident.update({
        where: { id },
        data: {
          status: dto.status,
          ...(dto.status === 'identified' ? { identifiedAt: now } : {}),
          ...(dto.status === 'monitoring' ? { monitoringAt: now } : {}),
          ...(dto.status === 'resolved' ? { resolvedAt: now } : {}),
        },
      });
      await tx.incidentTimelineEvent.create({ data: { incidentId: id, actorId: actor.userId, type: 'status_changed', note } });
      await tx.auditLog.create({ data: this.audit.auditData(context, {
        action: 'INCIDENT_STATUS_CHANGED', targetType: 'incident', targetId: id,
        before: { status: before.status }, after: { status: dto.status }, reason: note ?? undefined,
      }) });
      return updated;
    });
    return this.incidentView(incident);
  }

  private async ensureBug(id: string) {
    const group = await this.prisma.bugGroup.findUnique({ where: { id } });
    if (!group) throw new NotFoundException('Bug group not found.');
    return group;
  }

  private bugView(group: {
    id: string; title: string; status: BugStatus; severity: ErrorSeverity; source: unknown; feature: string | null;
    firstSeen: Date; lastSeen: Date; occurrenceCount: number; affectedUsersCount: number; incidentId: string | null;
    assignedToId: string | null; duplicateOfId: string | null; fixReference: string | null; targetRelease: string | null;
    resolutionNote: string | null; createdAt: Date; updatedAt: Date; incident?: { id: string; title: string; status: unknown; severity: unknown } | null;
  }) {
    return {
      id: group.id,
      displayId: `BUG-${group.id.slice(-8).toUpperCase()}`,
      title: this.redact.text(group.title, 180),
      status: group.status,
      severity: group.severity,
      source: group.source,
      feature: group.feature,
      firstSeen: group.firstSeen.toISOString(),
      lastSeen: group.lastSeen.toISOString(),
      occurrenceCount: group.occurrenceCount,
      affectedUsersCount: group.affectedUsersCount,
      incident: group.incident ? { ...group.incident } : group.incidentId ? { id: group.incidentId } : null,
      assignedTo: this.redact.maskedIdentity(group.assignedToId),
      duplicateOfId: group.duplicateOfId,
      fixReference: group.fixReference,
      targetRelease: group.targetRelease,
      resolutionNote: this.redact.text(group.resolutionNote, 1_024),
      createdAt: group.createdAt.toISOString(),
      updatedAt: group.updatedAt.toISOString(),
    };
  }

  private caseView(item: {
    id: string; userId: string; reportId: string | null; bugGroupId: string | null; status: SupportCaseStatus;
    priority: SupportCasePriority; assignedToId: string | null; createdAt: Date; updatedAt: Date; resolvedAt: Date | null;
    report?: { id: string; category: string; status: unknown; createdAt: Date } | null;
    bugGroup?: { id: string; title: string; status: unknown; severity: unknown } | null;
  }) {
    return {
      id: item.id,
      user: this.redact.maskedIdentity(item.userId),
      reportId: item.reportId,
      bugGroup: item.bugGroup ? { id: item.bugGroup.id, title: this.redact.text(item.bugGroup.title, 180), status: item.bugGroup.status, severity: item.bugGroup.severity } : item.bugGroupId ? { id: item.bugGroupId } : null,
      status: item.status,
      priority: item.priority,
      assignedTo: this.redact.maskedIdentity(item.assignedToId),
      createdAt: item.createdAt.toISOString(),
      updatedAt: item.updatedAt.toISOString(),
      resolvedAt: item.resolvedAt?.toISOString() ?? null,
      report: item.report ? { id: item.report.id, category: item.report.category, status: item.report.status, createdAt: item.report.createdAt.toISOString(), untrusted: true, content: 'REDACTED' } : null,
    };
  }

  private incidentView(incident: {
    id: string; title: string; description: string | null; severity: IncidentSeverity; status: IncidentStatus;
    assignedToId: string | null; acknowledgedAt: Date | null; identifiedAt: Date | null; monitoringAt: Date | null; resolvedAt: Date | null;
    createdAt: Date; updatedAt: Date; _count?: { bugGroups: number };
  }) {
    return {
      id: incident.id,
      displayId: `INC-${incident.id.slice(-8).toUpperCase()}`,
      title: this.redact.text(incident.title, 180),
      description: this.redact.text(incident.description, 2_000),
      severity: incident.severity,
      status: incident.status,
      assignedTo: this.redact.maskedIdentity(incident.assignedToId),
      acknowledgedAt: incident.acknowledgedAt?.toISOString() ?? null,
      identifiedAt: incident.identifiedAt?.toISOString() ?? null,
      monitoringAt: incident.monitoringAt?.toISOString() ?? null,
      resolvedAt: incident.resolvedAt?.toISOString() ?? null,
      bugCount: incident._count?.bugGroups ?? undefined,
      createdAt: incident.createdAt.toISOString(),
      updatedAt: incident.updatedAt.toISOString(),
    };
  }

  private startOfDay(): Date {
    const result = new Date();
    result.setHours(0, 0, 0, 0);
    return result;
  }

  private supportStatus(value?: string): SupportCaseStatus | undefined {
    const allowed: readonly SupportCaseStatus[] = ['open', 'in_progress', 'waiting_for_user', 'waiting_for_engineering', 'resolved', 'closed'];
    return allowed.includes(value as SupportCaseStatus) ? value as SupportCaseStatus : undefined;
  }
}
