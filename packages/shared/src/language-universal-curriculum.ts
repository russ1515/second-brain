import type { CefrLevel } from './language';
import type { LanguageProductLevel } from './language-placement';
import type { SupportedLanguageCode } from './languages';
import { getLanguageCurriculumProfile } from './language-curriculum-profiles';
import type { LanguageLearningCatalogue, LanguageLearningLessonDefinition, LanguageLearningModuleId } from './language-learning-core';

/** Curriculum definitions are authored metadata, never a claim of learner
 * mastery or an expert linguistic endorsement. Actual teaching is generated
 * only when the learner explicitly starts the existing lesson engine. */
export const UNIVERSAL_LANGUAGE_CURRICULUM_VERSION = 'universal-curriculum-v1' as const;
export const LANGUAGE_CURRICULUM_CEFR_STAGES = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
export const LANGUAGE_CURRICULUM_PRODUCT_STAGES: Record<LanguageProductLevel, readonly CefrLevel[]> = {
  BEGINNER: ['A1', 'A2'], INTERMEDIATE: ['B1', 'B2'], ADVANCED: ['C1', 'C2'],
};

export interface CefrCompetencySpine {
  stage: CefrLevel;
  expectation: string;
  interaction: string;
  reception: string;
  production: string;
  mediation: string;
  vocabularyDomains: string[];
  communicativeFunctions: string[];
  textComplexity: string;
}

export const LANGUAGE_CEFR_COMPETENCY_SPINE: Record<CefrLevel, CefrCompetencySpine> = {
  A1: { stage: 'A1', expectation: 'Use familiar expressions for concrete personal and survival needs with patient support.',
    interaction: 'Ask and answer short personal questions and request repetition in a guided exchange.',
    reception: 'Identify familiar words, names and essential instructions in short, clearly contextualized material.',
    production: 'Produce very short personal messages and simple target-language utterances about immediate needs.',
    mediation: 'Relay a familiar name, number or simple instruction without adding unsupported details.',
    vocabularyDomains: ['personal identity', 'home and family', 'basic daily needs'],
    communicativeFunctions: ['identify and introduce', 'ask for basic information', 'request and acknowledge'],
    textComplexity: 'Short predictable phrases with explicit context and one main communicative purpose.' },
  A2: { stage: 'A2', expectation: 'Handle routine everyday transactions, descriptions and short accounts with increasing independence.',
    interaction: 'Exchange routine information, arrange a practical activity and clarify a simple misunderstanding.',
    reception: 'Extract relevant details from short practical messages, everyday notices and straightforward narratives.',
    production: 'Connect short descriptions of habits, past experiences and plans using structures appropriate to the language.',
    mediation: 'Pass on the essential points of a practical message in a short connected explanation.',
    vocabularyDomains: ['services and travel', 'work and study routines', 'events and simple plans'],
    communicativeFunctions: ['describe routines and events', 'arrange and compare options', 'explain a practical need'],
    textComplexity: 'Short connected material about concrete familiar situations, not a replay of isolated A1 phrases.' },
  B1: { stage: 'B1', expectation: 'Communicate independently on familiar social, study, work and travel matters.',
    interaction: 'Sustain an unprepared familiar conversation, narrate experiences and justify an opinion with reasons.',
    reception: 'Understand main points and supporting detail in standard familiar speech and straightforward extended texts.',
    production: 'Produce connected narratives, structured paragraphs and explanations of plans with clear reasons.',
    mediation: 'Summarize the main points of a straightforward source and explain them to another learner.',
    vocabularyDomains: ['independent travel', 'social experiences', 'work and study decisions'],
    communicativeFunctions: ['narrate and explain', 'justify an opinion', 'resolve a familiar difficulty'],
    textComplexity: 'Connected paragraphs and multi-turn exchanges with a clear sequence and supporting reasons.' },
  B2: { stage: 'B2', expectation: 'Interact spontaneously and develop detailed explanations and supported arguments.',
    interaction: 'Defend a position, negotiate an outcome and respond to counterarguments in a sustained discussion.',
    reception: 'Distinguish positions, purpose and significant details in extended professional or academic material.',
    production: 'Build a coherent detailed argument, compare alternatives and use an appropriate register.',
    mediation: 'Reformulate a complex explanation and synthesize contrasting views without confusing their sources.',
    vocabularyDomains: ['professional discussions', 'public issues', 'academic comparisons'],
    communicativeFunctions: ['argue and counterargue', 'negotiate and qualify', 'reformulate for an audience'],
    textComplexity: 'Extended discourse with contrasting viewpoints, relevant evidence and controlled cohesion.' },
  C1: { stage: 'C1', expectation: 'Use language flexibly for complex academic, professional and abstract purposes.',
    interaction: 'Manage implicit meaning, register and turn-taking in complex discussion with fluent spontaneous reformulation.',
    reception: 'Interpret complex sources, implied positions, register shifts and relationships across an extended argument.',
    production: 'Present a detailed well-structured analysis with precise vocabulary, qualified claims and coherent synthesis.',
    mediation: 'Synthesize several complex sources, preserve nuance and adapt the explanation to the audience.',
    vocabularyDomains: ['academic synthesis', 'professional specialization', 'abstract and cultural analysis'],
    communicativeFunctions: ['synthesize complex arguments', 'qualify and hedge', 'adapt register and implicit meaning'],
    textComplexity: 'Complex authentic-style discourse requiring inference, qualification, register and source-aware synthesis.' },
  C2: { stage: 'C2', expectation: 'Communicate with high precision, nuance and flexibility; this is not a native-speaker identity claim.',
    interaction: 'Handle subtle pragmatic intentions, idiomatic language and complex disagreement with flexible register.',
    reception: 'Resolve subtle distinctions, implicit assumptions and rhetorical effects across demanding sources.',
    production: 'Create sophisticated, precisely qualified discourse with controlled style and fine semantic distinctions.',
    mediation: 'Reconcile apparently conflicting complex sources while preserving ambiguity, evidence and cultural pragmatics.',
    vocabularyDomains: ['high-level synthesis', 'specialist and literary discourse', 'cultural pragmatics'],
    communicativeFunctions: ['distinguish fine meanings', 'reconcile conflicting perspectives', 'control style and pragmatic effect'],
    textComplexity: 'Demanding multi-source material with subtle distinctions, rhetorical effects and flexible sophisticated expression.' },
};

