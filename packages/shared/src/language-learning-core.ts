import type { CefrLevel } from './language';
import type { LanguageProductLevel } from './language-placement';
import type { SupportedLanguageCode } from './languages';
import { LANGUAGE_MASTERY_THRESHOLD } from './language-mastery';

/** Additive post-placement curriculum. Placement and the existing five-pillar
 * certification keep their own immutable policies and evidence. */
export const LANGUAGE_LEARNING_CORE_VERSION = 'language-learning-core-v1' as const;
export const LANGUAGE_LEARNING_CONTENT_VERSION = 1 as const;
export const LANGUAGE_LEARNING_MODULE_IDS = [
  'basics', 'greetings-introductions', 'vocabulary-expressions',
  'grammar-sentence-building', 'conjugation', 'listening-comprehension',
  'pronunciation-fluency', 'speaking-oral-expression', 'conversation',
  'reading-comprehension', 'practice-review-assessment',
] as const;
export type LanguageLearningModuleId = (typeof LANGUAGE_LEARNING_MODULE_IDS)[number];
export type LanguageLearningState =
  | 'LOCKED' | 'AVAILABLE' | 'IN_PROGRESS' | 'NEEDS_REMEDIATION'
  | 'MASTERED' | 'NOT_EVALUABLE';
export type LanguageLearningCurriculumStatus = 'COMPLETE' | 'PARTIAL';

export const LANGUAGE_LEARNING_TOOLKIT = [
  'vocabulary-exercises', 'sentence-building', 'grammar-exercises',
  'conjugation', 'listening-questions', 'reading-questions',
  'pronunciation-practice', 'speaking-exercises', 'rapid-question-answer',
  'fill-blank', 'reorder-sentence', 'find-error', 'correct-sentence',
  'pedagogical-translation', 'dictation', 'flashcards', 'spaced-repetition',
  'error-review', 'role-play', 'real-life-scenario', 'lesson-quiz',
  'module-test', 'oral-test-when-valid', 'evaluated-conversation',
  'weak-point-review', 'remediation', 'reassessment', 'end-of-level-exam',
] as const;

export interface LanguageLearningCriterion {
  id: string;
  description: string;
}

export interface LanguageLearningLessonDefinition {
  id: string;
  moduleId: LanguageLearningModuleId;
  order: number;
  title: string;
  objective: string;
  skills: string[];
  criteria: LanguageLearningCriterion[];
  contentVersion: typeof LANGUAGE_LEARNING_CONTENT_VERSION;
  /** Written knowledge is assessable; it is never an acoustic observation. */
  requiresAcousticAssessment: boolean;
}

export interface LanguageLearningModuleDefinition {
  id: LanguageLearningModuleId;
  order: number;
  title: string;
  kind: 'curriculum' | 'transversal';
  acousticAssessmentRequired: boolean;
  lessons: LanguageLearningLessonDefinition[];
  toolkit: string[];
}

export interface LanguageLearningCatalogue {
  version: typeof LANGUAGE_LEARNING_CORE_VERSION;
  languageCode: SupportedLanguageCode;
  productLevel: LanguageProductLevel;
  cefrLevel: CefrLevel;
  cefrLevels: CefrLevel[];
  /** Complete describes stable curriculum definitions, not generated lesson
   * content, learner mastery, oral capability or human linguistic review. */
  curriculumStatus: LanguageLearningCurriculumStatus;
  modules: LanguageLearningModuleDefinition[];
}

/** Only canonical, owner-scoped submissions reloaded by the API belong here.
 * The API validates the assessment's immutable scope/content version, rubric,
 * submitted answers and provenance. Browser claims/chat are never evidence. */
export interface LanguageLearningCoreEvidence {
  scope: 'lesson' | 'module' | 'level';
  targetId: string;
  contentVersion: number;
  submissionId: string;
  completionId: string | null;
  state: 'evaluated' | 'not-evaluable';
  awardedPoints: number | null;
  maximumPoints: number | null;
  evaluatedAt: string;
  weakLessonIds?: string[];
  weakConcepts?: string[];
  /** A pedagogical retry, not a new mastery system or client-written score. */
  remediation?: boolean;
}

