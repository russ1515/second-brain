import { Injectable, NotFoundException } from '@nestjs/common';
import { DiagnosticConfidence, DiagnosticKind, DiagnosticStatus, ErrorEventSource, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Deterministic, evidence-first diagnosis.  It intentionally does not infer a
 * root cause: outputs distinguish observed facts, correlations and hypotheses.
 */
@Injectable()
export class DiagnosticService {
  constructor(private readonly prisma: PrismaService) {}

  async ruleBased(bugGroupId: string, requestedById?: string): Promise<DiagnosticView> {
    const bug = await this.prisma.bugGroup.findUnique({
      where: { id: bugGroupId },
      include: {
        errorEvents: {
          orderBy: { occurredAt: 'desc' },
          take: 200,
          select: {
            id: true, source: true, errorCode: true, provider: true, model: true,
            appVersion: true, buildVersion: true, route: true, feature: true,
            occurredAt: true, latencyMs: true, quotaState: true,
          },
        },
      },
    });
    if (!bug) throw new NotFoundException('Bug group not found.');

    const events = bug.errorEvents;
    const providerEvents = events.filter((event) => event.source === ErrorEventSource.provider);
    const timeoutEvents = events.filter((event) => /timeout/i.test(event.errorCode ?? ''));
    const unexpectedQuotaEvents = events.filter((event) => event.errorCode === 'PROVIDER_USAGE_AFTER_QUOTA_BLOCK');
    const versions = this.count(events.map((event) => event.appVersion ?? event.buildVersion).filter(Boolean) as string[]);
    const providers = this.count(events.map((event) => event.provider).filter(Boolean) as string[]);

    const observed = [
      `${bug.occurrenceCount} occurrence(s) recorded for this fingerprint.`,
      `${bug.affectedUsersCount} affected user(s) recorded.`,
      `First seen ${bug.firstSeen.toISOString()}; last seen ${bug.lastSeen.toISOString()}.`,
      ...(timeoutEvents.length ? [`${timeoutEvents.length} event(s) carry a timeout error code.`] : []),
      ...(unexpectedQuotaEvents.length ? [`${unexpectedQuotaEvents.length} event(s) indicate provider usage after quota block.`] : []),
    ];
    const correlated = [
      ...this.correlationLines('Provider', providers),
      ...this.correlationLines('Release', versions),
      ...(providerEvents.length ? [`${providerEvents.length} sampled event(s) are provider-originated.`] : []),
    ];
    const hypotheses = [
      ...(timeoutEvents.length && providerEvents.length
        ? [{ statement: 'Provider latency or timeout behavior may contribute.', confidence: 'medium' as const }]
        : []),
      ...(unexpectedQuotaEvents.length
        ? [{ statement: 'A provider-call guard after quota blocking requires technical review.', confidence: 'high' as const }]
        : []),
    ];
    const evidence = events.slice(0, 50).map((event) => ({
      eventId: event.id,
      occurredAt: event.occurredAt.toISOString(),
      source: event.source,
      errorCode: event.errorCode,
      provider: event.provider,
      model: event.model,
      version: event.appVersion ?? event.buildVersion,
      route: event.route,
      feature: event.feature,
    }));
    const nextChecks = [
      'Review sanitized Error Event details and provider-attempt correlation where authorized.',
      'Compare health and release telemetry when those measurements are available.',
      'Do not mark a hypothesis CONFIRMED without independent technical proof.',
      'System-health history is NOT_INSTRUMENTED in this diagnostic result unless a durable health sample exists.',
    ];

    const confidence: DiagnosticConfidence = hypotheses.some((item) => item.confidence === 'high')
      ? 'high'
      : hypotheses.length ? 'medium' : 'unconfirmed';
    const diagnostic = await this.prisma.bugDiagnostic.create({
      data: {
        bugGroupId,
        kind: DiagnosticKind.rule_based,
        status: DiagnosticStatus.available,
        confidence,
        observed: observed as Prisma.InputJsonValue,
        correlated: correlated as Prisma.InputJsonValue,
        hypotheses: hypotheses as Prisma.InputJsonValue,
        evidence: evidence as Prisma.InputJsonValue,
        nextChecks: nextChecks as Prisma.InputJsonValue,
        requestedById: requestedById ?? null,
      },
    });
    return this.view(diagnostic);
  }

  /**
   * Foundation for the manual AI action.  There is no silent model call: until
   * an approved, metered diagnostic route is configured this records an explicit
   * NOT_AVAILABLE result, preserving the manual trigger/audit boundary.
   */
  async unavailableAiAssist(bugGroupId: string, requestedById?: string): Promise<DiagnosticView> {
    const exists = await this.prisma.bugGroup.count({ where: { id: bugGroupId } });
    if (!exists) throw new NotFoundException('Bug group not found.');
    const diagnostic = await this.prisma.bugDiagnostic.create({
      data: {
        bugGroupId,
        kind: DiagnosticKind.ai_assisted,
        status: DiagnosticStatus.not_available,
        confidence: DiagnosticConfidence.unconfirmed,
        observed: ['AI-assisted diagnosis was manually requested.'],
        correlated: [],
        hypotheses: [],
        evidence: ['No model call was performed.'],
        nextChecks: [
          'Configure an approved, metered ADMIN_DIAGNOSTIC provider route before enabling this action.',
          'Any future model context must contain only sanitized structured telemetry; user reports remain untrusted data.',
        ],
        requestedById: requestedById ?? null,
      },
    });
    return this.view(diagnostic);
  }

  async list(bugGroupId: string): Promise<DiagnosticView[]> {
    const items = await this.prisma.bugDiagnostic.findMany({ where: { bugGroupId }, orderBy: { createdAt: 'desc' }, take: 100 });
    return items.map((item) => this.view(item));
  }

  private view(diagnostic: {
    id: string; kind: DiagnosticKind; status: DiagnosticStatus; confidence: DiagnosticConfidence;
    observed: Prisma.JsonValue | null; correlated: Prisma.JsonValue | null; hypotheses: Prisma.JsonValue | null;
    evidence: Prisma.JsonValue | null; nextChecks: Prisma.JsonValue | null; createdAt: Date;
  }): DiagnosticView {
    return {
      id: diagnostic.id,
      kind: diagnostic.kind,
      status: diagnostic.status,
      confidence: diagnostic.confidence,
      observed: this.array(diagnostic.observed),
      correlated: this.array(diagnostic.correlated),
      hypotheses: this.array(diagnostic.hypotheses),
      evidence: this.array(diagnostic.evidence),
      nextChecks: this.array(diagnostic.nextChecks),
      createdAt: diagnostic.createdAt.toISOString(),
    };
  }

  private array(value: Prisma.JsonValue | null): unknown[] {
    return Array.isArray(value) ? value : [];
  }

  private count(values: string[]): Map<string, number> {
    return values.reduce((counts, value) => counts.set(value, (counts.get(value) ?? 0) + 1), new Map<string, number>());
  }

  private correlationLines(label: string, values: Map<string, number>): string[] {
    return [...values.entries()]
      .sort((left, right) => right[1] - left[1])
      .slice(0, 5)
      .map(([value, count]) => `${label} ${value}: ${count} sampled event(s).`);
  }
}

export interface DiagnosticView {
  id: string;
  kind: DiagnosticKind;
  status: DiagnosticStatus;
  confidence: DiagnosticConfidence;
  observed: unknown[];
  correlated: unknown[];
  hypotheses: unknown[];
  evidence: unknown[];
  nextChecks: unknown[];
  createdAt: string;
}
