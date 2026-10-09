import { CEFR_LEVELS, type CefrLevel } from './language';
import {
  LANGUAGE_MASTERY_PILLARS,
  LANGUAGE_MASTERY_THRESHOLD,
  type LanguageMasteryPillar,
  type LanguageMasteryVerdict,
} from './language-mastery';
import type { SupportedLanguageCode } from './languages';
import {
  RLLE_CURRICULUM,
  type RlleCurriculumStrand,
} from './real-life-language';

/**
 * Versioned bridge between the existing 18-unit RLLE spine and the five
 * mastery pillars. Bump this version whenever a unit, criterion or pillar
 * assignment changes; old evidence must keep its original scope.
 */
export const RLLE_LANGUAGE_MASTERY_MAPPING_VERSION = 'rlle-language-mastery-map-v1' as const;
export const RLLE_PILLAR_EXAMS_PER_LEVEL = LANGUAGE_MASTERY_PILLARS.length;

export const RLLE_LANGUAGE_EVIDENCE_MODALITIES = [
  'lexical-production',
  'structural-production',
  'audio-input-comprehension',
  'text-input-comprehension',
  'conversation-production',
  'interaction-production',
  'mediation-production',
  'audio-native-pronunciation-assessment',
  'written-production',
] as const;
export type RlleLanguageEvidenceModality = (typeof RLLE_LANGUAGE_EVIDENCE_MODALITIES)[number];

export type RlleLanguageOralRole = 'none' | 'audio-input' | 'oral-capable' | 'audio-native-assessment';

const STRAND_CRITERIA = {
  vocabulary: { pillar: 'vocabulary-target-lexicon', criterionId: 'target-vocabulary-use', evidenceModality: 'lexical-production', oralRole: 'none' },
  verbs: { pillar: 'verbal-system-conjugation', criterionId: 'verb-system-use', evidenceModality: 'structural-production', oralRole: 'none' },
  conjugation: { pillar: 'verbal-system-conjugation', criterionId: 'conjugation-use', evidenceModality: 'structural-production', oralRole: 'none' },
  grammar: { pillar: 'grammar-structures', criterionId: 'grammar-structure-use', evidenceModality: 'structural-production', oralRole: 'none' },
  listening: { pillar: 'communication-situations', criterionId: 'listening-comprehension', evidenceModality: 'audio-input-comprehension', oralRole: 'audio-input' },
  reading: { pillar: 'communication-situations', criterionId: 'reading-comprehension', evidenceModality: 'text-input-comprehension', oralRole: 'none' },
  conversation: { pillar: 'communication-situations', criterionId: 'conversation-production', evidenceModality: 'conversation-production', oralRole: 'oral-capable' },
  interaction: { pillar: 'communication-situations', criterionId: 'situational-interaction', evidenceModality: 'interaction-production', oralRole: 'oral-capable' },
  mediation: { pillar: 'communication-situations', criterionId: 'meaning-mediation', evidenceModality: 'mediation-production', oralRole: 'oral-capable' },
  pronunciation: { pillar: 'orthography-graphy-phonetics', criterionId: 'pronunciation-production', evidenceModality: 'audio-native-pronunciation-assessment', oralRole: 'audio-native-assessment' },
  writing: { pillar: 'orthography-graphy-phonetics', criterionId: 'written-graphy-production', evidenceModality: 'written-production', oralRole: 'none' },
} as const satisfies Record<RlleCurriculumStrand, {
  pillar: LanguageMasteryPillar;
  criterionId: string;
  evidenceModality: RlleLanguageEvidenceModality;
  oralRole: RlleLanguageOralRole;
}>;

export type RlleLanguageMasteryCriterionId =
  (typeof STRAND_CRITERIA)[RlleCurriculumStrand]['criterionId'];

interface RlleUnitMappingSource {
  unitId: string;
  level: CefrLevel;
  sourceStrands: readonly RlleCurriculumStrand[];
}

/**
 * Snapshot of the actual RLLE spine at mapping v1. Each unit appears exactly
 * once. Its strands become separate micro-milestones; the unit itself is not
 * cloned five times.
 */