export interface LanguageLessonAssessmentBlueprint {
  formats: string[];
  minimumItems: 10;
  autonomous: true;
  threshold: 0.9;
  requiredCriteria: string[];
  acousticCertificationRequired: false;
}

export interface LanguageLessonCurriculumContract {
  languageCode: SupportedLanguageCode;
  cefrLevel: CefrLevel;
  /** Existing localized module label + CEFR + ordinal is the public preview.
   * target-language names and detailed prose come from generated teaching. */
  titleKey: string;
  titleStrategy: 'localized-module-stage-ordinal';
  prerequisites: string[];
  linguisticTargets: string[];
  vocabularyDomains: string[];
  communicativeFunctions: string[];
  assessmentBlueprint: LanguageLessonAssessmentBlueprint;
  masteryEvidence: { source: 'AssessmentSubmission+LearningCompletion'; threshold: 0.9; acousticMastery: false };
  runtimeGenerationConstraints: string[];
}

const MODULE_TARGETS: Record<LanguageLearningModuleId, 'basics' | 'grammar' | 'morphology' | 'pronunciation' | 'register' | 'discourse'> = {
  basics: 'basics', 'greetings-introductions': 'register', 'vocabulary-expressions': 'discourse',
  'grammar-sentence-building': 'grammar', conjugation: 'morphology',
  'listening-comprehension': 'discourse', 'pronunciation-fluency': 'pronunciation',
  'speaking-oral-expression': 'discourse', conversation: 'register',
  'reading-comprehension': 'discourse', 'practice-review-assessment': 'grammar',
};

