import type { LearnerAgeBand, TeachingStrategy } from '@second-brain/shared';

/**
 * Teaching Strategy Engine (Sprint 7.9, ITE Engine).
 *
 * Chooses the pedagogical strategy the AI teacher uses to CONDUCT a session —
 * not just answer questions. Selection is deterministic and grounded in real
 * signals the rest of Second Brain already produces: the subject (role engine),
 * the learner's mastery of the focused concept (ConceptMastery / Digital Twin),
 * whether it is a language session, and — when known — the learner's style.
 * The chosen strategy is turned into a directive injected into the tutor prompt.
 */

export interface StrategyContext {
  /** Detected subject/discipline, or null. */
  subject: string | null;
  /** True for language-practice sessions. */
  isLanguage: boolean;
  /** Mastery of the focused concept (0..1), or null when none/unassessed. */
  mastery: number | null;
  /** Optional learner learning-style hint (pluggable; unused → ignored). */
  learningStyle?: string | null;
  /** Self-declared Passport age band. It shapes delivery, never mastery or the
   * assessment standard. */
  ageBand?: LearnerAgeBand | null;
}

export type AgeTeachingStyle =
  | 'simple_concrete'
  | 'school_exam'
  | 'academic_professional';

export interface AgeTeachingPolicy {
  sourceAgeBand: LearnerAgeBand;
  audience: 'child' | 'adolescent' | 'adult';
  style: AgeTeachingStyle;
}

export interface StrategySelection {
  strategy: TeachingStrategy;
  /** Learner-facing reason, kept short. */
  reason: string;
  /** Server-derived delivery policy from the persisted Passport age band. */
  agePolicy: AgeTeachingPolicy | null;
}

/** Map the repository's existing age bands to a bounded delivery policy. This
 * is part of the ITE: it changes method and density, never measured mastery or
 * an assessment rubric. Unknown/missing legacy values deliberately map to null
 * rather than a silent default. */
export function resolveAgeTeachingPolicy(
  ageBand?: LearnerAgeBand | null,
): AgeTeachingPolicy | null {
  if (ageBand === 'under12') {
    return { sourceAgeBand: ageBand, audience: 'child', style: 'simple_concrete' };
  }
  if (ageBand === '12to15' || ageBand === '16to18') {
    return { sourceAgeBand: ageBand, audience: 'adolescent', style: 'school_exam' };
  }
  if (ageBand === '18to25' || ageBand === '25to40' || ageBand === 'over40') {
    return { sourceAgeBand: ageBand, audience: 'adult', style: 'academic_professional' };
  }
  return null;
}

/** Concrete method directive for the policy selected by the ITE. Stable codes
 * make the decision auditable without exposing private Passport values. */
export function agePolicyDirective(policy: AgeTeachingPolicy): string {
  const prefix =
    ` Age-adaptive ITE policy: audience=${policy.audience}; style=${policy.style}.`;
  const assessmentInvariant =
    ' This policy changes delivery only: never lower, change or bypass an announced assessment rubric, assistance rule or grading standard.';
  if (policy.style === 'simple_concrete') {
    return prefix +
      ' Use accessible vocabulary, one idea at a time, short guided steps and concrete familiar examples. Model the first step, then let the learner try with patient, specific encouragement.' +
      assessmentInvariant;
  }
  if (policy.style === 'school_exam') {
    return prefix +
      ' Use school-level vocabulary and examples, support growing autonomy, then use a short exercise or exam-preparation check when relevant. Guide without taking over the learner\'s work.' +
      assessmentInvariant;
  }
  return prefix +
    ' Use denser academic or technical vocabulary, concise scaffolding and greater learner autonomy. Prefer rigorous disciplinary examples and do not default to child-like simplification unless observed difficulty requires it.' +
    assessmentInvariant;
}

/** Resolve the final precedence between the subject method, age delivery,
 * assessment context and learner languages. Keeping this directive last in the
 * Teacher Context makes the hierarchy unambiguous without creating a second
 * teaching engine or weakening any assessment rule. */
export function adaptiveInstructionPriorityDirective(
  policy: AgeTeachingPolicy,
): string {
  const examPriority = policy.style === 'school_exam'
    ? ' The active school_exam context remains in force throughout the response. The subject teaching strategy is a method used inside that exam-oriented policy, not a replacement for it.'
    : ' The subject teaching strategy operates inside this age-adaptive delivery policy, not in place of it.';
  return (
    ' Adaptive Teacher Context instruction priority:' +
    ' (1) any active assessment or exam context and its rubric remain authoritative;' +
    examPriority +
    ' (2) use the declared explanation language for explanatory prose;' +
    ' (3) preserve relevant academic and technical terminology in the declared teaching language when it is useful. This is an intentional exception to single-language prose and does not switch the explanation language;' +
    ' (4) age adaptation changes scaffolding, pacing and presentation only. It must never lower the expected level, grading standard or assistance rules.'
  );
}

/** How the teacher runs each strategy — the METHOD half of the directive. */
const STRATEGY_METHOD: Record<TeachingStrategy, string> = {
  socratic:
    'Lead by questioning: draw understanding out with short guiding questions rather than lecturing; let the learner reason before you confirm.',
  project_based:
    'Frame the learning around building a concrete project or artefact; teach each notion as the project needs it.',
  problem_solving:
    'Centre the session on solving concrete problems step by step; have the learner attempt each step before you show it.',
  case_study:
    'Anchor the teaching in a realistic case or scenario and analyse it together, drawing the principles out of it.',
  task_based:
    'Organise the session around a real communicative task to accomplish; teach what the task requires, in use.',
  guided_demonstration:
    'Demonstrate worked examples first, thinking aloud, then progressively hand over as the learner takes the wheel (fading scaffolding).',
  active_learning:
    'Keep the learner doing: frequent short activities and retrieval, minimal uninterrupted lecturing.',
  experiential:
    'Learn through concrete experience then reflection on it: try, observe what happened, and abstract the lesson together.',
};

