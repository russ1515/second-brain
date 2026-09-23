import type {
  CefrLevel,
  RlleGoalDomain,
  RlleWorldMissionTemplate,
} from '@second-brain/shared';

export const CEFR_RANK: Record<CefrLevel, number> = {
  A1: 0,
  A2: 1,
  B1: 2,
  B2: 3,
  C1: 4,
  C2: 5,
};

interface UnitGuidance {
  title: string;
  objective: string;
}

const UNIT_GUIDANCE: Record<string, UnitGuidance> = {
  'a1-first-contact': {
    title: 'First contact and introductions',
    objective: 'Introduce yourself, greet someone, and exchange essential personal information.',
  },
  'a1-daily-needs': {
    title: 'Everyday needs',
    objective: 'Handle basic everyday needs with frequent words, verbs, questions, and numbers.',
  },
  'a1-survival': {
    title: 'Communication survival skills',
    objective: 'Ask for repetition, clarification, slower speech, and help when communication breaks down.',
  },
  'a2-routines': {
    title: 'Routines and practical messages',
    objective: 'Describe routines and write short practical messages using common present forms.',
  },
  'a2-past-plans': {
    title: 'Past experiences and plans',
    objective: 'Describe a simple past event and communicate near-future plans.',
  },
  'a2-travel-study': {
    title: 'Travel and study essentials',
    objective: 'Find, understand, and relay practical information while travelling or studying.',
  },
  'b1-experiences': {
    title: 'Narrating experiences',
    objective: 'Tell a coherent story, connect events, and express personal reactions.',
  },
  'b1-work-travel': {
    title: 'Independent work and travel',
    objective: 'Manage common professional and travel interactions without a prepared script.',
  },
  'b1-opinions': {
    title: 'Explaining and supporting opinions',
    objective: 'State an opinion, give reasons, respond to another view, and write a structured response.',
  },
  'b2-collaboration': {
    title: 'Collaborating fluently',
    objective: 'Participate actively in extended meetings, discussions, and presentations.',
  },
  'b2-argument': {
    title: 'Building an argument',
    objective: 'Compare viewpoints, qualify claims, synthesize input, and defend a position.',
  },
  'b2-professional': {
    title: 'Professional production',
    objective: 'Produce clear professional email, presentations, and domain-appropriate interaction.',
  },
  'c1-complex-input': {
    title: 'Understanding complex input',
    objective: 'Interpret implicit meaning and mediate dense spoken and written information.',
  },
  'c1-influence': {
    title: 'Influencing and negotiating',
    objective: 'Adapt register, formulate nuanced positions, and negotiate effectively.',
  },
  'c1-production': {
    title: 'Precise extended production',
    objective: 'Create precise, well-structured professional or academic language for demanding contexts.',
  },
  'c2-nuance': {
    title: 'Nuance and implicit meaning',
    objective: 'Recognize and use subtle distinctions, idiomatic language, and implicit meaning.',
  },
  'c2-adaptation': {
    title: 'Effortless adaptation',
    objective: 'Reformulate and mediate flexibly across audiences, registers, and difficult interactions.',
  },
  'c2-mastery': {
    title: 'Integrated language mastery',
    objective: 'Combine comprehension, interaction, mediation, and production in complex real-life tasks.',
  },
};