const MODULE_FUNCTIONS: Record<LanguageLearningModuleId, keyof Pick<CefrCompetencySpine, 'expectation' | 'interaction' | 'reception' | 'production' | 'mediation'>> = {
  basics: 'expectation', 'greetings-introductions': 'interaction', 'vocabulary-expressions': 'production',
  'grammar-sentence-building': 'production', conjugation: 'production',
  'listening-comprehension': 'reception', 'pronunciation-fluency': 'production',
  'speaking-oral-expression': 'production', conversation: 'interaction',
  'reading-comprehension': 'reception', 'practice-review-assessment': 'mediation',
};

export function curriculumProductLevel(stage: CefrLevel): LanguageProductLevel {
  return stage === 'A1' || stage === 'A2' ? 'BEGINNER'
    : stage === 'B1' || stage === 'B2' ? 'INTERMEDIATE' : 'ADVANCED';
}

export function languageModuleAssessmentTarget(stage: CefrLevel, moduleId: LanguageLearningModuleId): string {
  return `${stage}:${moduleId}`;
}

export function curriculumLessonContract(input: {
  id: string; languageCode: SupportedLanguageCode; cefrLevel: CefrLevel;
  moduleId: LanguageLearningModuleId; moduleOrder: number; lessonIndex: number;
  skills: string[]; prerequisites?: string[];
}): LanguageLessonCurriculumContract {
  const profile = getLanguageCurriculumProfile(input.languageCode);
  const spine = LANGUAGE_CEFR_COMPETENCY_SPINE[input.cefrLevel];
  const targets = profile.stageTargets[input.cefrLevel][MODULE_TARGETS[input.moduleId]];
  const target = targets[input.lessonIndex % targets.length];
  return {
    languageCode: input.languageCode, cefrLevel: input.cefrLevel,
    titleKey: `learningCore.module.${String(input.moduleOrder).padStart(2, '0')}`,
    titleStrategy: 'localized-module-stage-ordinal', prerequisites: [...input.prerequisites ?? []],
    linguisticTargets: [target, ...targets.filter((item) => item !== target)],
    vocabularyDomains: [...spine.vocabularyDomains],
    communicativeFunctions: [spine[MODULE_FUNCTIONS[input.moduleId]], ...spine.communicativeFunctions],
    assessmentBlueprint: { formats: ['contextual-mcq', 'error-identification', 'meaning-and-transfer'],
      minimumItems: 10, autonomous: true, threshold: 0.9,
      requiredCriteria: input.skills.map((skill) => `${input.id}:${skill}`), acousticCertificationRequired: false },
    masteryEvidence: { source: 'AssessmentSubmission+LearningCompletion', threshold: 0.9, acousticMastery: false },
    runtimeGenerationConstraints: [
      `Curriculum identity ${input.id}, CEFR ${input.cefrLevel}, module ${input.moduleId} and prerequisites are immutable.`,
      `Teach ${profile.languageCode} using ${profile.writingSystems.join(' / ')}; direction ${profile.direction}.`,
      `Stage expectation: ${spine.expectation}`, `Material complexity: ${spine.textComplexity}`,
      'Explain, instruct, correct, summarize and remediate in supportLanguage; never infer it from targetLanguage.',
      'Examples, dialogues and practice material use targetLanguage with immediate support-language glosses while teaching.',
      'Autonomous assessment hides answer-revealing translations, solutions and coaching; instructions remain understandable.',
      'Use actual language-specific linguistic targets, not a translated English grammar taxonomy.',
      'Generate a real explanation, worked examples, guided practice and ten distinct closed independent exercises.',
      'Keep TTS/STT practice separate from acoustic certification; unavailable pronunciation remains NOT_EVALUABLE and grants no acoustic mastery.',
      'No unvalidated linguistic distinction may be invented; disclose the relevant NEEDS_LINGUISTIC_REVIEW section when uncertain.',
    ],
  };
}

