import { BadRequestException, Injectable } from '@nestjs/common';
import { DiagnosticConfidence, Prisma, ReportCorrelationStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { RequestContextService } from '../common/request-context.service';
import { SafeRedactionService } from './safe-redaction.service';
import type { CreateUserReportDto } from './dto/diagnostics.dto';

export interface CreatedUserReport {
  id: string;
  correlationStatus: ReportCorrelationStatus;
  correlationConfidence: DiagnosticConfidence;
  /** Attachments and richer client context remain deliberately unavailable. */
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
        return await this.prisma.$transaction(async (tx) => {
          // A retry from the same logical client request is idempotent.  The
          // caller can never choose the reporter identity.
          if (submissionRequestId) {
            const existing = await tx.report.findFirst({
              where: { reporterId, requestId: submissionRequestId },
              select: { id: true, correlationStatus: true, correlationConfidence: true },
            });
            if (existing) return this.created(existing);
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
          return this.created(report);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      } catch (error) {
        if (attempt < 3 && (error as { code?: string }).code === 'P2034') continue;
        throw error;
      }
    }
    throw new Error('User report transaction retry exhausted');
  }

  private created(value: { id: string; correlationStatus: ReportCorrelationStatus; correlationConfidence: DiagnosticConfidence }): CreatedUserReport {
    return {
      id: value.id,
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