const UNIT_MAPPING_SOURCE = [
  { unitId: 'a1-first-contact', level: 'A1', sourceStrands: ['vocabulary', 'verbs', 'grammar', 'conversation', 'pronunciation'] },
  { unitId: 'a1-daily-needs', level: 'A1', sourceStrands: ['vocabulary', 'conjugation', 'listening', 'interaction'] },
  { unitId: 'a1-survival', level: 'A1', sourceStrands: ['listening', 'conversation', 'interaction', 'mediation'] },
  { unitId: 'a2-routines', level: 'A2', sourceStrands: ['vocabulary', 'verbs', 'conjugation', 'reading', 'writing', 'listening', 'interaction'] },
  { unitId: 'a2-past-plans', level: 'A2', sourceStrands: ['conjugation', 'grammar', 'conversation', 'listening'] },
  { unitId: 'a2-travel-study', level: 'A2', sourceStrands: ['interaction', 'listening', 'reading', 'writing', 'mediation'] },
  { unitId: 'b1-experiences', level: 'B1', sourceStrands: ['vocabulary', 'conjugation', 'conversation', 'writing'] },
  { unitId: 'b1-work-travel', level: 'B1', sourceStrands: ['listening', 'interaction', 'conversation', 'pronunciation', 'mediation'] },
  { unitId: 'b1-opinions', level: 'B1', sourceStrands: ['grammar', 'listening', 'reading', 'conversation', 'writing', 'mediation'] },
  { unitId: 'b2-collaboration', level: 'B2', sourceStrands: ['listening', 'interaction', 'conversation', 'pronunciation'] },
  { unitId: 'b2-argument', level: 'B2', sourceStrands: ['grammar', 'reading', 'writing', 'mediation'] },
  { unitId: 'b2-professional', level: 'B2', sourceStrands: ['vocabulary', 'verbs', 'writing', 'interaction'] },
  { unitId: 'c1-complex-input', level: 'C1', sourceStrands: ['listening', 'reading', 'vocabulary', 'mediation'] },
  { unitId: 'c1-influence', level: 'C1', sourceStrands: ['conversation', 'interaction', 'grammar', 'pronunciation'] },
  { unitId: 'c1-production', level: 'C1', sourceStrands: ['writing', 'mediation', 'vocabulary', 'grammar'] },
  { unitId: 'c2-nuance', level: 'C2', sourceStrands: ['vocabulary', 'grammar', 'listening', 'reading'] },
  { unitId: 'c2-adaptation', level: 'C2', sourceStrands: ['conversation', 'interaction', 'pronunciation', 'mediation'] },
  { unitId: 'c2-mastery', level: 'C2', sourceStrands: ['writing', 'mediation', 'conversation', 'interaction'] },
] as const satisfies readonly RlleUnitMappingSource[];

export interface RlleLanguageMasteryMicroMilestone {
  id: string;
  unitId: string;
  level: CefrLevel;
  pillar: LanguageMasteryPillar;
  pillarOrder: number;
  criterionId: RlleLanguageMasteryCriterionId;
  sourceStrand: RlleCurriculumStrand;
  evidenceModality: RlleLanguageEvidenceModality;
  /** `oral-capable` does not make voice mandatory. By contrast,
   * `audio-native-assessment` requires real pronunciation evaluation: STT or
   * a written substitute cannot satisfy it. */
  oralRole: RlleLanguageOralRole;
}

export interface RlleLanguageMasteryUnitMapping {
  unitId: string;
  level: CefrLevel;
  unitOrder: number;
  milestones: readonly RlleLanguageMasteryMicroMilestone[];
}

function pillarOrder(pillar: LanguageMasteryPillar): number {
  return LANGUAGE_MASTERY_PILLARS.indexOf(pillar) + 1;
}