/** Three planned operations per module/stage: notice, use and transfer.
 * Their actual objects are authored separately by each language profile. */
export function buildUniversalStageLessons(input: {
  languageCode: SupportedLanguageCode; cefrLevel: CefrLevel; moduleId: LanguageLearningModuleId;
  moduleOrder: number; skills: string[]; offset?: number;
}): LanguageLearningLessonDefinition[] {
  const profile = getLanguageCurriculumProfile(input.languageCode);
  const spine = LANGUAGE_CEFR_COMPETENCY_SPINE[input.cefrLevel];
  const targets = profile.stageTargets[input.cefrLevel][MODULE_TARGETS[input.moduleId]];
  const operations = ['notice-in-context', 'guided-use', 'independent-transfer'];
  return operations.map((operation, index) => {
    const id = `${input.languageCode}:${input.cefrLevel}:${input.moduleId}:${operation}`;
    const previousId = index ? `${input.languageCode}:${input.cefrLevel}:${input.moduleId}:${operations[index - 1]}` : null;
    const contract = curriculumLessonContract({ ...input, id, lessonIndex: index,
      prerequisites: previousId ? [previousId] : [] });
    const title = `${input.cefrLevel} · ${targets[index]}`;
    return { ...contract, id, moduleId: input.moduleId, order: (input.offset ?? 0) + index + 1, title,
      objective: `${spine[MODULE_FUNCTIONS[input.moduleId]]} Focus on ${targets[index]}. ${spine.textComplexity}`,
      skills: [...input.skills], criteria: input.skills.map((skill) => ({ id: `${id}:${skill}`,
        description: `Demonstrate ${skill} independently through ${targets[index]} at ${input.cefrLevel}; ${spine.communicativeFunctions[index]}.` })),
      contentVersion: 1, requiresAcousticAssessment: false };
  });
}

export interface CurriculumLintIssue { code: string; lessonId?: string; detail: string }

/** Structural completeness is checked independently from lesson count,
 * generated content, acoustic capability and human linguistic validation. */