const MISSION_DIRECTIVES: Record<string, string> = {
  'travel-airport': 'Role-play an airport interaction in which the learner must obtain and verify travel information.',
  'travel-hotel': 'Role-play a hotel interaction in which the learner must explain a concrete problem and seek a solution.',
  'travel-restaurant': 'Role-play a restaurant interaction in which the learner must understand choices and place an order.',
  'travel-transport': 'Role-play a public-transport interaction in which the learner must understand a route and confirm details.',
  'travel-directions': 'Role-play asking for and checking directions to a destination.',
  'travel-emergency': 'Role-play an urgent travel problem in which the learner must explain what happened and obtain help.',
  'work-interview': 'Conduct a realistic job interview in which the learner presents experience and answers follow-up questions.',
  'work-meeting': 'Simulate a work meeting in which the learner must contribute, clarify, and respond to colleagues.',
  'work-presentation': 'Simulate a professional presentation with spontaneous audience questions.',
  'work-email': 'Simulate a professional email task requiring an appropriate request, context, and next step.',
  'work-negotiation': 'Run a negotiation in which the learner must clarify interests, respond, and seek agreement.',
  'studies-lecture': 'Present a short academic explanation that the learner must understand, summarize, and clarify.',
  'studies-synthesis': 'Present connected spoken and written academic input that the learner must synthesize and mediate accurately.',
  'studies-presentation': 'Simulate an academic presentation followed by substantive questions.',
  'studies-discussion': 'Run an academic discussion in which the learner must explain, compare, and mediate ideas.',
  'studies-teacher': 'Role-play a conversation with a teacher in which the learner asks for help and clarifies instructions.',
  'studies-administration': 'Role-play an administrative request in which the learner must understand and provide practical information.',
  'social-introduction': 'Role-play a first meeting in which the learner greets, introduces themself, and asks a natural question.',
  'social-chat': 'Hold an unscripted social conversation with natural follow-up questions and clarification.',
  'social-story': 'Invite the learner to tell a past event, then react and ask natural follow-up questions.',
  'social-invitation': 'Role-play making, accepting, declining, or adjusting a social invitation.',
  'social-debate': 'Run a respectful debate requiring reasons, responses, nuance, and reformulation.',
};

export function unitGuidance(unitId: string): UnitGuidance {
  return UNIT_GUIDANCE[unitId] ?? {
    title: unitId.replace(/^[a-z]\d-/, '').replace(/-/g, ' '),
    objective: 'Use the target language successfully in the unit communication task.',
  };
}

export function missionDirective(mission: RlleWorldMissionTemplate): string {
  return MISSION_DIRECTIVES[mission.id] ??
    `Run a dynamic ${mission.category} situation. The learner must accomplish the communicative task rather than follow a fixed script.`;
}

export function inferGoalDomain(goal: string | null | undefined): RlleGoalDomain {
  const normalized = goal?.toLocaleLowerCase('en') ?? '';
  if (/work|job|career|professional|international|meeting|interview|emploi|travail|réunion|entretien/.test(normalized)) return 'work';
  if (/travel|trip|holiday|airport|hotel|voyage|vacances|aéroport/.test(normalized)) return 'travel';
  if (/study|school|university|exam|academic|étude|école|université|examen/.test(normalized)) return 'studies';
  if (/friend|family|social|people|ami|famille|social/.test(normalized)) return 'social';
  return 'general';
}

export function lessonDifficulty(level: CefrLevel): 'beginner' | 'intermediate' | 'advanced' {
  if (level === 'A1' || level === 'A2') return 'beginner';
  if (level === 'B1' || level === 'B2') return 'intermediate';
  return 'advanced';
}

/** CEFR-ordered structural guardrail for generated lessons. The generator must
 * adapt it to the target language instead of imposing English grammar on all
 * 27 supported languages. */
export function languageStructureProgression(level: CefrLevel): string {
  const byLevel: Record<CefrLevel, string> = {
    A1: 'Prioritise high-frequency words and expressions, core pronouns, the most frequent regular and irregular verbs, basic present/reference forms, simple negation and information questions.',
    A2: 'Extend to routine and practical vocabulary, auxiliaries or modals where the language has them, the most useful past and future reference forms, agreement, quantity, place/time relations and polite requests.',
    B1: 'Build narrative control across the language’s main past forms, future plans, comparison, cause, consequence, condition, common verb constructions, collocations and connected clauses.',
    B2: 'Develop aspect and modality, hypothesis and condition, passive or impersonal constructions where relevant, reported meaning, complex questions, concession, register and professional collocations.',
    C1: 'Develop precise tense/mood choice, advanced subordination, indirect discourse, idiomatic and domain vocabulary, cohesive extended production, reformulation and register control.',
    C2: 'Refine nuance, implicit meaning, idioms, stylistic effects, rare irregularities, flexible reformulation and effortless adaptation across registers and audiences.',
  };
  return `${byLevel[level]} Include regular, irregular, auxiliary, modal, reflexive, particle/phrasal or other special verb constructions only when they genuinely exist and are appropriate in the target language.`;
}