export const RLLE_LANGUAGE_MASTERY_UNIT_MAP: readonly RlleLanguageMasteryUnitMapping[] =
  UNIT_MAPPING_SOURCE.map((source) => {
    const curriculumUnit = RLLE_CURRICULUM.find((unit) => unit.id === source.unitId);
    return {
      unitId: source.unitId,
      level: source.level,
      unitOrder: curriculumUnit?.order ?? -1,
      milestones: source.sourceStrands.map((sourceStrand) => {
        const criterion = STRAND_CRITERIA[sourceStrand];
        return {
          id: `${RLLE_LANGUAGE_MASTERY_MAPPING_VERSION}:${source.unitId}:${criterion.criterionId}`,
          unitId: source.unitId,
          level: source.level,
          pillar: criterion.pillar,
          pillarOrder: pillarOrder(criterion.pillar),
          criterionId: criterion.criterionId,
          sourceStrand,
          evidenceModality: criterion.evidenceModality,
          oralRole: criterion.oralRole,
        };
      }),
    };
  });

export const RLLE_MANDATORY_PILLAR_COMPETENCIES = [
  { id: 'communication-receptive', pillar: 'communication-situations', acceptedCriteria: ['listening-comprehension', 'reading-comprehension'] },
  { id: 'communication-productive', pillar: 'communication-situations', acceptedCriteria: ['conversation-production', 'situational-interaction', 'meaning-mediation'] },
  { id: 'grammar-structures', pillar: 'grammar-structures', acceptedCriteria: ['grammar-structure-use'] },
  { id: 'verbal-system', pillar: 'verbal-system-conjugation', acceptedCriteria: ['verb-system-use', 'conjugation-use'] },
  { id: 'target-lexicon', pillar: 'vocabulary-target-lexicon', acceptedCriteria: ['target-vocabulary-use'] },
  { id: 'graphy-writing', pillar: 'orthography-graphy-phonetics', acceptedCriteria: ['written-graphy-production'] },
  { id: 'phonetic-production', pillar: 'orthography-graphy-phonetics', acceptedCriteria: ['pronunciation-production'] },
] as const satisfies readonly {
  id: string;
  pillar: LanguageMasteryPillar;
  acceptedCriteria: readonly RlleLanguageMasteryCriterionId[];
}[];

export type RlleMandatoryPillarCompetencyId =
  (typeof RLLE_MANDATORY_PILLAR_COMPETENCIES)[number]['id'];

export interface RlleMandatoryPillarCompetencyCoverage {
  competencyId: RlleMandatoryPillarCompetencyId;
  acceptedCriteria: readonly RlleLanguageMasteryCriterionId[];
  milestoneIds: readonly string[];
  covered: boolean;
}

export interface RlleLevelPillarPlan {
  level: CefrLevel;
  pillar: LanguageMasteryPillar;
  pillarOrder: number;
  requiredMilestoneIds: readonly string[];
  sourceUnitIds: readonly string[];
  mandatoryCompetencies: readonly RlleMandatoryPillarCompetencyCoverage[];
  examId: string;
  /** False means content is missing. It must block activation instead of
   * silently removing this pillar from the denominator. */
  contentReady: boolean;
}

export const RLLE_LEVEL_PILLAR_PLANS: readonly RlleLevelPillarPlan[] = CEFR_LEVELS.flatMap(
  (level) => LANGUAGE_MASTERY_PILLARS.map((pillar) => {
    const milestones = RLLE_LANGUAGE_MASTERY_UNIT_MAP
      .filter((unit) => unit.level === level)
      .flatMap((unit) => unit.milestones)
      .filter((milestone) => milestone.pillar === pillar);
    const mandatoryCompetencies = RLLE_MANDATORY_PILLAR_COMPETENCIES
      .filter((requirement) => requirement.pillar === pillar)
      .map((requirement) => {
        const matching = milestones.filter((milestone) =>
          (requirement.acceptedCriteria as readonly string[]).includes(milestone.criterionId));
        return {
          competencyId: requirement.id,
          acceptedCriteria: requirement.acceptedCriteria,
          milestoneIds: matching.map((milestone) => milestone.id),
          covered: matching.length > 0,
        };
      });
    return {
      level,
      pillar,
      pillarOrder: pillarOrder(pillar),
      requiredMilestoneIds: milestones.map((milestone) => milestone.id),
      sourceUnitIds: [...new Set(milestones.map((milestone) => milestone.unitId))],
      mandatoryCompetencies,
      examId: `${RLLE_LANGUAGE_MASTERY_MAPPING_VERSION}:${level}:${pillar}:exam`,
      contentReady: mandatoryCompetencies.every((competency) => competency.covered),
    };
  }),
);