export function lintLanguageCurriculum(catalogue: LanguageLearningCatalogue): CurriculumLintIssue[] {
  const issues: CurriculumLintIssue[] = [];
  const profile = getLanguageCurriculumProfile(catalogue.languageCode);
  const definitions = catalogue.modules.flatMap((module) => module.lessons);
  const byId = new Map(definitions.map((lesson) => [lesson.id, lesson]));
  if (byId.size !== definitions.length) issues.push({ code: 'DUPLICATE_ID', detail: 'Lesson identities must be unique.' });
  if (catalogue.modules.length !== 11 || new Set(catalogue.modules.map((module) => module.id)).size !== 11) {
    issues.push({ code: 'MODULE_COVERAGE', detail: 'Eleven distinct module families are required.' });
  }
  if (!profile.script || !profile.writingSystems.length || (profile.direction !== 'ltr' && profile.direction !== 'rtl')) {
    issues.push({ code: 'SCRIPT_METADATA', detail: 'Writing systems and text direction must be explicit.' });
  }
  const pair = LANGUAGE_CURRICULUM_PRODUCT_STAGES[catalogue.productLevel];
  if (JSON.stringify(catalogue.cefrLevels) !== JSON.stringify(pair)) issues.push({ code: 'STAGE_PAIR', detail: 'Both product-level stages are required.' });
  for (const module of catalogue.modules) {
    for (const stage of catalogue.cefrLevels) {
      if (!module.lessons.some((lesson) => lesson.cefrLevel === stage)) {
        issues.push({ code: 'EMPTY_STAGE_MODULE', detail: `${stage}:${module.id}` });
      }
    }
    for (const lesson of module.lessons) {
      const fail = (code: string, detail: string) => issues.push({ code, lessonId: lesson.id, detail });
      if (!lesson.objective.trim() || lesson.objective.length < 30 || !lesson.title.trim()) fail('MISSING_OBJECTIVE', 'A meaningful objective and title are required.');
      if (lesson.moduleId !== module.id || lesson.languageCode !== catalogue.languageCode || !pair.includes(lesson.cefrLevel)) {
        fail('SCOPE_MISMATCH', 'Language, module and CEFR must match the curriculum.');
      }
      if (!lesson.id.startsWith('en-beginner:') && !lesson.id.startsWith(`${catalogue.languageCode}:${lesson.cefrLevel}:${module.id}:`)) {
        fail('UNSTABLE_ID', 'Canonical identities encode language, stage, module and authored operation.');
      }
      if (!/^learningCore\.module\.(?:0[1-9]|10|11)$/.test(lesson.titleKey)
        || lesson.titleStrategy !== 'localized-module-stage-ordinal') fail('UNTRANSLATED_METADATA_KEY', 'A loaded localized module label supplies the preview title.');
      if (lesson.linguisticTargets.length < 3 || lesson.vocabularyDomains.length < 3
        || lesson.communicativeFunctions.length < 3 || lesson.skills.length < 3 || lesson.criteria.length < 3) {
        fail('EMPTY_BLUEPRINT', 'Targets, domains, communicative functions, skills and criteria must be authored.');
      }
      if (lesson.assessmentBlueprint.minimumItems !== 10 || !lesson.assessmentBlueprint.autonomous
        || lesson.assessmentBlueprint.threshold !== 0.9 || !lesson.assessmentBlueprint.formats.length
        || lesson.assessmentBlueprint.acousticCertificationRequired || lesson.requiresAcousticAssessment
        || lesson.masteryEvidence.acousticMastery) {
        fail('IMPOSSIBLE_ASSESSMENT', 'Written mastery must remain evaluable and never certify unavailable acoustic evidence.');
      }
      if (JSON.stringify(lesson.assessmentBlueprint.requiredCriteria) !== JSON.stringify(lesson.criteria.map((criterion) => criterion.id))) {
        fail('CRITERIA_MISMATCH', 'Assessment criteria must refer to the immutable lesson rubric.');
      }
      if (!lesson.runtimeGenerationConstraints.length) fail('MISSING_RUNTIME_CONTRACT', 'Generation must preserve scope and language roles.');
      if (catalogue.languageCode !== 'en' && /English alphabet|\bPresent Simple\b|\bDo \/ Does\b|\bA \/ An \/ The\b|English R/.test(
        [lesson.title, lesson.objective, ...lesson.linguisticTargets].join('\n'))) {
        fail('ENGLISH_GRAMMAR_LEAK', 'An English-specific structure cannot be cloned into another language.');
      }
      for (const prerequisite of lesson.prerequisites) {
        const target = byId.get(prerequisite);
        if (!target) fail('MISSING_PREREQUISITE', prerequisite);
        else if (LANGUAGE_CURRICULUM_CEFR_STAGES.indexOf(target.cefrLevel) > LANGUAGE_CURRICULUM_CEFR_STAGES.indexOf(lesson.cefrLevel)) {
          fail('CEFR_ORDER', 'A prerequisite cannot belong to a later stage.');
        } else if (target.cefrLevel === lesson.cefrLevel && target.moduleId === lesson.moduleId && target.order >= lesson.order) {
          fail('LESSON_ORDER', 'Within-stage prerequisites precede their dependent lesson.');
        }
      }
    }
  }
  const visited = new Set<string>();
  const visiting = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id)) { issues.push({ code: 'CIRCULAR_PREREQUISITE', lessonId: id, detail: 'Prerequisite graph must be acyclic.' }); return; }
    if (visited.has(id)) return;
    visiting.add(id);
    for (const prerequisite of byId.get(id)?.prerequisites ?? []) if (byId.has(prerequisite)) visit(prerequisite);
    visiting.delete(id); visited.add(id);
  };
  for (const id of byId.keys()) visit(id);
  return issues;
}
