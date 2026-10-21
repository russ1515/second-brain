import { createHash } from 'node:crypto';
import {
  LANGUAGE_LEARNING_CORE_VERSION,
  buildLanguageLearningCatalogue,
  getLegacyEnglishBeginnerLessonIds,
  projectLanguageLearningCore,
  toSupportedLanguage,
  type CefrLevel,
  type LanguageLearningCoreEvidence,
  type LanguageLearningCoreView,
  type LanguageProductLevel,
} from '@second-brain/shared';
import type { PrismaService } from '../prisma/prisma.service';

export interface LanguageLearningCoreProjectionContext {
  sessionId: string;
  productLevel: LanguageProductLevel;
  cefrLevel: CefrLevel;
}

export interface LanguageLearningCorePosition {
  activeScope?: string | null;
  activeTargetId?: string | null;
  phase?: string;
  lessonLinks?: Record<string, { id: string; variant?: number }>;
}

/** Position may mark a persisted opened lesson as in progress. It never grants
 * mastery, changes a score or overrides an authoritative remediation/lock. */
export function applyLanguageLearningCorePosition(
  core: LanguageLearningCoreView,
  position: LanguageLearningCorePosition,
): LanguageLearningCoreView {
  if (position.activeScope === 'stage' && core.cefrLevels.includes(position.activeTargetId as CefrLevel)) {
    return { ...core, currentModuleId: null, currentLessonId: null };
  }
  const activeModule = core.modules.find((module) => position.activeScope === 'module'
    ? module.id === position.activeTargetId || `${core.cefrLevel}:${module.id}` === position.activeTargetId
    : position.activeScope === 'lesson' && module.lessons.some((lesson) => lesson.id === position.activeTargetId));
  if (!activeModule) return core;
  const activeLesson = position.activeScope === 'lesson'
    ? activeModule.lessons.find((lesson) => lesson.id === position.activeTargetId) : null;
  const opened = Boolean(activeLesson && position.lessonLinks?.[activeLesson.id]?.id);
  const modules = opened ? core.modules.map((module) => module.id !== activeModule.id ? module : {
    ...module,
    status: module.status === 'AVAILABLE' ? 'IN_PROGRESS' as const : module.status,
    lessons: module.lessons.map((lesson) => lesson.id !== activeLesson!.id || lesson.status !== 'AVAILABLE'
      ? lesson : { ...lesson, status: 'IN_PROGRESS' as const }),
  }) : core.modules;
  return {
    ...core, modules,
    currentModuleId: activeModule.id,
    currentLessonId: activeLesson?.id ?? null,
    nextAction: opened && core.nextAction.kind === 'start-lesson' && core.nextAction.lessonId === activeLesson!.id
      ? { ...core.nextAction, kind: 'resume-lesson' } : core.nextAction,
  };
}

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function strings(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}
function productLevel(value: unknown): value is LanguageProductLevel {
  return value === 'BEGINNER' || value === 'INTERMEDIATE' || value === 'ADVANCED';
}
function cefrLevel(value: unknown): value is CefrLevel {
  return typeof value === 'string' && ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].includes(value);
}

/** Read-only, bounded projection shared by the course and the Passport. The
 * session is only a versioned position/source index, never a score authority. */
export async function loadLanguageLearningCoreProjection(
  prisma: PrismaService,
  userId: string,
  profileId: string,
): Promise<LanguageLearningCoreView | null> {
  const [profile, session] = await Promise.all([
    prisma.languageProfile.findFirst({ where: { id: profileId, userId },
      select: { language: true, normalizedLanguage: true } }),
    prisma.experienceSession.findFirst({ where: { userId, languageProfileId: profileId,
      type: 'language', intent: 'language-learning-core' }, orderBy: { startedAt: 'desc' },
      select: { id: true, userId: true, languageProfileId: true, currentStep: true } }),
  ]);
  if (!profile || !session || session.userId !== userId || session.languageProfileId !== profileId) return null;
  const state = record(record(record(session.currentStep)?.metadata)?.languageLearningCore);
  if (state?.version !== 1 || state.profileId !== profileId
    || !productLevel(state.productLevel) || !cefrLevel(state.cefrLevel)) return null;
  const languageCode = toSupportedLanguage(profile.normalizedLanguage) ?? toSupportedLanguage(profile.language);
  if (!languageCode) return null;
  const context = { sessionId: session.id, productLevel: state.productLevel, cefrLevel: state.cefrLevel };
  const catalogue = buildLanguageLearningCatalogue({ languageCode, ...context });
  if (!catalogue.cefrLevels.includes(context.cefrLevel)) return null;
  const evidence = await loadLanguageLearningCoreEvidence(prisma, userId, profileId, context);
  const core = projectLanguageLearningCore({ languageCode, ...context, evidence });
  return applyLanguageLearningCorePosition(core, state as LanguageLearningCorePosition);
}

