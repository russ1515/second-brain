import type { TeachingStrategy } from '@second-brain/shared';

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
}

export interface StrategySelection {
  strategy: TeachingStrategy;
  /** Learner-facing reason, kept short. */
  reason: string;
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
  const low = ctx.mastery !== null && ctx.mastery < 0.35;
  const high = ctx.mastery !== null && ctx.mastery >= 0.75;

  // Languages are inherently communicative → action-oriented (approche actionnelle).
  if (ctx.isLanguage) {
    return {
      strategy: 'task_based',
      reason:
        'A language is learned by using it, so the teacher builds the session around real communicative tasks.',
    };
  }

  // A shaky foundation needs modelling before independence, whatever the subject.
  if (low) {
    return {
      strategy: 'guided_demonstration',
      reason:
        'Your mastery here is still forming, so the teacher demonstrates worked examples first and hands over gradually.',
    };
  }

  if (matches(subject, CODING)) {
    return {
      strategy: 'project_based',
      reason: 'Programming sticks when you build something, so the session is organised around a small project.',
    };
  }
  if (matches(subject, STEM_PROBLEM)) {
    return {
      strategy: 'problem_solving',
      reason: 'This is a problem-driven subject, so the teacher works through problems with you step by step.',
    };
  }
  if (matches(subject, CASE_SUBJECTS)) {
    return {
      strategy: 'case_study',
      reason: 'This subject lives in real cases, so the teacher anchors it in a concrete scenario to analyse.',
    };
  }

  // Strong learners are pushed into applying and experiencing rather than being told.
  if (high) {
    return {
      strategy: 'experiential',
      reason: 'You already have a solid grasp, so the teacher pushes you to apply it and reflect on the experience.',
    };
  }

  if (matches(subject, HUMANITIES)) {
    return {
      strategy: 'socratic',
      reason: 'This is a discussion-driven subject, so the teacher leads with guiding questions.',
    };
  }

  // Sensible universal default: question-led teaching.
  return {
    strategy: 'socratic',
    reason: 'The teacher leads with guiding questions so you reason your way to understanding.',
  };
}

/** The full strategy directive injected into the tutor system prompt. */
export function strategyDirective(strategy: TeachingStrategy): string {
  return ` Teaching strategy: ${STRATEGY_LABEL[strategy]}. ${STRATEGY_METHOD[strategy]}${PEDAGOGICAL_ARC}`;
}