/** Human labels for display. */
export const STRATEGY_LABEL: Record<TeachingStrategy, string> = {
  socratic: 'Socratic method',
  project_based: 'Project-based learning',
  problem_solving: 'Problem solving',
  case_study: 'Case study',
  task_based: 'Task-based (action-oriented)',
  guided_demonstration: 'Guided demonstration',
  active_learning: 'Active learning',
  experiential: 'Experiential learning',
};

/** The pedagogical arc every strategy follows — this is what turns a chat into a
 *  real course that never loses context. */
const PEDAGOGICAL_ARC =
  ' Conduct this as a genuine lesson, not just Q&A: welcome the learner and state' +
  ' the objective, explain progressively with examples and analogies, check' +
  ' understanding with questions, watch for cognitive blocks and reformulate the' +
  ' moment you see confusion, adapt the pace, encourage and motivate, offer' +
  ' practice, and conclude with a short recap. You decide when to explain, when to' +
  ' ask, when to let the learner think, when to practise, when to revisit a notion,' +
  ' when to switch method, and when to close. Keep the thread across turns and' +
  ' never lose the context of what has already been covered.';

// Subject buckets (lowercased substring match).
const STEM_PROBLEM = [
  'math', 'mathématiques', 'mathematics', 'algebra', 'algèbre', 'calculus',
  'physics', 'physique', 'chemistry', 'chimie', 'statistic', 'statistiques',
  'engineering', 'ingénierie', 'economics', 'économie', 'accounting', 'finance',
];
const CODING = ['program', 'programmation', 'coding', 'code', 'software', 'informatique', 'algorithm', 'comput', 'developer', 'développement'];
const CASE_SUBJECTS = ['law', 'droit', 'medicine', 'médecine', 'business', 'management', 'marketing', 'ethics', 'éthique'];
const HUMANITIES = [
  'history', 'histoire', 'philosophy', 'philosophie', 'literature', 'littérature',
  'politic', 'sociolog', 'psycholog', 'geography', 'géographie',
];

function matches(subject: string, needles: string[]): boolean {
  return needles.some((n) => subject.includes(n));
}

export function selectStrategy(ctx: StrategyContext): StrategySelection {
  const subject = (ctx.subject ?? '').toLowerCase();
  const learningStyle = (ctx.learningStyle ?? '').toLowerCase();
  const low = ctx.mastery !== null && ctx.mastery < 0.35;
  const high = ctx.mastery !== null && ctx.mastery >= 0.75;
  const agePolicy = resolveAgeTeachingPolicy(ctx.ageBand);
  const selection = (
    strategy: TeachingStrategy,
    reason: string,
  ): StrategySelection => ({ strategy, reason, agePolicy });

  // Languages are inherently communicative → action-oriented (approche actionnelle).
  if (ctx.isLanguage) {
    return selection(
      'task_based',
      'A language is learned by using it, so the teacher builds the session around real communicative tasks.',
    );
  }

  // A shaky foundation needs modelling before independence, whatever the subject.
  if (low) {
    return selection(
      'guided_demonstration',
      'Your mastery here is still forming, so the teacher demonstrates worked examples first and hands over gradually.',
    );
  }

  // A learner-declared Passport preference may steer the existing ITE, but it
  // never overrides language pedagogy or low-mastery scaffolding above.
  if (/project|projet/.test(learningStyle)) {
    return selection(
      'project_based',
      'Your declared preference is to learn through projects, so the session is organised around a concrete artefact.',
    );
  }
  if (/visual|demonstrat|worked example|exemple/.test(learningStyle)) {
    return selection(
      'guided_demonstration',
      'Your declared preference is for visual or worked demonstrations, so the teacher models an example before handing over.',
    );
  }
  if (/hands.on|practical|pratique|experien/.test(learningStyle)) {
    return selection(
      'experiential',
      'Your declared preference is to learn by doing, so the teacher uses concrete experience and reflection.',
    );
  }

  if (matches(subject, CODING)) {
    return selection(
      'project_based',
      'Programming sticks when you build something, so the session is organised around a small project.',
    );
  }
  if (matches(subject, STEM_PROBLEM)) {
    return selection(
      'problem_solving',
      'This is a problem-driven subject, so the teacher works through problems with you step by step.',
    );
  }
  if (matches(subject, CASE_SUBJECTS)) {
    return selection(
      'case_study',
      'This subject lives in real cases, so the teacher anchors it in a concrete scenario to analyse.',
    );
  }

  // Strong learners are pushed into applying and experiencing rather than being told.
  if (high) {
    return selection(
      'experiential',
      'You already have a solid grasp, so the teacher pushes you to apply it and reflect on the experience.',
    );
  }

  if (matches(subject, HUMANITIES)) {
    return selection(
      'socratic',
      'This is a discussion-driven subject, so the teacher leads with guiding questions.',
    );
  }

  // Sensible universal default: question-led teaching.
  return selection(
    'socratic',
    'The teacher leads with guiding questions so you reason your way to understanding.',
  );
}

/** The full strategy directive injected into the tutor system prompt. */
export function strategyDirective(strategy: TeachingStrategy): string {
  return ` Teaching strategy: ${STRATEGY_LABEL[strategy]}. ${STRATEGY_METHOD[strategy]}${PEDAGOGICAL_ARC}`;
}