export interface LanguageLearningLessonView extends LanguageLearningLessonDefinition {
  status: LanguageLearningState;
  /** Raw ratio 0..1; null means no valid evaluation, never zero. */
  score: number | null;
  bestScore: number | null;
  weakConcepts: string[];
  remediationCount: number;
  masteredAt: string | null;
  lastActivityAt: string | null;
  completionId: string | null;
}

export interface LanguageLearningModuleView extends Omit<LanguageLearningModuleDefinition, 'lessons'> {
  status: LanguageLearningState;
  /** Written practice is complete, but unavailable acoustic evidence has NOT
   * certified this module. This permits only continued practice/navigation. */
  practiceOnlyProgression: boolean;
  lessons: LanguageLearningLessonView[];
  score: number | null;
  bestScore: number | null;
  masteredLessons: number;
  totalLessons: number;
  assessmentAvailable: boolean;
  assessmentBlockedReason: 'acoustic-unavailable' | 'lessons-incomplete' | 'prerequisite-incomplete' | 'catalogue-unavailable' | null;
  weakLessonIds: string[];
}

export interface LanguageLearningCoreNextAction {
  kind: 'start-lesson' | 'resume-lesson' | 'remediate-lesson'
    | 'module-assessment' | 'module-remediation' | 'level-assessment'
    | 'next-level' | 'capability-blocked' | 'catalogue-unavailable';
  moduleId: LanguageLearningModuleId | null;
  lessonId: string | null;
}

export interface LanguageLearningCoreView extends Omit<LanguageLearningCatalogue, 'modules'> {
  modules: LanguageLearningModuleView[];
  currentModuleId: LanguageLearningModuleId | null;
  currentLessonId: string | null;
  nextAction: LanguageLearningCoreNextAction;
  levelStatus: LanguageLearningState;
  levelScore: number | null;
  levelBestScore: number | null;
  levelWeakLessonIds: string[];
  levelAssessmentAvailable: boolean;
  nextProductLevel: LanguageProductLevel | null;
  pronunciationAcoustic: 'BLOCKED_CAPABILITY';
}

const MODULE_TITLES: Record<LanguageLearningModuleId, string> = {
  basics: 'Basics',
  'greetings-introductions': 'Greetings & Introductions',
  'vocabulary-expressions': 'Vocabulary & Expressions',
  'grammar-sentence-building': 'Grammar & Sentence Building',
  conjugation: 'Conjugation',
  'listening-comprehension': 'Listening Comprehension',
  'pronunciation-fluency': 'Pronunciation & Fluency',
  'speaking-oral-expression': 'Speaking / Oral Expression',
  conversation: 'Conversation',
  'reading-comprehension': 'Reading & Written Comprehension',
  'practice-review-assessment': 'Practice, Review & Assessment',
};

const LEVELS: Record<LanguageProductLevel, CefrLevel[]> = {
  BEGINNER: ['A1', 'A2'], INTERMEDIATE: ['B1', 'B2'], ADVANCED: ['C1', 'C2'],
};

/** Stable lesson ids are explicit, not derived from mutable translated text.
 * These are target-language curriculum labels, not UI localization fallback. */
