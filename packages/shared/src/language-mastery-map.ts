import { CEFR_LEVELS, type CefrLevel } from './language';
import {
  LANGUAGE_MASTERY_PILLARS,
  LANGUAGE_MASTERY_THRESHOLD,
  LANGUAGE_TRAINING_FORMATS,
  type LanguageTrainingFormat,
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
export const RLLE_LANGUAGE_MASTERY_MAPPING_VERSION = 'rlle-language-mastery-map-v2' as const;
export const RLLE_LANGUAGE_MASTERY_CONTENT_VERSION = 'rlle-language-mastery-content-v1' as const;
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
 * Snapshot of the actual RLLE spine at mapping v2. Each unit appears exactly
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
  origin: 'curriculum' | 'authorized-content-supplement';
  contentDefinitionId: string | null;
  contentVersion: typeof RLLE_LANGUAGE_MASTERY_CONTENT_VERSION | null;
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

export interface RlleLanguageMasteryContentActivity {
  format: LanguageTrainingFormat;
  guidance: string;
}

export interface RlleLanguageMasteryContentCriterion {
  id: string;
  guidance: string;
  mandatory: true;
}

export type RlleAcousticAssessmentMode = 'scripted-reference' | 'spontaneous';
export type RlleAcousticAssessmentDimension = 'accuracy' | 'fluency' | 'prosody';

export interface RlleAcousticAssessmentRequirements {
  required: true;
  /** A transcript can support content evaluation, but never acoustic proof. */
  transcriptionSufficient: false;
  modes: readonly RlleAcousticAssessmentMode[];
  requiredDimensions: readonly RlleAcousticAssessmentDimension[];
  optionalDimensions: readonly RlleAcousticAssessmentDimension[];
}

/**
 * Authored content that closes one identified gap without cloning a
 * curriculum unit. Definitions are language-aware rather than tied to one
 * language: the lesson generator instantiates the target writing or verbal
 * system while retaining these objectives and evaluation requirements.
 */
export interface RlleLanguageMasteryContentSupplement {
  id: string;
  contentVersion: typeof RLLE_LANGUAGE_MASTERY_CONTENT_VERSION;
  unitId: string;
  level: CefrLevel;
  pillar: LanguageMasteryPillar;
  competencyId: RlleMandatoryPillarCompetencyId;
  sourceStrand: RlleCurriculumStrand;
  criterionId: RlleLanguageMasteryCriterionId;
  evidenceModality: RlleLanguageEvidenceModality;
  oralRole: RlleLanguageOralRole;
  objective: string;
  explanation: string;
  activities: readonly RlleLanguageMasteryContentActivity[];
  evaluation: {
    criteria: readonly RlleLanguageMasteryContentCriterion[];
    rawThreshold: typeof LANGUAGE_MASTERY_THRESHOLD;
    independentWithoutHelp: true;
    notEvaluableWhen: readonly string[];
    acousticAssessment?: RlleAcousticAssessmentRequirements;
  };
}

export const RLLE_LANGUAGE_MASTERY_CONTENT_SUPPLEMENTS = [
  {
    id: 'a1-graphy-writing-foundations',
    contentVersion: RLLE_LANGUAGE_MASTERY_CONTENT_VERSION,
    unitId: 'a1-first-contact',
    level: 'A1',
    pillar: 'orthography-graphy-phonetics',
    competencyId: 'graphy-writing',
    sourceStrand: 'writing',
    criterionId: 'written-graphy-production',
    evidenceModality: 'written-production',
    oralRole: 'none',
    objective: 'Recognise and independently produce the graphemes needed for basic greetings, names and personal details in the target writing system.',
    explanation: 'Teach writing direction, letter or character formation, spacing and meaningful diacritics through modelled recognition and tracing before unaided production.',
    activities: [
      { format: 'recognition-mcq', guidance: 'Recognise the target grapheme in a small set of visually plausible forms.' },
      { format: 'contextual-discrimination', guidance: 'Distinguish visually similar graphemes in short, meaningful A1 words.' },
      { format: 'fill-blank-no-hint', guidance: 'Write the missing grapheme in a familiar greeting or personal detail without a visible answer bank.' },
      { format: 'sentence-reconstruction', guidance: 'Reconstruct a basic greeting or personal-detail phrase with correct order and spacing.' },
      { format: 'register-matching', guidance: 'Match a basic formal or familiar greeting to the correctly written target-language form.' },
      { format: 'error-correction', guidance: 'Correct malformed graphemes, spacing or required diacritics without changing the intended message.' },
      { format: 'listening-discrimination', guidance: 'Choose the written form that corresponds to a short heard greeting, name or personal detail.' },
      { format: 'guided-writing', guidance: 'Move from a visual model to an independently written name, greeting and short personal detail.' },
      { format: 'voice-pronunciation', guidance: 'Read the newly written form aloud for practice while keeping graphy proof distinct from acoustic scoring.' },
      { format: 'mini-dialogue', guidance: 'Write both sides of a two-turn introduction with correct script, spacing and required diacritics.' },
    ],
    evaluation: {
      criteria: [
        { id: 'legible-target-graphemes', guidance: 'Required graphemes are recognisable in the target writing system.', mandatory: true },
        { id: 'writing-conventions', guidance: 'Direction, spacing, case and required diacritics follow target-language conventions.', mandatory: true },
        { id: 'independent-basic-writing', guidance: 'The learner produces the requested A1 text without a model, answer leak or correction shown first.', mandatory: true },
      ],
      rawThreshold: LANGUAGE_MASTERY_THRESHOLD,
      independentWithoutHelp: true,
      notEvaluableWhen: ['response-missing', 'writing-input-unavailable', 'target-script-cannot-be-rendered'],
    },
  },
  {
    id: 'a2-phonetic-production',
    contentVersion: RLLE_LANGUAGE_MASTERY_CONTENT_VERSION,
    unitId: 'a2-routines',
    level: 'A2',
    pillar: 'orthography-graphy-phonetics',
    competencyId: 'phonetic-production',
    sourceStrand: 'pronunciation',
    criterionId: 'pronunciation-production',
    evidenceModality: 'audio-native-pronunciation-assessment',
    oralRole: 'audio-native-assessment',
    objective: 'Produce intelligible A2 routine and travel utterances using target-language sound contrasts, word stress and basic rhythm.',
    explanation: 'Contrast sounds in listening first, then practise reference-text repetition and finally spontaneous production; transcription alone never proves pronunciation.',
    activities: [
      { format: 'recognition-mcq', guidance: 'Recognise a heard target sound, stress pattern or rhythm among acoustically plausible alternatives.' },
      { format: 'listening-discrimination', guidance: 'Identify target sound and stress contrasts in short A2 utterances.' },
      { format: 'contextual-discrimination', guidance: 'Select the pronunciation that preserves the intended word or phrase meaning.' },
      { format: 'fill-blank-no-hint', guidance: 'Complete a sound-to-form prompt from audio without an answer bank, without treating spelling as pronunciation proof.' },
      { format: 'sentence-reconstruction', guidance: 'Reconstruct an utterance into its natural stress and rhythm groups before speaking it.' },
      { format: 'register-matching', guidance: 'Match careful and conversational pronunciations to an appropriate A2 situation.' },
      { format: 'error-correction', guidance: 'Identify a supplied sound, stress or rhythm error and record a corrected version.' },
      { format: 'guided-writing', guidance: 'Annotate the sounds, stress and rhythm to prepare a new utterance, without awarding acoustic credit for the annotation.' },
      { format: 'voice-pronunciation', guidance: 'Record both reference-text reading and a new utterance using the same phonetic pattern.' },
      { format: 'mini-dialogue', guidance: 'Reuse the target pattern spontaneously in an A2 routine or travel exchange.' },
    ],
    evaluation: {
      criteria: [
        { id: 'target-sound-accuracy', guidance: 'Mandatory target sound contrasts are acoustically distinguishable.', mandatory: true },
        { id: 'word-stress-rhythm', guidance: 'Stress and basic rhythm remain intelligible for the target language.', mandatory: true },
        { id: 'spontaneous-intelligibility', guidance: 'A new, unrehearsed utterance is intelligible without relying only on transcript correctness.', mandatory: true },
      ],
      rawThreshold: LANGUAGE_MASTERY_THRESHOLD,
      independentWithoutHelp: true,
      notEvaluableWhen: [
        'microphone-unavailable',
        'audio-missing-or-corrupt',
        'pronunciation-assessment-unsupported',
        'provider-locale-unverified',
        'required-acoustic-dimension-unavailable',
      ],
      acousticAssessment: {
        required: true,
        transcriptionSufficient: false,
        modes: ['scripted-reference', 'spontaneous'],
        requiredDimensions: ['accuracy', 'fluency'],
        optionalDimensions: ['prosody'],
      },
    },
  },
  {
    id: 'c1-verbal-system-control',
    contentVersion: RLLE_LANGUAGE_MASTERY_CONTENT_VERSION,
    unitId: 'c1-production',
    level: 'C1',
    pillar: 'verbal-system-conjugation',
    competencyId: 'verbal-system',
    sourceStrand: 'verbs',
    criterionId: 'verb-system-use',
    evidenceModality: 'structural-production',
    oralRole: 'none',
    objective: 'Control the target-language verbal system to express time, aspect, modality and stance precisely in sustained C1 production.',
    explanation: 'Teach target-language forms—inflectional or analytic—in discourse context, including sequence, agreement and register where the language requires them.',
    activities: [
      { format: 'recognition-mcq', guidance: 'Recognise the verbal choice that expresses a specified C1 temporal, aspectual or modal relation.' },
      { format: 'contextual-discrimination', guidance: 'Choose a verbal form from discourse cues for time, aspect, modality and stance.' },
      { format: 'fill-blank-no-hint', guidance: 'Supply forms independently in a coherent academic or professional passage.' },
      { format: 'sentence-reconstruction', guidance: 'Reconstruct a dense passage while preserving sequence, agreement and discourse time.' },
      { format: 'register-matching', guidance: 'Match verbal choices to formal, neutral and professional C1 contexts.' },
      { format: 'error-correction', guidance: 'Diagnose and repair verbal-system errors while preserving intended nuance.' },
      { format: 'listening-discrimination', guidance: 'Distinguish time, aspect, modality or stance conveyed by verbal choices in spoken discourse.' },
      { format: 'guided-writing', guidance: 'Produce a sustained argument that shifts time, modality or stance accurately.' },
      { format: 'voice-pronunciation', guidance: 'Deliver a short argument aloud while practising the target forms; score the verbal system separately from pronunciation.' },
      { format: 'mini-dialogue', guidance: 'Sustain a short exchange that requires accurate shifts of time, modality and stance.' },
    ],
    evaluation: {
      criteria: [
        { id: 'temporal-aspectual-control', guidance: 'Temporal and aspectual relations remain accurate across the response.', mandatory: true },
        { id: 'modality-stance-control', guidance: 'Verbal choices express the requested certainty, obligation or stance.', mandatory: true },
        { id: 'discourse-consistency', guidance: 'Forms, agreement and sequence remain consistent with C1 discourse and register.', mandatory: true },
      ],
      rawThreshold: LANGUAGE_MASTERY_THRESHOLD,
      independentWithoutHelp: true,
      notEvaluableWhen: ['response-missing', 'rubric-language-mismatch', 'assessment-content-incomplete'],
    },
  },
  {
    id: 'c2-verbal-system-nuance',
    contentVersion: RLLE_LANGUAGE_MASTERY_CONTENT_VERSION,
    unitId: 'c2-mastery',
    level: 'C2',
    pillar: 'verbal-system-conjugation',
    competencyId: 'verbal-system',
    sourceStrand: 'conjugation',
    criterionId: 'conjugation-use',
    evidenceModality: 'structural-production',
    oralRole: 'none',
    objective: 'Manipulate the full target-language verbal system for subtle temporal, aspectual, modal and stylistic effects in C2 production.',
    explanation: 'Work from competing discourse interpretations to deliberate form choices, reformulation and register shifts, respecting languages that encode these meanings analytically rather than by conjugation.',
    activities: [
      { format: 'recognition-mcq', guidance: 'Recognise the verbal choice that conveys a specified subtle temporal, aspectual, modal or stylistic effect.' },
      { format: 'contextual-discrimination', guidance: 'Discriminate between competing verbal interpretations using dense discourse context.' },
      { format: 'fill-blank-no-hint', guidance: 'Supply precise verbal forms or analytic constructions in a novel C2 passage without cues.' },
      { format: 'register-matching', guidance: 'Adapt verbal choices across formal, neutral and idiomatic registers without losing meaning.' },
      { format: 'sentence-reconstruction', guidance: 'Reconstruct dense discourse while preserving temporal and modal dependencies.' },
      { format: 'error-correction', guidance: 'Repair subtle form, sequence and register mismatches and explain the changed interpretation.' },
      { format: 'listening-discrimination', guidance: 'Identify subtle stance and temporal framing conveyed through the verbal system in authentic-style speech.' },
      { format: 'guided-writing', guidance: 'Create and reformulate a nuanced C2 passage under a new stance or temporal frame.' },
      { format: 'voice-pronunciation', guidance: 'Reformulate a spoken passage under a new stance or frame; assess verbal choices independently of pronunciation.' },
      { format: 'mini-dialogue', guidance: 'Negotiate a nuanced position through a short exchange with deliberate verbal and register shifts.' },
    ],
    evaluation: {
      criteria: [
        { id: 'nuanced-meaning-control', guidance: 'Form choices convey the requested temporal, aspectual and modal nuances.', mandatory: true },
        { id: 'register-adaptation', guidance: 'The verbal system adapts naturally to the requested genre and register.', mandatory: true },
        { id: 'reformulation-precision', guidance: 'Reformulation changes only the requested stance or frame and preserves the rest of the meaning.', mandatory: true },
      ],
      rawThreshold: LANGUAGE_MASTERY_THRESHOLD,
      independentWithoutHelp: true,
      notEvaluableWhen: ['response-missing', 'rubric-language-mismatch', 'assessment-content-incomplete'],
    },
  },
] as const satisfies readonly RlleLanguageMasteryContentSupplement[];

/**
 * Resolve the authored additions for one existing curriculum unit. Runtime
 * lesson generation must consume this contract instead of inferring that a
 * mapped criterion is already teachable from its title alone.
 */
export function getRlleLanguageMasteryContentSupplementsForUnit(
  unitId: string,
): readonly RlleLanguageMasteryContentSupplement[] {
  return RLLE_LANGUAGE_MASTERY_CONTENT_SUPPLEMENTS
    .filter((supplement) => supplement.unitId === unitId);
}

export const RLLE_LANGUAGE_MASTERY_UNIT_MAP: readonly RlleLanguageMasteryUnitMapping[] =
  UNIT_MAPPING_SOURCE.map((source) => {
    const curriculumUnit = RLLE_CURRICULUM.find((unit) => unit.id === source.unitId);
    const supplementMilestones: RlleLanguageMasteryMicroMilestone[] =
      getRlleLanguageMasteryContentSupplementsForUnit(source.unitId)
        .map((supplement) => ({
          id: `${RLLE_LANGUAGE_MASTERY_MAPPING_VERSION}:${source.unitId}:${supplement.criterionId}`,
          unitId: source.unitId,
          level: source.level,
          pillar: supplement.pillar,
          pillarOrder: pillarOrder(supplement.pillar),
          criterionId: supplement.criterionId,
          sourceStrand: supplement.sourceStrand,
          evidenceModality: supplement.evidenceModality,
          oralRole: supplement.oralRole,
          origin: 'authorized-content-supplement',
          contentDefinitionId: supplement.id,
          contentVersion: supplement.contentVersion,
        }));
    return {
      unitId: source.unitId,
      level: source.level,
      unitOrder: curriculumUnit?.order ?? -1,
      milestones: [
        ...source.sourceStrands.map((sourceStrand): RlleLanguageMasteryMicroMilestone => {
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
            origin: 'curriculum',
            contentDefinitionId: null,
            contentVersion: null,
          };
        }),
        ...supplementMilestones,
      ],
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
  | 'invalid-content-supplement'
  | 'content-supplement-mismatch'
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

function contentSupplementComplete(supplement: RlleLanguageMasteryContentSupplement): boolean {
  const formats = new Set(supplement.activities.map((activity) => activity.format));
  const requiresAcousticAssessment = supplement.evidenceModality === 'audio-native-pronunciation-assessment';
  const acousticAssessment = supplement.evaluation.acousticAssessment;
  return supplement.objective.trim().length > 0
    && supplement.explanation.trim().length > 0
    && supplement.activities.length === LANGUAGE_TRAINING_FORMATS.length
    && formats.size === LANGUAGE_TRAINING_FORMATS.length
    && LANGUAGE_TRAINING_FORMATS.every((format) => formats.has(format))
    && supplement.activities.every((activity) => activity.guidance.trim().length > 0)
    && supplement.evaluation.criteria.length > 0
    && supplement.evaluation.criteria.every((criterion) =>
      criterion.id.trim().length > 0 && criterion.guidance.trim().length > 0 && criterion.mandatory)
    && supplement.evaluation.rawThreshold === LANGUAGE_MASTERY_THRESHOLD
    && supplement.evaluation.independentWithoutHelp
    && supplement.evaluation.notEvaluableWhen.length > 0
    && (!requiresAcousticAssessment || (
      acousticAssessment?.required === true
      && acousticAssessment.transcriptionSufficient === false
      && acousticAssessment.modes.includes('scripted-reference')
      && acousticAssessment.modes.includes('spontaneous')
      && acousticAssessment.requiredDimensions.includes('accuracy')
      && acousticAssessment.requiredDimensions.includes('fluency')
    ));
}

function auditMapping(): RlleLanguageMasteryMappingIssue[] {
  const issues: RlleLanguageMasteryMappingIssue[] = [];
  const mappedIds: string[] = UNIT_MAPPING_SOURCE.map((unit) => unit.unitId);
  const duplicateIds = mappedIds.filter((id, index) => mappedIds.indexOf(id) !== index);
  for (const unitId of new Set(duplicateIds)) {
    issues.push({ kind: 'duplicate-unit', unitId, detail: `Unit ${unitId} occurs more than once in mapping v2.` });
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


  const supplementIds = RLLE_LANGUAGE_MASTERY_CONTENT_SUPPLEMENTS.map((supplement) => supplement.id);
  for (const supplement of RLLE_LANGUAGE_MASTERY_CONTENT_SUPPLEMENTS) {
    const curriculumUnit = RLLE_CURRICULUM.find((unit) => unit.id === supplement.unitId);
    const criterion = STRAND_CRITERIA[supplement.sourceStrand];
    if (
      !curriculumUnit
      || curriculumUnit.level !== supplement.level
      || criterion.pillar !== supplement.pillar
      || criterion.criterionId !== supplement.criterionId
      || criterion.evidenceModality !== supplement.evidenceModality
      || criterion.oralRole !== supplement.oralRole
    ) {
      issues.push({
        kind: 'content-supplement-mismatch',
        unitId: supplement.unitId,
        level: supplement.level,
        pillar: supplement.pillar,
        competencyId: supplement.competencyId,
        detail: `Content supplement ${supplement.id} does not match its unit, strand or evidence contract.`,
      });
    }
    if (!contentSupplementComplete(supplement)) {
      issues.push({
        kind: 'invalid-content-supplement',
        unitId: supplement.unitId,
        level: supplement.level,
        pillar: supplement.pillar,
        competencyId: supplement.competencyId,
        detail: `Content supplement ${supplement.id} lacks an objective, explanation, activities, criteria or evaluation rule.`,
      });
    }
  }
  for (const id of new Set(supplementIds.filter((value, index) => supplementIds.indexOf(value) !== index))) {
    issues.push({ kind: 'invalid-content-supplement', detail: `Content supplement ${id} is not unique.` });
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
    input.milestone.contentVersion ?? 'curriculum',
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
