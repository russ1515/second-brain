import type {
  EvidenceBasedLearningProgress,
  LearningEvidenceDimension,
} from '@second-brain/shared';

export const COGNOSTATITY_INDICATOR_KEYS = [
  'intelligence',
  'reflection',
  'vision',
  'understanding',
  'adaptation',
] as const;

export type CognostatityIndicatorKey = (typeof COGNOSTATITY_INDICATOR_KEYS)[number];

export interface CognostatityIndicator {
  key: CognostatityIndicatorKey;
  /** Aggregated 0..100 score. Null means that current evidence is insufficient. */
  percent: number | null;
  evidenceCount: number;
  dimensions: readonly LearningEvidenceDimension[];
}

/** Requiring several evaluated observations prevents a one-off result from
 * being presented as a durable global indicator. */
export const COGNOSTATITY_MIN_EVIDENCE = 3;

/**
 * Fixed, documented projection from the canonical learning-evidence model.
 * There is no LLM inference and no synthetic default value:
 *
 * - Intelligence: integrate knowledge, application and reasoning;
 * - Reflection: reasoning plus critical reflection;
 * - Vision: perspective plus critical reflection;
 * - Understanding: knowledge plus understanding;
 * - Adaptation: application plus perspective.
 *
 * Every required dimension must be evaluated and the result is weighted by
 * its persisted evidence count. The API's dimension percentages already
 * aggregate learning completions over time, so one new attempt cannot replace
 * the learner's prior history here.
 */
const DIMENSIONS: Record<CognostatityIndicatorKey, readonly LearningEvidenceDimension[]> = {
  intelligence: ['knowledge', 'application', 'reasoning'],
  reflection: ['reasoning', 'critical_reflection'],
  vision: ['perspective', 'critical_reflection'],
  understanding: ['knowledge', 'understanding'],
  adaptation: ['application', 'perspective'],
};

export function deriveCognostatity(
  progress: EvidenceBasedLearningProgress,
): CognostatityIndicator[] {
  const byDimension = new Map(
    progress.dimensions.map((dimension) => [dimension.dimension, dimension]),
  );

  return COGNOSTATITY_INDICATOR_KEYS.map((key) => {
    const dimensions = DIMENSIONS[key];
    const evidence = dimensions.map((dimension) => byDimension.get(dimension));
    const complete = evidence.every((item) => (
      item
      && typeof item.percent === 'number'
      && Number.isFinite(item.percent)
      && item.percent >= 0
      && item.percent <= 100
      && item.evaluatedEvidenceCount > 0
    ));
    // One completion can carry several dimension scores. Count unique
    // canonical completions for sufficiency so a single multi-dimensional
    // result cannot masquerade as several independent observations.
    const completionIds = new Set(
      evidence.flatMap((item) => item?.completionIds ?? [])
        .filter((id) => typeof id === 'string' && id.trim().length > 0),
    );
    const evidenceCount = completionIds.size;

    if (!complete || evidenceCount < COGNOSTATITY_MIN_EVIDENCE) {
      return { key, percent: null, evidenceCount, dimensions };
    }

    const weightedObservationCount = evidence.reduce(
      (total, item) => total + Math.max(0, item?.evaluatedEvidenceCount ?? 0),
      0,
    );
    const weightedTotal = evidence.reduce(
      (total, item) => total + ((item?.percent ?? 0) * (item?.evaluatedEvidenceCount ?? 0)),
      0,
    );
    return {
      key,
      percent: Math.max(0, Math.min(100, weightedTotal / weightedObservationCount)),
      evidenceCount,
      dimensions,
    };
  });
}
