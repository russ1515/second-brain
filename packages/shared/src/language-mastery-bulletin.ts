import type { CefrLevel } from './language';
import {
  LANGUAGE_MASTERY_POLICY_VERSION,
  LANGUAGE_MASTERY_THRESHOLD,
  type LanguageMasteryPillar,
  type LanguageMasteryVerdict,
} from './language-mastery';
import {
  RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
  RLLE_LANGUAGE_MASTERY_UNIT_MAP,
  RLLE_PILLAR_EXAMS_PER_LEVEL,
  type RlleLanguageMasteryCriterionId,
  type RlleLanguageMasteryMicroMilestone,
} from './language-mastery-map';
import type { SupportedLanguageCode } from './languages';

export const RLLE_NOTION_MASTERY_STATUSES = [
  'MASTERED',
  'NOT_MASTERED',
  'IN_PROGRESS',
  'NOT_EVALUABLE',
] as const;

export type RlleNotionMasteryStatus =
  (typeof RLLE_NOTION_MASTERY_STATUSES)[number];

/**
 * Minimal, persistence-agnostic evidence consumed by the bulletin projector.
 *
 * Callers must provide only owner-scoped evidence for the requested language
 * profile. A completion id belongs here only after the backend has verified
 * that the canonical LearningCompletion is still in `verified` state.
 * Entries are replayed oldest to newest; the latest non-mastered observation
 * describes the current work state, while verified mastery is absorbing.
 */
export interface RlleNotionEvidenceProjection {
  targetId: string;
  verdict: LanguageMasteryVerdict | null;
  verifiedCompletionId: string | null;
}

export interface RlleNotionBulletinItem {
  notionId: string;
  unitId: string;
  level: CefrLevel;
  pillar: LanguageMasteryPillar;
  criterionId: RlleLanguageMasteryCriterionId;
  sourceStrand: RlleLanguageMasteryMicroMilestone['sourceStrand'];
  origin: RlleLanguageMasteryMicroMilestone['origin'];
  required: true;
  status: RlleNotionMasteryStatus;
  verifiedCompletionId: string | null;
}

export interface RlleLevelMasteryBulletin {
  languageCode: SupportedLanguageCode;
  level: CefrLevel;
  mappingVersion: typeof RLLE_LANGUAGE_MASTERY_MAPPING_VERSION;
  policyVersion: typeof LANGUAGE_MASTERY_POLICY_VERSION;
  notions: RlleNotionBulletinItem[];
  masteredRequiredNotions: number;
  /** All required notions not yet mastered. The status breakdown below keeps
   * failure, work in progress and neutral inability-to-evaluate distinct. */
  toStrengthenRequiredNotions: number;
  notMasteredRequiredNotions: number;
  inProgressRequiredNotions: number;
  notEvaluableRequiredNotions: number;
  totalRequiredNotions: number;
  rawMasteryRatio: number;
  displayPercent: number;
  threshold: typeof LANGUAGE_MASTERY_THRESHOLD;
  notionGateUnlocked: boolean;
  /** A notion bulletin is not a substitute for the five independent pillar
   * exams. Their certification remains a separate, server-authoritative gate. */
  strictCertification: {
    separateFromNotionGate: true;
    requiredPillarExams: typeof RLLE_PILLAR_EXAMS_PER_LEVEL;
    unlocked: boolean | null;
  };
}

function statusFromEvidence(
  evidence: readonly RlleNotionEvidenceProjection[],
): Pick<RlleNotionBulletinItem, 'status' | 'verifiedCompletionId'> {
  const verified = evidence.find((item) => Boolean(item.verifiedCompletionId));
  if (verified?.verifiedCompletionId) {
    return {
      status: 'MASTERED',
      verifiedCompletionId: verified.verifiedCompletionId,
    };
  }

  // A technical inability to evaluate is neutral: it cannot erase an earlier
  // evaluated weakness that still needs remediation. Only a verified
  // completion above can supersede that weakness.
  const latestNotMastered = [...evidence].reverse().find(
    (item) => item.verdict === 'not-mastered',
  );
  if (latestNotMastered) {
    return { status: 'NOT_MASTERED', verifiedCompletionId: null };
  }
  const latest = evidence.at(-1);
  if (latest?.verdict === 'not-evaluable') {
    return { status: 'NOT_EVALUABLE', verifiedCompletionId: null };
  }
  return { status: 'IN_PROGRESS', verifiedCompletionId: null };
}