export function getRlleLevelPillarPlans(level: CefrLevel): readonly RlleLevelPillarPlan[] {
  return RLLE_LEVEL_PILLAR_PLANS.filter((plan) => plan.level === level);
}

export type RlleLanguageMasteryMappingIssueKind =
  | 'duplicate-unit'
  | 'missing-curriculum-unit'
  | 'unexpected-curriculum-unit'
  | 'unit-level-mismatch'
  | 'unit-strand-mismatch'
  | 'duplicate-milestone'
  | 'missing-required-competency-content';

export interface RlleLanguageMasteryMappingIssue {
  kind: RlleLanguageMasteryMappingIssueKind;
  unitId?: string;
  level?: CefrLevel;
  pillar?: LanguageMasteryPillar;
  competencyId?: RlleMandatoryPillarCompetencyId;
  detail: string;
}

function sameOrderedValues(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function auditMapping(): RlleLanguageMasteryMappingIssue[] {
  const issues: RlleLanguageMasteryMappingIssue[] = [];
  const mappedIds: string[] = UNIT_MAPPING_SOURCE.map((unit) => unit.unitId);
  const duplicateIds = mappedIds.filter((id, index) => mappedIds.indexOf(id) !== index);
  for (const unitId of new Set(duplicateIds)) {
    issues.push({ kind: 'duplicate-unit', unitId, detail: `Unit ${unitId} occurs more than once in mapping v1.` });
  }

  for (const source of UNIT_MAPPING_SOURCE) {
    const curriculumUnit = RLLE_CURRICULUM.find((unit) => unit.id === source.unitId);
    if (!curriculumUnit) {
      issues.push({ kind: 'missing-curriculum-unit', unitId: source.unitId, detail: `Mapped unit ${source.unitId} is absent from RLLE_CURRICULUM.` });
      continue;
    }
    if (curriculumUnit.level !== source.level) {
      issues.push({ kind: 'unit-level-mismatch', unitId: source.unitId, level: source.level, detail: `Mapped level ${source.level} differs from curriculum level ${curriculumUnit.level}.` });
    }
    if (!sameOrderedValues(curriculumUnit.strands, source.sourceStrands)) {
      issues.push({ kind: 'unit-strand-mismatch', unitId: source.unitId, level: source.level, detail: `Mapped strands differ from the versioned RLLE curriculum snapshot.` });
    }
  }
  for (const curriculumUnit of RLLE_CURRICULUM) {
    if (!mappedIds.includes(curriculumUnit.id)) {
      issues.push({ kind: 'unexpected-curriculum-unit', unitId: curriculumUnit.id, level: curriculumUnit.level, detail: `RLLE unit ${curriculumUnit.id} has no mastery mapping.` });
    }
  }

  const milestoneIds = RLLE_LANGUAGE_MASTERY_UNIT_MAP.flatMap((unit) => unit.milestones.map((milestone) => milestone.id));
  const duplicateMilestones = milestoneIds.filter((id, index) => milestoneIds.indexOf(id) !== index);
  for (const id of new Set(duplicateMilestones)) {
    issues.push({ kind: 'duplicate-milestone', detail: `Micro-milestone ${id} is not unique.` });
  }

  for (const plan of RLLE_LEVEL_PILLAR_PLANS) {
    for (const competency of plan.mandatoryCompetencies.filter((item) => !item.covered)) {
      issues.push({
        kind: 'missing-required-competency-content',
        level: plan.level,
        pillar: plan.pillar,
        competencyId: competency.competencyId,
        detail: `${plan.level} has no existing RLLE content mapped to mandatory competency ${competency.competencyId}.`,
      });
    }
  }
  return issues;
}

export const RLLE_LANGUAGE_MASTERY_MAPPING_ISSUES: readonly RlleLanguageMasteryMappingIssue[] = auditMapping();

export const RLLE_LANGUAGE_MASTERY_MAPPING_AUDIT = {
  version: RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
  mappedUnitCount: RLLE_LANGUAGE_MASTERY_UNIT_MAP.length,
  curriculumUnitCount: RLLE_CURRICULUM.length,
  levelCount: CEFR_LEVELS.length,
  pillarExamCount: RLLE_LEVEL_PILLAR_PLANS.length,
  examsPerLevel: RLLE_PILLAR_EXAMS_PER_LEVEL,
  issues: RLLE_LANGUAGE_MASTERY_MAPPING_ISSUES,
  activationReady: RLLE_LANGUAGE_MASTERY_MAPPING_ISSUES.length === 0,
} as const;

/** Evidence from another language, level, pillar, milestone or map version can
 * never satisfy this scope. Learner ownership remains an API/storage concern. */
export function rlleMilestoneEvidenceScopeKey(input: {
  languageCode: SupportedLanguageCode;
  milestone: RlleLanguageMasteryMicroMilestone;
}): string {
  return [
    RLLE_LANGUAGE_MASTERY_MAPPING_VERSION,
    input.languageCode,
    input.milestone.level,
    input.milestone.pillar,
    input.milestone.id,
  ].join(':');
}

export interface RlleMilestoneMasteryResult {
  milestoneId: string;
  verdict: LanguageMasteryVerdict;
}

export interface RllePillarExamResult {
  examId: string;
  pillar: LanguageMasteryPillar;
  verdict: LanguageMasteryVerdict;
  /** Raw score before UI rounding; null for incomplete/technical evidence. */
  rawScore: number | null;
}

export interface RlleLevelPillarGateDecision {
  level: CefrLevel;
  unlocked: boolean;
  requiredExamCount: number;
  blockedContentPillars: LanguageMasteryPillar[];
  milestoneIncompletePillars: LanguageMasteryPillar[];
  missingExamPillars: LanguageMasteryPillar[];
  failedExamPillars: LanguageMasteryPillar[];
  notEvaluableExamPillars: LanguageMasteryPillar[];
}

/**
 * A level unlock requires every mapped milestone and all five pillar exams.
 * Scores are checked independently: no global average can compensate a failed
 * or non-evaluable mandatory pillar.
 */
export function decideRlleLevelPillarGate(input: {
  level: CefrLevel;
  milestones: readonly RlleMilestoneMasteryResult[];
  exams: readonly RllePillarExamResult[];
}): RlleLevelPillarGateDecision {
  const plans = getRlleLevelPillarPlans(input.level);
  const masteredMilestones = new Set(
    input.milestones.filter((result) => result.verdict === 'mastered').map((result) => result.milestoneId),
  );
  const blockedContentPillars: LanguageMasteryPillar[] = [];
  const milestoneIncompletePillars: LanguageMasteryPillar[] = [];
  const missingExamPillars: LanguageMasteryPillar[] = [];
  const failedExamPillars: LanguageMasteryPillar[] = [];
  const notEvaluableExamPillars: LanguageMasteryPillar[] = [];

  for (const plan of plans) {
    if (!plan.contentReady) {
      blockedContentPillars.push(plan.pillar);
      continue;
    }
    if (plan.requiredMilestoneIds.some((id) => !masteredMilestones.has(id))) {
      milestoneIncompletePillars.push(plan.pillar);
      continue;
    }
    const exam = input.exams.find((candidate) => candidate.examId === plan.examId && candidate.pillar === plan.pillar);
    if (!exam) {
      missingExamPillars.push(plan.pillar);
    } else if (exam.verdict === 'not-evaluable' || exam.rawScore === null) {
      notEvaluableExamPillars.push(plan.pillar);
    } else if (exam.verdict !== 'mastered' || exam.rawScore < LANGUAGE_MASTERY_THRESHOLD) {
      failedExamPillars.push(plan.pillar);
    }
  }

  const unlocked =
    plans.length === RLLE_PILLAR_EXAMS_PER_LEVEL
    && blockedContentPillars.length === 0
    && milestoneIncompletePillars.length === 0
    && missingExamPillars.length === 0
    && failedExamPillars.length === 0
    && notEvaluableExamPillars.length === 0;

  return {
    level: input.level,
    unlocked,
    requiredExamCount: RLLE_PILLAR_EXAMS_PER_LEVEL,
    blockedContentPillars,
    milestoneIncompletePillars,
    missingExamPillars,
    failedExamPillars,
    notEvaluableExamPillars,
  };
}