const ENGLISH_BEGINNER_LESSONS: Partial<Record<LanguageLearningModuleId, readonly (readonly [string, string])[]>> = {
  basics: [
    ['english-alphabet', 'English alphabet'],
    ['main-letter-sounds', 'Main letter sounds'],
    ['numbers-0-20', 'Numbers 0–20'],
    ['numbers-20-1000', 'Numbers 20–1000'],
    ['days-week', 'Days of the week'],
    ['months', 'Months'],
    ['dates', 'Dates'],
    ['time', 'Time'],
    ['colors', 'Colors'],
    ['personal-pronouns', 'Personal pronouns'],
    ['demonstratives', 'This / That / These / Those'],
    ['question-words', 'What / Who / Where / When / Why / How'],
    ['position-words', 'Basic position words'],
    ['directions', 'Basic directions'],
    ['everyday-words', 'Essential everyday words'],
  ],
  'greetings-introductions': [
    ['hello', 'Saying hello'], ['goodbye', 'Saying goodbye'],
    ['asking-wellbeing', 'Asking how someone is'], ['responding', 'Responding'],
    ['saying-name', 'Saying your name'], ['asking-name', "Asking someone's name"],
    ['saying-age', 'Saying your age'], ['saying-origin', 'Saying where you are from'],
    ['asking-origin', 'Asking where someone is from'], ['residence', 'Saying where you live'],
    ['work', 'Talking about work'], ['studies', 'Talking about studies'],
    ['introducing-another', 'Introducing another person'],
    ['thanks-apologies', 'Thanking and apologizing'],
    ['full-introduction', 'Full beginner introduction conversation'],
  ],
  'vocabulary-expressions': [
    ['family', 'Family'], ['home', 'Home'], ['everyday-objects', 'Everyday objects'],
    ['food', 'Food'], ['drinks', 'Drinks'], ['clothes', 'Clothes'], ['body', 'Body'],
    ['jobs', 'Jobs'], ['school-studies', 'School / studies'], ['work', 'Work'],
    ['city', 'City'], ['transport', 'Transport'], ['public-places', 'Public places'],
    ['animals', 'Animals'], ['weather', 'Weather'], ['emotions', 'Emotions'],
    ['hobbies', 'Hobbies'], ['sports', 'Sports'], ['shopping-money', 'Shopping / money'],
    ['health', 'Health'], ['travel', 'Travel'], ['technology', 'Technology'],
    ['common-verbs', 'Common verbs'], ['common-adjectives', 'Common adjectives'],
    ['essential-expressions', 'Essential expressions'],
  ],
  'grammar-sentence-building': [
    ['subject-verb-object', 'Subject + Verb + Object'], ['to-be-sentence', 'To Be in a sentence'],
    ['articles', 'A / An / The'], ['singular-plural', 'Singular / plural'],
    ['demonstratives', 'This / That / These / Those'], ['there-is-are', 'There is / There are'],
    ['adjectives', 'Adjectives'], ['possessive-adjectives', 'Possessive adjectives'],
    ['have-has', 'Have / Has'], ['affirmative', 'Affirmative sentences'],
    ['negative', 'Negative sentences'], ['questions', 'Questions'],
    ['what-questions', 'What questions'], ['where-questions', 'Where questions'],
    ['who-questions', 'Who questions'], ['when-questions', 'When questions'],
    ['why-questions', 'Why questions'], ['how-questions', 'How questions'],
    ['prepositions-place', 'Prepositions of place'], ['prepositions-time', 'Prepositions of time'],
    ['some-any', 'Some / Any'], ['much-many', 'Much / Many'], ['can-cant', "Can / Can't"],
    ['connectors', 'Because / But / And'], ['longer-sentences', 'Building longer sentences'],
  ],
  conjugation: [
    ['be-present', 'To Be — present'], ['have-present', 'To Have — present'],
    ['regular-verbs', 'Essential regular verbs'], ['present-simple', 'Present Simple'],
    ['third-person-s', 'He / She / It + S'], ['do-does', 'Do / Does'],
    ['present-negative', 'Present negative form'], ['present-questions', 'Present questions'],
    ['present-continuous', 'Present Continuous'],
    ['simple-vs-continuous', 'Present Simple vs Present Continuous'],
    ['past-simple', 'Past Simple'], ['was-were', 'Was / Were'], ['did-didnt', "Did / Didn't"],
    ['irregular-introduction', 'Intro to irregular verbs'], ['go-went', 'Go → Went'],
    ['come-came', 'Come → Came'], ['eat-ate', 'Eat → Ate'], ['see-saw', 'See → Saw'],
    ['have-had', 'Have → Had'], ['will', 'Will'], ['going-to', 'Going To'],
    ['can-could', 'Can / Could'], ['should', 'Should'], ['would-like', 'Would Like'],
    ['tense-review', 'Present / Past / Future review'],
  ],
  'listening-comprehension': [
    ['simple-words', 'Recognizing simple words'], ['numbers', 'Numbers'],
    ['greetings', 'Greetings'], ['introductions', 'Introductions'],
    ['simple-questions', 'Simple questions'], ['instructions', 'Instructions'],
    ['family-dialogue', 'Family dialogue'], ['restaurant', 'Restaurant'],
    ['shopping', 'Shopping'], ['directions', 'Directions'], ['work', 'Work'],
    ['school', 'School'], ['daily-routine', 'Daily routine'], ['past-event', 'Past event'],
    ['telephone', 'Telephone'], ['key-information', 'Key information'],
    ['without-every-word', 'Understanding without translating every word'],
    ['faster-dialogue', 'Faster beginner dialogue'], ['different-speakers', 'Different speakers'],
    ['full-conversation', 'Full beginner conversation'],
  ],
  'pronunciation-fluency': [
    ['essential-sounds', 'Essential English sounds'],
    ['support-language-sounds', 'Difficult sounds relative to support language'],
    ['th', 'TH'], ['english-r', 'English R'], ['h', 'H'], ['w', 'W'],
    ['short-vowels', 'Short vowels'], ['long-vowels', 'Long vowels'], ['endings', 'Endings'],
    ['s-endings', '-S'], ['ed-endings', '-ED'], ['word-stress', 'Word stress'],
    ['sentence-stress', 'Sentence stress'], ['rhythm', 'Rhythm'], ['linking', 'Linking'],
    ['listen-repeat', 'Listen and repeat'], ['shadowing', 'Simple shadowing'],
    ['not-word-by-word', 'Avoid word-by-word speech'], ['hesitation', 'Reduce hesitation'],
    ['read-aloud', 'Reading aloud'], ['repeat-dialogue', 'Repeating a dialogue'],
    ['speak-30-seconds', 'Speaking 30 seconds continuously'], ['speak-minute', 'Speaking 1 minute'],
    ['personalized-correction', 'Personalized correction'], ['fluency-challenge', 'Fluency challenge'],
  ],
  'speaking-oral-expression': [
    ['introduce-self', 'Introduce yourself'], ['introduce-family', 'Introduce your family'],
    ['describe-person', 'Describe a person'], ['describe-home', 'Describe your home'],
    ['studies', 'Talk about studies'], ['work', 'Talk about work'], ['hobbies', 'Talk about hobbies'],
    ['likes', 'Talk about likes'], ['dislikes', 'Talk about dislikes'],
    ['describe-day', 'Describe your day'], ['habits', 'Talk about habits'],
    ['now', 'Say what you are doing now'], ['yesterday', 'Talk about yesterday'],
    ['weekend', 'Talk about the weekend'], ['plans', 'Talk about future plans'],
    ['holidays', 'Talk about holidays'], ['describe-image', 'Describe an image'],
    ['simple-problem', 'Explain a simple problem'], ['opinion', 'Give an opinion'],
    ['simple-reason', 'Give a simple reason'], ['ask-questions', 'Ask questions'],
    ['respond-spontaneously', 'Respond spontaneously'], ['one-minute', 'Speak for 1 minute'],
    ['two-minutes', 'Speak for 2 minutes'], ['mini-presentation', 'Mini presentation'],
  ],
  conversation: [
    ['first-meeting', 'First meeting'], ['getting-to-know', 'Getting to know someone'],
    ['family', 'Family'], ['studies', 'Studies'], ['work', 'Work'], ['daily-life', 'Daily life'],
    ['hobbies', 'Hobbies'], ['restaurant', 'Restaurant'], ['ordering', 'Ordering'],
    ['shopping', 'Shopping'], ['asking-price', 'Asking price'], ['directions', 'Directions'],
    ['taxi', 'Taxi'], ['airport', 'Airport'], ['hotel', 'Hotel'], ['school', 'School'],
    ['workplace', 'Workplace'], ['doctor', 'Doctor'], ['asking-help', 'Asking for help'],
    ['explaining-problem', 'Explaining a problem'], ['phone', 'Phone conversation'],
    ['invitation', 'Invitation'], ['accept-refuse', 'Accept / refuse'], ['plans', 'Future plans'],
    ['past-experience', 'Past experience'], ['opinion', 'Giving an opinion'],
    ['agree-disagree', 'Agree / disagree'], ['natural-questions', 'Natural questions'],
    ['free-five-minutes', 'Free conversation — 5 minutes'],
    ['free-ten-minutes', 'Free conversation — 10 minutes'],
  ],
  'reading-comprehension': [
    ['simple-words', 'Simple words'], ['short-sentences', 'Short sentences'],
    ['personal-introduction', 'Personal introduction'], ['message', 'Message'], ['sms', 'SMS'],
    ['simple-email', 'Simple email'], ['written-dialogue', 'Written dialogue'],
    ['description', 'Description'], ['short-story', 'Short story'], ['menu', 'Menu'],
    ['sign-poster', 'Sign / poster'], ['instructions', 'Instructions'], ['timetable', 'Timetable'],
    ['advertisement', 'Advertisement'], ['family-text', 'Family text'], ['work-text', 'Work text'],
    ['travel-text', 'Travel text'], ['main-idea', 'Main idea'],
    ['specific-information', 'Finding specific information'], ['context', 'Guessing from context'],
    ['text-questions', 'Questions about a text'], ['short-summary', 'Short summary'],
    ['mini-article', 'Mini article'], ['global-comprehension', 'Global comprehension without translating'],
    ['reading-assessment', 'Beginner reading assessment'],
  ],
};

