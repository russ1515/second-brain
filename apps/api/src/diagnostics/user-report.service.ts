import { BadRequestException, Injectable } from '@nestjs/common';
import {
  DiagnosticConfidence,
  Prisma,
  ReportCorrelationStatus,
  type ReportStatus,
  type SupportCaseStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContextService } from '../common/request-context.service';
import { PrivateMediaService } from '../media/private-media.service';
import { SafeRedactionService } from './safe-redaction.service';
import type { CreateUserReportDto, UserReportListQueryDto } from './dto/diagnostics.dto';

export type UserReportTrackingStatus =
  | 'RECEIVED'
  | 'IN_REVIEW'
  | 'NEEDS_INFORMATION'
  | 'RESOLVED'
  | 'CLOSED';

export interface CreatedUserReport {
  id: string;
  trackingId: string;
  status: UserReportTrackingStatus;
  screenshotAvailable: boolean;
  correlationStatus: ReportCorrelationStatus;
  correlationConfidence: DiagnosticConfidence;
  /** Automatic/richer diagnostics remain unavailable. A screenshot is a
   * separate, explicit owner upload and is reported by screenshotAvailable. */
  additionalDiagnostics: 'NOT_INSTRUMENTED';
}

/**
 * Persists a deliberately small, sanitized support signal.  A report is
 * untrusted user-authored data: it is never interpreted as a command, prompt,
 * diagnosis, or authorization to retrieve other user material.
 */