/** Only sealed, owner-scoped canonical submissions with their original rubric
 * and source revision are admitted. No cached session score, unverified
 * completion, chat response or browser-authored evidence is consumed. */
export async function loadLanguageLearningCoreEvidence(
  prisma: PrismaService,
  userId: string,
  profileId: string,
  context: LanguageLearningCoreProjectionContext,
): Promise<LanguageLearningCoreEvidence[]> {
  const profile = await prisma.languageProfile.findFirst({ where: { id: profileId, userId },
    select: { language: true, normalizedLanguage: true } });
  const session = await prisma.experienceSession.findFirst({ where: { id: context.sessionId, userId,
    languageProfileId: profileId, type: 'language', intent: 'language-learning-core' }, select: { id: true } });
  if (!profile || !session) return [];
  const languageCode = toSupportedLanguage(profile.normalizedLanguage) ?? toSupportedLanguage(profile.language);
  if (!languageCode) return [];
  const catalogue = buildLanguageLearningCatalogue({ languageCode, ...context });
  const definitions = catalogue.modules.flatMap((module) => module.lessons);
  const definitionIds = new Set(definitions.map((lesson) => lesson.id));
  const assessments = await prisma.assessment.findMany({ where: { userId,
    masteryCreationKey: { startsWith: `language-core:${profileId}:${context.productLevel}:` },
    masteryGenerationStatus: 'ready' },
    include: { submissions: { where: { userId, masteryGenerationStatus: 'ready' },
      orderBy: { createdAt: 'asc' } } },
    orderBy: { createdAt: 'asc' },
  });
  const sourceIds = [...new Set(assessments.flatMap((assessment) => {
    const metadata = record(record(assessment.questions)?.languageLearningCore);
    return strings(metadata?.sourceLessonIds) ? metadata.sourceLessonIds : [];
  }))];
  const sources = sourceIds.length ? await prisma.lesson.findMany({ where: { userId,
    languageProfileId: profileId, id: { in: sourceIds } }, select: { id: true,
      userId: true, languageProfileId: true, contentVersion: true,
      masteryRemediationGenerationKey: true } }) : [];
  const sourcesById = new Map(sources.map((lesson) => [lesson.id, lesson]));
  const submissionIds = assessments.flatMap((assessment) => assessment.submissions.map((submission) => submission.id));
  const completions = submissionIds.length ? await prisma.learningCompletion.findMany({ where: { userId,
    kind: 'lesson', status: 'verified', evidenceSource: 'assessment_submission',
    assessmentSubmissionId: { in: submissionIds } }, select: { id: true, userId: true,
      lessonId: true, learningRefId: true, contentVersion: true, evidenceRefId: true,
      assessmentSubmissionId: true, status: true } }) : [];
  const completionBySubmission = new Map(completions.map((completion) => [completion.assessmentSubmissionId, completion]));
  const output: LanguageLearningCoreEvidence[] = [];

  for (const assessment of assessments) {
    const payload = record(assessment.questions);
    const metadata = record(payload?.languageLearningCore);
    if (!metadata || assessment.userId !== userId || metadata.version !== 1
      || metadata.catalogueVersion !== LANGUAGE_LEARNING_CORE_VERSION
      || metadata.profileId !== profileId || metadata.sessionId !== session.id
      || metadata.productLevel !== context.productLevel
      || (metadata.remediation !== undefined && typeof metadata.remediation !== 'boolean')
      || !['lesson', 'module', 'stage', 'level'].includes(String(metadata.scope))
      || typeof metadata.targetId !== 'string' || !Number.isInteger(metadata.variant) || Number(metadata.variant) < 0
      || !strings(metadata.sourceLessonIds) || !strings(metadata.questionLessonIds)
      || !Array.isArray(metadata.sourceContentVersions)
      || metadata.sourceContentVersions.length !== metadata.sourceLessonIds.length
      || new Set(metadata.sourceLessonIds).size !== metadata.sourceLessonIds.length
      || assessment.masteryCreationKey !== `language-core:${profileId}:${context.productLevel}:${metadata.scope}:${metadata.targetId}:${metadata.variant}`) continue;

    const scope = metadata.scope as LanguageLearningCoreEvidence['scope'];
    const targetId = metadata.targetId;
    const definition = definitions.find((item) => item.id === targetId);
    const scopedModule = /^([ABC][12]):(.+)$/.exec(targetId);
    const module = catalogue.modules.find((item) => item.id === (scopedModule?.[2] ?? targetId));
    const aggregateStage = scope === 'stage' ? targetId : scopedModule?.[1];
    const legacyAggregate = (scope === 'module' || scope === 'level') && metadata.cefrLevel === undefined && !scopedModule;
    // Old module/level snapshots have no CEFR and retain their exact frozen
    // 230-source universe. They cannot certify newly added stage toolkits.
    if (legacyAggregate && (languageCode !== 'en' || context.productLevel !== 'BEGINNER')) continue;
    if (scope === 'lesson' && metadata.cefrLevel !== undefined && metadata.cefrLevel !== definition?.cefrLevel) continue;
    if ((scope === 'module' && !legacyAggregate) || scope === 'stage') {
      if (!cefrLevel(aggregateStage) || !catalogue.cefrLevels.includes(aggregateStage)
        || metadata.cefrLevel !== aggregateStage) continue;
    }
    if ((scope === 'lesson' && !definitionIds.has(targetId))
      || (scope === 'module' && (!module || module.acousticAssessmentRequired))
      || (scope === 'level' && (!legacyAggregate || targetId !== context.productLevel))) continue;
    const sourceDefinitionIds: string[] = [];
    let sourceValid = true;
    for (const [index, sourceId] of metadata.sourceLessonIds.entries()) {
      const source = sourcesById.get(sourceId);
      const version = metadata.sourceContentVersions[index];
      if (!source || source.userId !== userId || source.languageProfileId !== profileId
        || !Number.isInteger(version) || source.contentVersion !== version) { sourceValid = false; break; }
      const definition = definitions.find((lesson) => {
        const prefix = `language-core:${profileId}:${context.productLevel}:${lesson.id}:`;
        const generationKey = source.masteryRemediationGenerationKey;
        return generationKey?.startsWith(prefix) && /^\d+$/.test(generationKey.slice(prefix.length));
      });
      if (!definition) { sourceValid = false; break; }
      sourceDefinitionIds.push(definition.id);
    }
    if (!sourceValid || new Set(sourceDefinitionIds).size !== sourceDefinitionIds.length) continue;
    if (scope === 'lesson' && (metadata.sourceLessonIds.length !== 1
      || sourceDefinitionIds[0] !== targetId || assessment.lessonId !== metadata.sourceLessonIds[0]
      || assessment.contentVersion !== metadata.sourceContentVersions[0])) continue;
    const requiredAggregateIds = scope === 'lesson' ? null
      : legacyAggregate ? getLegacyEnglishBeginnerLessonIds(scope === 'module' && module?.kind !== 'transversal' ? module!.id : undefined)
        : scope === 'stage' || module?.kind === 'transversal'
          ? definitions.filter((lesson) => lesson.cefrLevel === aggregateStage).map((lesson) => lesson.id)
          : module!.lessons.filter((lesson) => lesson.cefrLevel === aggregateStage).map((lesson) => lesson.id);
    if (requiredAggregateIds && (!requiredAggregateIds.length || sourceDefinitionIds.length !== requiredAggregateIds.length
      || requiredAggregateIds.some((id) => !sourceDefinitionIds.includes(id)))) continue;

    const questions = Array.isArray(payload?.questions) ? payload.questions.map(record) : [];
    if (!questions.length || questions.length > 100
      || ((scope === 'stage' || (scope === 'module' && !legacyAggregate)) && questions.length < 10)
      || questions.some((question) => !question
      || typeof question.id !== 'string' || typeof question.prompt !== 'string'
      || question.format !== 'mcq' || !strings(question.options) || question.options.length < 2
      || new Set(question.options).size !== question.options.length
      || typeof question.answerKey !== 'string' || !question.options.includes(question.answerKey)
      || typeof question.points !== 'number' || !Number.isFinite(question.points) || question.points <= 0)
      || new Set(questions.map((question) => question!.id)).size !== questions.length
      || metadata.questionLessonIds.length !== questions.length
      || metadata.questionLessonIds.some((id, index) => !sourceDefinitionIds.includes(id)
        || !String(questions[index]!.id).startsWith(`${id}:`))) continue;

    for (const submission of assessment.submissions) {
      if (submission.userId !== userId || submission.assessmentId !== assessment.id
        || submission.masterySubmissionKey !== `language-core:${assessment.id}`
        || !strings(submission.answers) || submission.answers.length !== questions.length
        || submission.answers.some((answer, index) => !answer.trim()
          || !(questions[index]!.options as string[]).includes(answer))
        || submission.masterySubmissionHash !== createHash('sha256').update(JSON.stringify({
          id: assessment.id, answers: submission.answers,
        })).digest('hex')) continue;
      const results = Array.isArray(submission.results) ? submission.results.map(record) : [];
      if (results.length !== questions.length) continue;
      let awardedPoints = 0;
      let maximumPoints = 0;
      const weakLessonIds: string[] = [];
      const weakConcepts: string[] = [];
      let valid = true;
      for (const [index, question] of questions.entries()) {
        const result = results[index];
        const points = question!.points as number;
        const expected = submission.answers[index].normalize('NFKC') === String(question!.answerKey).normalize('NFKC')
          ? points : 0;
        if (!result || result.questionId !== question!.id || result.prompt !== question!.prompt
          || result.learnerAnswer !== submission.answers[index]
          || result.max !== points || result.awarded !== expected
          || result.verdict !== (expected === points ? 'correct' : 'incorrect')) { valid = false; break; }
        awardedPoints += expected;
        maximumPoints += points;
        if (expected < points) {
          weakLessonIds.push(metadata.questionLessonIds[index]);
          weakConcepts.push(String(question!.prompt).slice(0, 200));
        }
      }
      if (!valid || maximumPoints <= 0 || !Number.isFinite(submission.score)
        || Math.abs(submission.score - awardedPoints / maximumPoints * 100) > 0.0000001) continue;
      const completion = completionBySubmission.get(submission.id);
      const completionValid = scope === 'lesson' && completion
        && completion.userId === userId && completion.status === 'verified'
        && completion.lessonId === assessment.lessonId && completion.learningRefId === assessment.lessonId
        && completion.contentVersion === assessment.contentVersion
        && completion.evidenceRefId === submission.id;
      output.push({ scope, targetId, contentVersion: 1, submissionId: submission.id,
        ...(scope === 'lesson' ? { cefrLevel: definition!.cefrLevel }
          : !legacyAggregate && cefrLevel(aggregateStage) ? { cefrLevel: aggregateStage } : {}),
        completionId: completionValid ? completion.id : null,
        state: 'evaluated', awardedPoints, maximumPoints,
        evaluatedAt: submission.createdAt.toISOString(),
        weakLessonIds: [...new Set(weakLessonIds)], weakConcepts: [...new Set(weakConcepts)],
        remediation: typeof metadata.remediation === 'boolean' ? metadata.remediation : Number(metadata.variant) > 0 });
    }
  }
  return output;
}