const MODULE_SKILLS: Record<LanguageLearningModuleId, string[]> = {
  basics: ['recognition', 'form-meaning', 'everyday-use'],
  'greetings-introductions': ['social-interaction', 'question-response', 'self-introduction'],
  'vocabulary-expressions': ['contextual-lexicon', 'meaning', 'sentence-use'],
  'grammar-sentence-building': ['sentence-structure', 'form-choice', 'independent-production'],
  conjugation: ['verb-form', 'time-reference', 'sentence-production'],
  'listening-comprehension': ['key-information', 'meaning', 'context'],
  'pronunciation-fluency': ['sound-awareness', 'stress-awareness', 'guided-practice'],
  'speaking-oral-expression': ['message-planning', 'expression', 'interaction'],
  conversation: ['turn-taking', 'relevance', 'clarification'],
  'reading-comprehension': ['main-idea', 'specific-information', 'inference'],
  'practice-review-assessment': ['retrieval', 'transfer', 'independent-assessment'],
};

function lessonObjective(moduleId: LanguageLearningModuleId, title: string): string {
  if (moduleId === 'basics' && title === 'English alphabet') {
    return 'Recognize the 26 English letters and use their names to spell familiar names and everyday words.';
  }
  const tasks: Record<LanguageLearningModuleId, string> = {
    basics: 'Recognize the forms, explain their meaning and use them in a short everyday exchange',
    'greetings-introductions': 'Take part in a polite beginner exchange with an appropriate question and response',
    'vocabulary-expressions': 'Use relevant words and expressions in complete contextual sentences, not isolated lists',
    'grammar-sentence-building': 'Build meaningful affirmative, negative and interrogative sentences where relevant',
    conjugation: 'Select the appropriate verb form and use it in an understandable situation with a clear time reference',
    'listening-comprehension': 'Identify key information and meaning in a short beginner listening passage',
    'pronunciation-fluency': 'Understand the sound or fluency feature and practise it; acoustic quality remains unevaluated without a validated engine',
    'speaking-oral-expression': 'Prepare and express an understandable personal message, with written preparation available',
    conversation: 'Sustain a relevant guided exchange through short turns, questions and clarification',
    'reading-comprehension': 'Read a short contextual text and identify its main idea and relevant details',
    'practice-review-assessment': 'Retrieve and transfer the learned skills independently across contexts',
  };
  return `${tasks[moduleId]}. Lesson focus: ${title}.`;
}

