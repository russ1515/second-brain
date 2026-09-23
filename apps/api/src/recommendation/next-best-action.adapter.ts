import { Injectable } from '@nestjs/common';
import type {
  ActionDestination,
  ExpectedImpact,
  NextBestAction,
  NextBestActionAlternative,
  RecommendationReason,
  RecommendationTarget,
  ResourceRecommendation,
} from '@second-brain/shared';

const RECOMMENDATION_VALIDITY_MS = 7 * 86_400_000;

const RECOMMENDATION_PRIORITY: Record<ResourceRecommendation['kind'], number> = {
  exercise: 700,
  review: 680,
  lesson: 600,
  reading: 450,
  practical: 400,
  document: 350,
};

/** A deterministic candidate supplied by a real business engine. */
export interface NextBestActionCandidate {
  id?: string;
  title: string;
  actionLabel: string;
  destination: ActionDestination;
  reason: string;
  estimatedDuration?: number | null;
  expectedImpact?: ExpectedImpact | null;
  signals: RecommendationReason[];
  priority: number;
  validUntil?: string | null;
  confidence?: number | null;
  source: NextBestAction['source'];
  /** Lets equivalent intents from different engines converge despite route differences. */
  dedupeKey?: string;
}

/**
 * Normalizes and ranks factual candidates. It never calls an LLM and never
 * creates a recommendation: empty or expired input yields null.
 */
@Injectable()
export class NextBestActionAdapter {
  fromRecommendations(
    recommendations: readonly ResourceRecommendation[],
    now = new Date(),
  ): NextBestAction | null {
    return this.fromCandidates(this.candidatesFromRecommendations(recommendations), now);
  }

  candidatesFromRecommendations(
    recommendations: readonly ResourceRecommendation[],
  ): NextBestActionCandidate[] {
    return recommendations
      .map((recommendation) => ({
        recommendation,
        destination: this.destination(recommendation.target),
      }))
      .filter(
        (candidate): candidate is {
          recommendation: ResourceRecommendation;
          destination: ActionDestination;
        } => candidate.destination !== null,
      )
      .map(({ recommendation, destination }, index) => ({
        id: recommendation.id,
        title: recommendation.title,
        actionLabel: recommendation.title,
        destination,
        reason: recommendation.reason,
        estimatedDuration: null,
        expectedImpact: null,
        signals: [
          {
            signal: `recommendation:${recommendation.kind}`,
            humanLabel: recommendation.reason,
            evidence: recommendation.reason,
            source: 'recommendation-engine',
            timestamp: recommendation.createdAt,
          },
        ],
        priority: RECOMMENDATION_PRIORITY[recommendation.kind] - index,
        validUntil: validUntilAfter(recommendation.createdAt, RECOMMENDATION_VALIDITY_MS),
        confidence: null,
        source: { kind: 'recommendation-engine' as const, id: recommendation.id },
        dedupeKey: this.recommendationDedupeKey(recommendation, destination),
      }));
  }

  fromCandidates(
    candidates: readonly NextBestActionCandidate[],
    now = new Date(),
  ): NextBestAction | null {
    const active = candidates
      .filter((candidate) => !this.expired(candidate.validUntil, now))
      .filter((candidate) => candidate.signals.length > 0)
      .sort((a, b) => b.priority - a.priority || this.latestSignal(b) - this.latestSignal(a));

    const grouped = new Map<string, NextBestActionCandidate>();
    for (const candidate of active) {
      const key = candidate.dedupeKey ?? this.destinationKey(candidate.destination);
      const existing = grouped.get(key);
      if (!existing) {
        grouped.set(key, { ...candidate, signals: [...candidate.signals] });
        continue;
      }
      existing.signals = this.mergeSignals(existing.signals, candidate.signals);
      existing.estimatedDuration ??= candidate.estimatedDuration ?? null;
      existing.expectedImpact ??= candidate.expectedImpact ?? null;
    }

    const ranked = [...grouped.values()];
    const first = ranked[0];
    if (!first) return null;

    const alternatives: NextBestActionAlternative[] = ranked.slice(1, 4).map((candidate) => ({
      id: candidate.id,
      title: candidate.title,
      destination: candidate.destination,
    }));

    return {
      id: first.id,
      title: first.title,
      primaryAction: {
        label: first.actionLabel,
        destination: first.destination,
      },
      reason: first.reason,
      estimatedDuration: first.estimatedDuration ?? null,
      expectedImpact: first.expectedImpact ?? null,
      signalsUsed: first.signals,
      alternatives,
      destination: first.destination,
      validUntil: first.validUntil ?? null,
      confidence: first.confidence ?? null,
      source: first.source,
    };
  }

  private recommendationDedupeKey(
    recommendation: ResourceRecommendation,
    destination: ActionDestination,
  ): string {
    if (recommendation.target?.kind === 'concept') return `concept:${recommendation.target.id}`;
    return this.destinationKey(destination);
  }

  private destinationKey(destination: ActionDestination): string {
    const params = destination.params
      ? Object.entries(destination.params).sort(([a], [b]) => a.localeCompare(b)).map(([key, value]) => `${key}=${String(value)}`).join('&')
      : '';
    return `${destination.kind}:${destination.id ?? ''}:${destination.path ?? ''}:${params}`;
  }

  private expired(validUntil: string | null | undefined, now: Date): boolean {
    if (!validUntil) return false;
    const time = Date.parse(validUntil);
    return !Number.isFinite(time) || time <= now.getTime();
  }

  private latestSignal(candidate: NextBestActionCandidate): number {
    return Math.max(0, ...candidate.signals.map((signal) => Date.parse(signal.timestamp) || 0));
  }

  private mergeSignals(
    current: readonly RecommendationReason[],
    incoming: readonly RecommendationReason[],
  ): RecommendationReason[] {
    const merged = new Map<string, RecommendationReason>();
    for (const signal of [...current, ...incoming]) {
      merged.set(`${signal.signal}:${signal.evidence}`, signal);
    }
    return [...merged.values()].slice(0, 5);
  }

  private destination(target: RecommendationTarget | null): ActionDestination | null {
    if (!target) return null;
    if (target.kind === 'route') return { kind: 'route', path: target.id };
    return { kind: target.kind, id: target.id };
  }
}

function validUntilAfter(value: string, durationMs: number): string {
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? new Date(timestamp + durationMs).toISOString() : 'invalid';
}