@Injectable()
export class UserReportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly context: RequestContextService,
    private readonly redact: SafeRedactionService,
    private readonly media: PrivateMediaService,
  ) {}

  async create(reporterId: string, dto: CreateUserReportDto): Promise<CreatedUserReport> {
    const message = this.redact.text(dto.message, 2_000);
    if (!message) throw new BadRequestException('A non-empty report message is required.');

    const category = this.redact.boundedIdentifier(dto.category, 40) ?? 'other';
    const current = this.context.current();
    const legacyObservedRequestId = this.redact.boundedIdentifier(dto.requestId);
    const observedRequestId = this.redact.boundedIdentifier(dto.observedRequestId) ?? legacyObservedRequestId;
    // New clients keep the report submission ID distinct from the prior failed
    // request. Historic clients used requestId for both purposes, which is
    // retained only as a narrowly scoped compatibility path.
    const submissionRequestId = dto.observedRequestId
      ? current?.requestId ?? null
      : legacyObservedRequestId ?? current?.requestId ?? null;
    const route = this.redact.route(dto.route);
    const environment = this.environment();
    const correlationSince = new Date(Date.now() - 30 * 60 * 1_000);
    const correlationUntil = new Date(Date.now() + 5 * 60 * 1_000);

    for (let attempt = 0; attempt < 4; attempt += 1) {
      try {
        const created = await this.prisma.$transaction(async (tx) => {
          if (submissionRequestId) {
            // No schema migration is needed: serialize one logical report key
            // before the lookup so concurrent client retries cannot create two
            // Reports or two SupportCases.
            const lockKey = `user-report:${reporterId}:${submissionRequestId}`;
            await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
          }
          // A retry from the same logical client request is idempotent.  The
          // caller can never choose the reporter identity.
          if (submissionRequestId) {
            const existing = await tx.report.findFirst({
              where: { reporterId, requestId: submissionRequestId },
              select: {
                id: true,
                bugGroupId: true,
                correlationStatus: true,
                correlationConfidence: true,
                supportCases: {
                  orderBy: { updatedAt: 'desc' },
                  take: 1,
                  select: { status: true },
                },
              },
            });
            if (existing) {
              const supportCase = existing.supportCases[0] ?? await tx.supportCase.create({
                data: {
                  userId: reporterId,
                  reportId: existing.id,
                  bugGroupId: existing.bugGroupId,
                },
                select: { status: true },
              });
              return this.created(existing, supportCase.status);
            }
          }

          // Exact, same-user request correlation only.  We intentionally do
          // not guess from text, device, timing, route, or similar reports.
          const event = observedRequestId
            ? await tx.errorEvent.findFirst({
              where: {
                environment,
                requestId: observedRequestId,
                userId: reporterId,
                occurredAt: { gte: correlationSince, lte: correlationUntil },
                ...(route ? { route } : {}),
                ...(current?.sessionId ? { sessionId: current.sessionId } : {}),
              },
              orderBy: { occurredAt: 'desc' },
              select: { bugGroupId: true },
            })
            : null;
          const linked = Boolean(event?.bugGroupId);
          const report = await tx.report.create({
            data: {
              reporterId,
              category,
              message,
              requestId: submissionRequestId,
              observedRequestId,
              // A report never selects a server operation ID.
              operationId: null,
              route,
              feature: this.redact.boundedIdentifier(dto.feature),
              appVersion: this.redact.boundedIdentifier(dto.appVersion),
              buildVersion: this.redact.boundedIdentifier(dto.buildVersion),
              platform: this.redact.boundedIdentifier(dto.platform),
              environment,
              consentAdditionalDiagnostics: dto.consentAdditionalDiagnostics === true,
              correlationStatus: linked ? ReportCorrelationStatus.linked : ReportCorrelationStatus.independent,
              correlationConfidence: linked ? DiagnosticConfidence.high : DiagnosticConfidence.unconfirmed,
              bugGroupId: event?.bugGroupId ?? null,
              linkedAt: linked ? new Date() : null,
              linkedById: null,
            },
            select: { id: true, correlationStatus: true, correlationConfidence: true },
          });
          const supportCase = await tx.supportCase.create({
            data: {
              userId: reporterId,
              reportId: report.id,
              bugGroupId: event?.bugGroupId ?? null,
            },
            select: { status: true },
          });
          return this.created(report, supportCase.status);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
        return {
          ...created,
          screenshotAvailable: await this.media.hasReportScreenshot(reporterId, created.id),
        };
      } catch (error) {
        if (attempt < 3 && (error as { code?: string }).code === 'P2034') continue;
        throw error;
      }
    }
    throw new Error('User report transaction retry exhausted');
  }

  async list(reporterId: string, query: UserReportListQueryDto) {
    const page = query.page;
    const pageSize = query.pageSize;
    const where = { reporterId };
    const [total, reports] = await this.prisma.$transaction([
      this.prisma.report.count({ where }),
      this.prisma.report.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          category: true,
          status: true,
          correlationStatus: true,
          createdAt: true,
          supportCases: {
            orderBy: { updatedAt: 'desc' },
            take: 1,
            select: { status: true, updatedAt: true },
          },
        },
      }),
    ]);
    const items = await Promise.all(reports.map(async (report) => {
      const supportCase = report.supportCases[0];
      return {
        trackingId: reportTrackingId(report.id),
        category: report.category,
        status: supportCase
          ? userTrackingStatus(supportCase.status)
          : legacyReportTrackingStatus(report.status),
        correlationStatus: report.correlationStatus,
        screenshotAvailable: await this.media.hasReportScreenshot(reporterId, report.id),
        createdAt: report.createdAt.toISOString(),
        updatedAt: (supportCase?.updatedAt ?? report.createdAt).toISOString(),
      };
    }));
    return { items, page, pageSize, total, totalPages: Math.ceil(total / pageSize) };
  }

  private created(
    value: { id: string; correlationStatus: ReportCorrelationStatus; correlationConfidence: DiagnosticConfidence },
    status: SupportCaseStatus,
  ): CreatedUserReport {
    return {
      id: value.id,
      trackingId: reportTrackingId(value.id),
      status: userTrackingStatus(status),
      screenshotAvailable: false,
      correlationStatus: value.correlationStatus,
      correlationConfidence: value.correlationConfidence,
      additionalDiagnostics: 'NOT_INSTRUMENTED',
    };
  }

  private environment(): string {
    const value = process.env.NODE_ENV ?? 'development';
    return /^[a-z0-9_-]{1,32}$/i.test(value) ? value.toLowerCase() : 'unknown';
  }
}

export function reportTrackingId(id: string): string {
  const opaque = id.replace(/[^a-z0-9]/gi, '').toUpperCase();
  return `SB-REPORT-${opaque || 'UNKNOWN'}`;
}

export function userTrackingStatus(status: SupportCaseStatus): UserReportTrackingStatus {
  switch (status) {
    case 'in_progress':
    case 'waiting_for_engineering':
      return 'IN_REVIEW';
    case 'waiting_for_user':
      return 'NEEDS_INFORMATION';
    case 'resolved':
      return 'RESOLVED';
    case 'closed':
      return 'CLOSED';
    case 'open':
    default:
      return 'RECEIVED';
  }
}

function legacyReportTrackingStatus(status: ReportStatus): UserReportTrackingStatus {
  if (status === 'reviewed') return 'RESOLVED';
  if (status === 'dismissed') return 'CLOSED';
  return 'RECEIVED';
}