export function buildLanguageLearningCatalogue(input: {
  languageCode: SupportedLanguageCode;
  productLevel: LanguageProductLevel;
  cefrLevel?: CefrLevel;
}): LanguageLearningCatalogue {
  const cefrLevels = [...LEVELS[input.productLevel]];
  const complete = input.languageCode === 'en' && input.productLevel === 'BEGINNER';
  return {
    version: LANGUAGE_LEARNING_CORE_VERSION,
    languageCode: input.languageCode,
    productLevel: input.productLevel,
    cefrLevel: input.cefrLevel && cefrLevels.includes(input.cefrLevel) ? input.cefrLevel : cefrLevels[0],
    cefrLevels,
    curriculumStatus: complete ? 'COMPLETE' : 'PARTIAL',
    modules: LANGUAGE_LEARNING_MODULE_IDS.map((id, index) => ({
      id,
      order: index + 1,
      title: MODULE_TITLES[id],
      kind: id === 'practice-review-assessment' ? 'transversal' : 'curriculum',
      acousticAssessmentRequired: id === 'pronunciation-fluency',
      toolkit: id === 'practice-review-assessment' ? [...LANGUAGE_LEARNING_TOOLKIT] : [],
      lessons: complete ? (ENGLISH_BEGINNER_LESSONS[id] ?? []).map(([slug, title], lessonIndex) => {
        const lessonId = `en-beginner:${id}:${slug}`;
        return {
          id: lessonId, moduleId: id, order: lessonIndex + 1, title,
          objective: lessonObjective(id, title),
          skills: [...MODULE_SKILLS[id]],
          criteria: MODULE_SKILLS[id].map((skill) => ({
            id: `${lessonId}:${skill}`,
            description: `Demonstrate ${skill} independently in the context of ${title}.`,
          })),
          contentVersion: LANGUAGE_LEARNING_CONTENT_VERSION,
          requiresAcousticAssessment: false,
        };
      }) : [],
    })),
  };
}

