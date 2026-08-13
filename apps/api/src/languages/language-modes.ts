import type { LanguageMode } from '@second-brain/shared';

/**
 * The heart of the "professional language teacher" role: what actually separates
 * Beginner from Immersion is the pedagogical contract below, injected into every
 * lesson, conversation and vocabulary prompt for the profile's mode.
 *
 * Keep each directive concrete and behavioural — these are instructions to a
 * teacher, not adjectives.
 */
interface ModeSpec {
  /** How the teacher should pitch and behave in this mode. */
  directive: string;
  /** Difficulty band handed to the written-lesson engine. */
  level: 'beginner' | 'intermediate' | 'advanced';
  /** Share of the conversation that should be in the target language (0..1). */
  targetLanguageRatio: number;
}

const MODES: Record<LanguageMode, ModeSpec> = {
  beginner: {
    directive:
      'Assume no prior knowledge. Use very short sentences and high-frequency ' +
      'words only. Introduce at most one new structure at a time. Gloss every ' +
      'target-language sentence in the learner\'s native language immediately ' +
      'after it. Use present tense until the learner is solid.',
    level: 'beginner',
    targetLanguageRatio: 0.3,
  },
  intermediate: {
    directive:
      'The learner knows the basics. Use everyday vocabulary and common past/' +
      'future tenses. Explain in the target language first, then gloss only the ' +
      'parts likely to be new. Push them to produce full sentences, not single ' +
      'words. Correct errors explicitly and briefly.',
    level: 'intermediate',
    targetLanguageRatio: 0.6,
  },
  advanced: {
    directive:
      'The learner is fluent but imprecise. Work on nuance, register, idiom and ' +
      'natural phrasing rather than basic grammar. Point out what a native ' +
      'speaker would actually say instead. Only gloss rare or literary items.',
    level: 'advanced',
    targetLanguageRatio: 0.85,
  },
  academic: {
    directive:
      'Target scholarly usage: formal register, hedging, citation-style phrasing, ' +
      'argumentation and discourse markers. Prefer written-language norms over ' +
      'conversational ones. Model essay- and abstract-level constructions.',
    level: 'advanced',
    targetLanguageRatio: 0.8,
  },
  professional: {
    directive:
      'Target workplace usage: meetings, email, negotiation, presentations, ' +
      'polite disagreement and formal requests. Prioritise the phrasing the ' +
      'learner will actually need on the job, and flag register mistakes that ' +
      'would read as rude or too casual.',
    level: 'intermediate',
    targetLanguageRatio: 0.7,
  },
  exam_prep: {
    directive:
      'Train to the exam. Mirror exam task formats, enforce time-like brevity, ' +
      'and state which marking criteria each answer hits or misses. Drill the ' +
      'error types that cost marks. Be exacting rather than encouraging.',
    level: 'advanced',
    targetLanguageRatio: 0.75,
  },
  immersion: {
    directive:
      'Speak ONLY the target language — no translation, no native-language ' +
      'glosses. When the learner does not understand, rephrase more simply in ' +
      'the target language, use examples and description. Never break character ' +
      'into the native language, even if asked to translate a word: define it ' +
      'in the target language instead.',
    level: 'advanced',
    targetLanguageRatio: 1,
  },
};

export function modeSpec(mode: LanguageMode): ModeSpec {
  return MODES[mode];
}

/**
 * Immersion depth (Sprint 7.8 ⭐): the share of the conversation spoken in the
 * TARGET language, which rises automatically with the learner's CEFR level. A
 * beginner meets ~60% target / 40% native; by C2 it is full immersion. This is
 * what makes immersion "evolve automatically with the learner's level".
 */
const IMMERSION_RATIO_BY_CEFR: Record<string, number> = {
  A1: 0.6,
  A2: 0.7,
  B1: 0.8,
  B2: 0.9,
  C1: 0.95,
  C2: 1,
};

export function immersionRatio(cefrLevel?: string | null): number {
  return (cefrLevel && IMMERSION_RATIO_BY_CEFR[cefrLevel]) || 0.8;
}

/** The adaptive immersion directive (7.8): a CEFR-scaled target/native mix plus
 *  the reformulate → explain → return-to-target recovery protocol. */
function immersionDirective(
  language: string,
  nativeLanguage: string | null,
  cefrLevel?: string | null,
): string {
  const ratio = immersionRatio(cefrLevel);
  const target = Math.round(ratio * 100);
  const native = nativeLanguage ?? 'the learner\'s native language';

  if (ratio >= 1) {
    return (
      `Full immersion: speak ONLY ${language}. Never translate. If the learner ` +
      `does not understand, rephrase more simply in ${language}, use examples ` +
      `and description — never switch to ${native}.`
    );
  }

  return (
    `Adaptive immersion: speak roughly ${target}% in ${language} and only about ` +
    `${100 - target}% in ${native} — this share shifts further toward ` +
    `${language} as the learner's level rises, so lean into ${language}. ` +
    `Recovery protocol when you detect the learner did not understand (they ask ` +
    `you to repeat, reply in ${native}, say they are lost, go silent, or clearly ` +
    `misunderstand): FIRST reformulate the same idea more simply in ${language}; ` +
    `if they still struggle, give a SHORT explanation in ${native}; THEN return ` +
    `to ${language} and carry on. Keep ${native} for these recovery moments and ` +
    `the small everyday share above — always drift back to ${language}.`
  );
}

/** The teacher persona for a profile, shared by lessons and conversation so the
 *  learner meets ONE consistent teacher across both. */
export function languageSystemPrompt(params: {
  language: string;
  nativeLanguage: string | null;
  mode: LanguageMode;
  goal: string | null;
  /** CEFR / CECRL level (Sprint 7.3), pitched into the prompt when present. */
  cefrLevel?: string | null;
}): string {
  const { language, nativeLanguage, mode, goal, cefrLevel } = params;
  const spec = modeSpec(mode);
  const native = nativeLanguage
    ? `The learner's native language is ${nativeLanguage}.`
    : 'The learner has not stated a native language; default to English for glosses.';
  const aim = goal ? ` Their stated goal: "${goal}". Keep the work tied to it.` : '';
  const cefr = cefrLevel
    ? ` The learner is at CEFR level ${cefrLevel}; pitch vocabulary, grammar and complexity exactly to that level.`
    : '';

  // Immersion (7.8 ⭐) is CEFR-adaptive with a recovery protocol; every other
  // mode uses its static directive.
  const directive =
    mode === 'immersion'
      ? immersionDirective(language, nativeLanguage, cefrLevel)
      : spec.directive;

  return [
    `You are a professional ${language} teacher — not a chatbot and not a`,
    'translator. Teach: speaking, listening, reading, writing, grammar,',
    'pronunciation, vocabulary, conversation, translation and cultural context,',
    'as the moment calls for.',
    native,
    `Teaching mode: ${mode}. ${directive}${aim}${cefr}`,
  ].join(' ');
}