/**
 * Projects a level bulletin exclusively from the versioned curriculum map and
 * canonical evidence. It never rounds before applying the 90% notion gate and
 * never treats absence or NOT_EVALUABLE as failure/mastery.
 */
export function projectRlleLevelMasteryBulletin(input: {
  languageCode: SupportedLanguageCode;
  level: CefrLevel;
  /** Restricts the denominator to the course's actual versioned curriculum.
   * Omit it to project every required notion for the CEFR level. */
  curriculumUnitIds?: readonly string[];
  evidence: readonly RlleNotionEvidenceProjection[];
  /** Result of the existing five-pillar certification gate, when evaluated. */
  strictCertificationUnlocked?: boolean | null;
}): RlleLevelMasteryBulletin {
  const acceptedUnits = input.curriculumUnitIds
    ? new Set(input.curriculumUnitIds)
    : null;
  const evidenceByTarget = new Map<string, RlleNotionEvidenceProjection[]>();
  for (const item of input.evidence) {
    const rows = evidenceByTarget.get(item.targetId) ?? [];
    rows.push(item);
    evidenceByTarget.set(item.targetId, rows);
  }

  const notions = RLLE_LANGUAGE_MASTERY_UNIT_MAP
    .filter((unit) => unit.level === input.level && (!acceptedUnits || acceptedUnits.has(unit.unitId)))
    .flatMap((unit) => unit.milestones)
    .map<RlleNotionBulletinItem>((milestone) => ({
      notionId: milestone.id,
      unitId: milestone.unitId,
      level: milestone.level,
      pillar: milestone.pillar,
      criterionId: milestone.criterionId,
      sourceStrand: milestone.sourceStrand,
      origin: milestone.origin,
      required: true,
      ...statusFromEvidence(evidenceByTarget.get(milestone.id) ?? []),
    }));
  const masteredRequiredNotions = notions.filter((item) => item.status === 'MASTERED').length;
  const notMasteredRequiredNotions = notions.filter((item) => item.status === 'NOT_MASTERED').length;
  const inProgressRequiredNotions = notions.filter((item) => item.status === 'IN_PROGRESS').length;
  const notEvaluableRequiredNotions = notions.filter((item) => item.status === 'NOT_EVALUABLE').length;
  const totalRequiredNotions = notions.length;
  const rawMasteryRatio = totalRequiredNotions > 0
    ? masteredRequiredNotions / totalRequiredNotions
    : 0;

  return {
    languageCode: input.languageCode,
    level: input.level,
    mappingVersion: RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
    policyVersion: LANGUAGE_MASTERY_POLICY_VERSION,
    notions,
    masteredRequiredNotions,
    toStrengthenRequiredNotions: totalRequiredNotions - masteredRequiredNotions,
    notMasteredRequiredNotions,
    inProgressRequiredNotions,
    notEvaluableRequiredNotions,
    totalRequiredNotions,
    rawMasteryRatio,
    displayPercent: Math.round(rawMasteryRatio * 100),
    threshold: LANGUAGE_MASTERY_THRESHOLD,
    notionGateUnlocked:
      totalRequiredNotions > 0 && rawMasteryRatio >= LANGUAGE_MASTERY_THRESHOLD,
    strictCertification: {
      separateFromNotionGate: true,
      requiredPillarExams: RLLE_PILLAR_EXAMS_PER_LEVEL,
      unlocked: input.strictCertificationUnlocked ?? null,
    },
  };
}