function validScore(item: LanguageLearningCoreEvidence): number | null {
  if (item.state !== 'evaluated' || item.awardedPoints === null || item.maximumPoints === null
    || !Number.isFinite(item.awardedPoints) || !Number.isFinite(item.maximumPoints)
    || item.maximumPoints <= 0 || item.awardedPoints < 0 || item.awardedPoints > item.maximumPoints) return null;
  return item.awardedPoints / item.maximumPoints;
}

interface EvidenceState {
  status: 'IN_PROGRESS' | 'NEEDS_REMEDIATION' | 'MASTERED' | 'NOT_EVALUABLE';
  score: number | null;
  bestScore: number | null;
  latest: LanguageLearningCoreEvidence | null;
  latestEvaluated: LanguageLearningCoreEvidence | null;
  mastered: LanguageLearningCoreEvidence | null;
  attempts: LanguageLearningCoreEvidence[];
}

function evidenceState(
  evidence: readonly LanguageLearningCoreEvidence[],
  scope: LanguageLearningCoreEvidence['scope'],
  targetId: string,
): EvidenceState {
  const seen = new Set<string>();
  const attempts = evidence.filter((item) => {
    if (item.scope !== scope || item.targetId !== targetId
      || item.contentVersion !== LANGUAGE_LEARNING_CONTENT_VERSION
      || !item.submissionId.trim() || !Number.isFinite(Date.parse(item.evaluatedAt))
      || seen.has(item.submissionId)) return false;
    seen.add(item.submissionId);
    return true;
  }).sort((a, b) => Date.parse(a.evaluatedAt) - Date.parse(b.evaluatedAt));
  const latest = attempts.at(-1) ?? null;
  const scored = attempts.filter((item) => validScore(item) !== null);
  const mastered = scored.find((item) => validScore(item)! >= LANGUAGE_MASTERY_THRESHOLD
    && (scope !== 'lesson' || Boolean(item.completionId?.trim()))) ?? null;
  const latestScored = scored.at(-1) ?? null;
  const score = latestScored ? validScore(latestScored) : null;
  const bestScore = scored.length ? Math.max(...scored.map((item) => validScore(item)!)) : null;
  // A technical/unavailable observation never erases known evaluated weakness
  // or a canonical acquisition; it also never manufactures a zero.
  const failed = scored.some((item) => validScore(item)! < LANGUAGE_MASTERY_THRESHOLD);
  return {
    status: mastered ? 'MASTERED' : failed ? 'NEEDS_REMEDIATION'
      : latest ? 'NOT_EVALUABLE' : 'IN_PROGRESS',
    score, bestScore, latest, latestEvaluated: latestScored, mastered, attempts,
  };
}

