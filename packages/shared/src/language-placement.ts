import type { AssessmentView } from './assessment';
import type { CefrLevel } from './language';

/** Placement is a diagnostic, not a lesson/module mastery decision. It never
 * consumes or manufactures a 90% mastery score or a LearningCompletion. */
export const LANGUAGE_PLACEMENT_POLICY_VERSION = 'language-placement-cefr-v1' as const;
export const LANGUAGE_PLACEMENT_REQUIRED_SKILLS = ['vocabulary', 'grammar', 'reading', 'writing'] as const;
export const LANGUAGE_PLACEMENT_OPTIONAL_SKILLS = ['listening', 'speaking'] as const;
export const LANGUAGE_PLACEMENT_SELF_ESTIMATES = ['zero', 'basics', 'communicate', 'fluent', 'unknown'] as const;
export const LANGUAGE_PLACEMENT_LEVELS = ['PRE_A1', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

export type LanguagePlacementRequiredSkill = (typeof LANGUAGE_PLACEMENT_REQUIRED_SKILLS)[number];
export type LanguagePlacementSkill = LanguagePlacementRequiredSkill | (typeof LANGUAGE_PLACEMENT_OPTIONAL_SKILLS)[number];
export type LanguagePlacementSelfEstimate = (typeof LANGUAGE_PLACEMENT_SELF_ESTIMATES)[number];
export type LanguagePlacementCefr = 'PRE_A1' | CefrLevel;
export type LanguagePlacementRound = 1 | 2 | 3;
export type LanguageProductLevel = 'BEGINNER' | 'INTERMEDIATE' | 'ADVANCED';

/** These identifiers must be bound to owner-scoped persisted questions and
 * submissions by the server. They are not an alternative to that validation. */
export interface LanguagePlacementSkillEvidence {
  policyVersion: typeof LANGUAGE_PLACEMENT_POLICY_VERSION;
  round: LanguagePlacementRound;
  skill: LanguagePlacementSkill;
  level: LanguagePlacementCefr | null;
  questionId: string;
  assessmentId: string;
  submissionId: string;
  reason: string;
  evidenceQuote: string;
  observedAt: string;
}

export interface StartLanguagePlacementRequest {
  selfEstimate: LanguagePlacementSelfEstimate;
  idempotencyKey: string;
}

export interface SubmitLanguagePlacementRequest {
  assessmentId: string;
  answers: string[];
  idempotencyKey: string;
}

export interface LanguagePlacementView {
  policyVersion: typeof LANGUAGE_PLACEMENT_POLICY_VERSION;
  profileId: string;
  targetLanguage: string;
  supportLanguage: string;
  status: 'required' | 'active' | 'complete' | 'not_evaluable';
  selfEstimate: LanguagePlacementSelfEstimate | null;
  round: LanguagePlacementRound;
  globalLevel: LanguagePlacementCefr | null;
  productLevel: LanguageProductLevel | null;
  skills: LanguagePlacementSkillEvidence[];
  assessment: AssessmentView | null;
  completedAt: string | null;
  submissionIds: string[];
}

/** The same persisted diagnostic is projected in the language profile and
 * Learner Passport; it is deliberately distinct from CEFR certification. */
export type LanguagePlacementSummary = Pick<LanguagePlacementView,
  'policyVersion' | 'status' | 'round' | 'selfEstimate' | 'globalLevel' | 'productLevel' | 'completedAt' | 'skills'>;

export interface LanguagePlacementRoundProjection {
  status: 'complete' | 'not_evaluable';
  globalLevel: LanguagePlacementCefr | null;
  productLevel: LanguageProductLevel | null;
  nextRound: 2 | 3 | null;
  reason: 'evaluated' | 'missing-required-skill' | 'duplicate-required-skill'
    | 'invalid-evidence' | 'unknown-required-level' | 'level-above-round-ceiling';
}

export function placementRoundCeiling(round: LanguagePlacementRound): CefrLevel {
  return ({ 1: 'A2', 2: 'B2', 3: 'C2' } as const)[round];
}

export function placementProductLevel(level: LanguagePlacementCefr): LanguageProductLevel {
  if (level === 'PRE_A1' || level === 'A1' || level === 'A2') return 'BEGINNER';
  if (level === 'B1' || level === 'B2') return 'INTERMEDIATE';
  return 'ADVANCED';
}

/** All four required skills must be evaluated in the same current round.
 * A high score in one skill, an earlier observation, or an optional speaking
 * result can never overrule a weaker/missing required skill. */
export function projectLanguagePlacementRound(input: {
  round: LanguagePlacementRound;
  skills: readonly LanguagePlacementSkillEvidence[];
}): LanguagePlacementRoundProjection {
  const unknown = (reason: LanguagePlacementRoundProjection['reason']): LanguagePlacementRoundProjection => ({
    status: 'not_evaluable', globalLevel: null, productLevel: null, nextRound: null, reason,
  });
  const levels: LanguagePlacementCefr[] = [];
  const ceiling = placementRoundCeiling(input.round);
  const required = input.skills.filter((item) => item.round === input.round
    && (LANGUAGE_PLACEMENT_REQUIRED_SKILLS as readonly string[]).includes(item.skill));
  for (const skill of LANGUAGE_PLACEMENT_REQUIRED_SKILLS) {
    const observations = required.filter((item) => item.skill === skill);
    if (observations.length === 0) return unknown('missing-required-skill');
    if (observations.length !== 1) return unknown('duplicate-required-skill');
    const observation = observations[0];
    if (observation.policyVersion !== LANGUAGE_PLACEMENT_POLICY_VERSION
      || ![observation.questionId, observation.assessmentId, observation.submissionId,
        observation.reason, observation.observedAt].every((value) => typeof value === 'string' && value.trim().length > 0)
      || !Number.isFinite(Date.parse(observation.observedAt))
      || typeof observation.evidenceQuote !== 'string'
      || (observation.level !== 'PRE_A1' && observation.level !== null && !observation.evidenceQuote.trim())) {
      return unknown('invalid-evidence');
    }
    if (observation.level === null
      || !(LANGUAGE_PLACEMENT_LEVELS as readonly string[]).includes(observation.level)) {
      return unknown('unknown-required-level');
    }
    if (LANGUAGE_PLACEMENT_LEVELS.indexOf(observation.level) > LANGUAGE_PLACEMENT_LEVELS.indexOf(ceiling)) {
      return unknown('level-above-round-ceiling');
    }
    levels.push(observation.level);
  }
  // One provider submission/question cannot masquerade as several skill
  // observations. All four must also refer to one assessment/submission.
  if (new Set(required.map((item) => item.questionId)).size !== LANGUAGE_PLACEMENT_REQUIRED_SKILLS.length
    || new Set(required.map((item) => item.assessmentId)).size !== 1
    || new Set(required.map((item) => item.submissionId)).size !== 1) return unknown('invalid-evidence');
  const globalLevel = levels.reduce((lowest, level) =>
    LANGUAGE_PLACEMENT_LEVELS.indexOf(level) < LANGUAGE_PLACEMENT_LEVELS.indexOf(lowest) ? level : lowest);
  const nextRound = levels.every((level) => level === ceiling) && input.round < 3
    ? (input.round + 1) as 2 | 3
    : null;
  return {
    status: 'complete', globalLevel, productLevel: placementProductLevel(globalLevel), nextRound, reason: 'evaluated',
  };
}

/** Replay complete round consensuses in their authorized order. A harder task
 * that does not elicit a new level cannot erase a level already demonstrated
 * by all four skills. Conversely, unrelated high observations may never be
 * combined into a level that no complete round demonstrated. This is only an
 * evidence projection: it does not complete an active/failed workflow. */
export function highestDemonstratedPlacementLevel(
  skills: readonly LanguagePlacementSkillEvidence[],
): LanguagePlacementCefr | null {
  let best: LanguagePlacementCefr | null = null;
  for (const round of [1, 2, 3] as const) {
    const projection = projectLanguagePlacementRound({ round, skills });
    if (projection.status !== 'complete' || projection.globalLevel === null) break;
    if (best === null || LANGUAGE_PLACEMENT_LEVELS.indexOf(projection.globalLevel)
      > LANGUAGE_PLACEMENT_LEVELS.indexOf(best)) best = projection.globalLevel;
    if (projection.nextRound !== round + 1) break;
  }
  return best;
}

const SKILL_RUBRICS: Record<LanguagePlacementRequiredSkill, string> = {
  vocabulary: 'PRE_A1: no reliable independently understood or produced basic words; A1: familiar everyday words; A2: routine personal and practical vocabulary; B1: connected everyday topics and common collocations; B2: precise varied vocabulary on general and abstract topics; C1: flexible idiomatic and domain vocabulary; C2: nuanced, stylistically controlled lexical choices.',
  grammar: 'PRE_A1: no reliable independently formed basic pattern; A1: simple present/reference and basic questions; A2: routine past/future reference, agreement and quantity; B1: connected clauses, narrative forms and common conditions; B2: complex subordination, modality and register; C1: flexible advanced structures with controlled tense/mood; C2: precise complex syntax and subtle meaning contrasts.',
  reading: 'PRE_A1: cannot independently extract the basic requested meaning; A1: familiar words and very short literal phrases; A2: short practical messages with explicit details; B1: main ideas and relevant details in connected familiar text; B2: argument, viewpoint and evidence in complex text; C1: implicit meaning, stance and synthesis in demanding text; C2: fine distinctions, ambiguity and stylistic implications.',
  writing: 'PRE_A1: no independently interpretable basic message; A1: short personal statements and simple sentences; A2: linked routine descriptions or practical messages; B1: coherent connected narration and reasons; B2: structured developed argument with appropriate register; C1: precise cohesive academic/professional expression; C2: nuanced, economical and stylistically flexible extended expression.',
};

/** Reused by the existing Examiner. No target language has a special branch;
 * the calling server supplies target/support languages and canonical IDs. */
export function placementRubricDirective(round: LanguagePlacementRound): string {
  const floor = ({ 1: 'PRE_A1', 2: 'B1', 3: 'C1' } as const)[round];
  return [
    `Language placement policy: ${LANGUAGE_PLACEMENT_POLICY_VERSION}. Round ${round} of at most 3.`,
    `Assess ${floor} through ${placementRoundCeiling(round)}. Never award a level above this round's ceiling. A lower demonstrated level remains valid.`,
    'Use the configured support language for understandable instructions/feedback and the target language for the material being assessed. Do not expose expected answers, translations revealing answers or help before submission.',
    'Assess vocabulary, grammar, reading and writing separately with one identifiable question per skill. Bind each observation to the actual question, assessment and persisted submission.',
    'Report the highest level independently demonstrated by the actual answer, with a concise reason and an exact evidence quote. A blank or insufficient answer may demonstrate PRE_A1; a technical inability to evaluate is null, never a fabricated level.',
    ...LANGUAGE_PLACEMENT_REQUIRED_SKILLS.map((skill) => `${skill}: ${SKILL_RUBRICS[skill]}`),
    'Self-estimation is context only: it cannot award a level or skip the first round. Placement is not a 90% mastery exam; do not convert a numeric total into CEFR automatically.',
    'Optional listening/speaking may be reported separately only from actual available evidence. They never block this written diagnostic or replace a required skill. A transcript is not acoustic pronunciation evidence.',
  ].join('\n');
}