/** Pure evidence projection shared with the Passport. It does not persist,
 * grant credits, call a provider, interpret chat or accept browser scores. */
export function projectLanguageLearningCore(input: {
  languageCode: SupportedLanguageCode;
  productLevel: LanguageProductLevel;
  cefrLevel?: CefrLevel;
  evidence: readonly LanguageLearningCoreEvidence[];
}): LanguageLearningCoreView {
  const catalogue = buildLanguageLearningCatalogue(input);
  let previousModulePracticeCompleted = true;
  const modules = catalogue.modules.map<LanguageLearningModuleView>((module) => {
    const moduleAccessible = previousModulePracticeCompleted && catalogue.curriculumStatus === 'COMPLETE';
    let previousLessonMastered = moduleAccessible;
    const lessons = module.lessons.map<LanguageLearningLessonView>((lesson) => {
      const proof = evidenceState(input.evidence, 'lesson', lesson.id);
      let status: LanguageLearningState = proof.mastered ? 'MASTERED'
        : previousLessonMastered ? (proof.attempts.length ? proof.status : 'AVAILABLE') : 'LOCKED';
      if (lesson.requiresAcousticAssessment && status === 'MASTERED') status = 'NOT_EVALUABLE';
      previousLessonMastered = status === 'MASTERED';
      return {
        ...lesson, status, score: proof.score, bestScore: proof.bestScore,
        weakConcepts: proof.mastered ? [] : [...new Set(proof.latestEvaluated?.weakConcepts ?? [])],
        remediationCount: proof.attempts.filter((attempt) => attempt.remediation).length,
        masteredAt: status === 'MASTERED' ? proof.mastered?.evaluatedAt ?? null : null,
        lastActivityAt: proof.latest?.evaluatedAt ?? null,
        completionId: status === 'MASTERED' ? proof.mastered?.completionId ?? null : null,
      };
    });
    const allLessonsMastered = lessons.length > 0
      ? lessons.every((lesson) => lesson.status === 'MASTERED')
      : module.kind === 'transversal' && moduleAccessible;
    const proof = evidenceState(input.evidence, 'module', module.id);
    const assessmentAvailable = moduleAccessible && allLessonsMastered && !module.acousticAssessmentRequired;
    const status: LanguageLearningState = !moduleAccessible ? 'LOCKED'
      : !allLessonsMastered ? (lessons.some((lesson) => lesson.lastActivityAt) ? 'IN_PROGRESS' : 'AVAILABLE')
      : module.acousticAssessmentRequired ? 'NOT_EVALUABLE'
      : proof.mastered ? 'MASTERED' : proof.attempts.length ? proof.status : 'IN_PROGRESS';
    // An unavailable acoustic certificate is not a failed written lesson. Once
    // all actual written/practice prerequisites are mastered, keep teaching the
    // next module without promoting this neutral state to certified mastery.
    const practiceOnlyProgression = moduleAccessible && allLessonsMastered
      && module.acousticAssessmentRequired && status === 'NOT_EVALUABLE';
    previousModulePracticeCompleted = status === 'MASTERED' || practiceOnlyProgression;
    const permittedIds = new Set((module.kind === 'transversal'
      ? catalogue.modules.flatMap((item) => item.lessons) : lessons).map((lesson) => lesson.id));
    const weakLessonIds = proof.mastered ? [] : [...new Set(
      (proof.latestEvaluated?.weakLessonIds ?? []).filter((id) => permittedIds.has(id)),
    )];
    return {
      ...module, lessons, status, practiceOnlyProgression,
      // A written/STT observation must never be shown as an acoustic score.
      score: module.acousticAssessmentRequired ? null : proof.score,
      bestScore: module.acousticAssessmentRequired ? null : proof.bestScore,
      masteredLessons: lessons.filter((lesson) => lesson.status === 'MASTERED').length,
      totalLessons: lessons.length,
      assessmentAvailable,
      assessmentBlockedReason: catalogue.curriculumStatus !== 'COMPLETE' ? 'catalogue-unavailable'
        : !moduleAccessible ? 'prerequisite-incomplete'
        : !allLessonsMastered ? 'lessons-incomplete'
        : module.acousticAssessmentRequired ? 'acoustic-unavailable' : null,
      weakLessonIds,
    };
  });
  const allModulesMastered = modules.every((module) => module.status === 'MASTERED');
  const levelProof = evidenceState(input.evidence, 'level', input.productLevel);
  const levelLessonIds = new Set(catalogue.modules.flatMap((module) => module.lessons.map((lesson) => lesson.id)));
  const levelWeakLessonIds = levelProof.mastered ? [] : [...new Set(
    (levelProof.latestEvaluated?.weakLessonIds ?? []).filter((id) => levelLessonIds.has(id)),
  )];
  const levelStatus: LanguageLearningState = catalogue.curriculumStatus !== 'COMPLETE' ? 'LOCKED'
    : allModulesMastered ? levelProof.mastered ? 'MASTERED'
      : levelProof.attempts.length ? levelProof.status : 'IN_PROGRESS'
    : modules.some((module) => module.status === 'IN_PROGRESS' || module.status === 'MASTERED')
      ? 'IN_PROGRESS' : 'AVAILABLE';
  // Follow the first actionable learning module. Once all independent practice
  // is complete, return to the outstanding acoustic certification limitation.
  const currentModule = modules.find((module) => module.status !== 'MASTERED' && !module.practiceOnlyProgression)
    ?? modules.find((module) => module.practiceOnlyProgression) ?? null;
  const currentLesson = currentModule?.lessons.find((lesson) => lesson.status !== 'MASTERED') ?? null;
  let nextAction: LanguageLearningCoreNextAction;
  if (catalogue.curriculumStatus !== 'COMPLETE') {
    nextAction = { kind: 'catalogue-unavailable', moduleId: null, lessonId: null };
  } else if (levelStatus === 'MASTERED') {
    nextAction = { kind: 'next-level', moduleId: null, lessonId: null };
  } else if (allModulesMastered) {
    const weakLesson = levelStatus === 'NEEDS_REMEDIATION' && levelWeakLessonIds.length
      ? catalogue.modules.flatMap((module) => module.lessons).find((lesson) => lesson.id === levelWeakLessonIds[0])
      : null;
    nextAction = weakLesson
      ? { kind: 'remediate-lesson', moduleId: weakLesson.moduleId, lessonId: weakLesson.id }
      : { kind: 'level-assessment', moduleId: null, lessonId: null };
  } else if (currentLesson) {
    nextAction = {
      kind: currentLesson.status === 'NEEDS_REMEDIATION' ? 'remediate-lesson'
        : currentLesson.lastActivityAt ? 'resume-lesson' : 'start-lesson',
      moduleId: currentModule!.id, lessonId: currentLesson.id,
    };
  } else if (currentModule?.assessmentBlockedReason === 'acoustic-unavailable') {
    nextAction = { kind: 'capability-blocked', moduleId: currentModule.id, lessonId: null };
  } else {
    nextAction = {
      kind: currentModule?.status === 'NEEDS_REMEDIATION' ? 'module-remediation' : 'module-assessment',
      moduleId: currentModule?.id ?? null, lessonId: null,
    };
  }
  return {
    ...catalogue, modules,
    currentModuleId: currentModule?.id ?? nextAction.moduleId,
    currentLessonId: currentLesson?.id ?? nextAction.lessonId,
    nextAction, levelStatus,
    levelScore: levelProof.score, levelBestScore: levelProof.bestScore,
    levelWeakLessonIds,
    levelAssessmentAvailable: allModulesMastered,
    nextProductLevel: levelStatus !== 'MASTERED' ? null
      : input.productLevel === 'BEGINNER' ? 'INTERMEDIATE'
      : input.productLevel === 'INTERMEDIATE' ? 'ADVANCED' : null,
    pronunciationAcoustic: 'BLOCKED_CAPABILITY',
  };
}
