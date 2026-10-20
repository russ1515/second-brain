import {
  BadRequestException,
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma, type Lesson } from '@prisma/client';
import type {
  CardView,
  ExerciseType,
  LessonExercise,
  LessonFlowProgress,
  LessonFlowStepKey,
  LessonSummary,
  LessonView,
  LLMGenerateOptions,
  KycTeacher,
  LanguageTrainingFormat,
} from '@second-brain/shared';
import {
  LANGUAGE_REMEDIATION_MINIMUM_EXERCISES,
  LANGUAGE_TRAINING_FORMATS,
  resolveTeacherPolicy,
  TEACHER_POLICY_METADATA_SOURCE,
  teacherPolicyDirective,
  lessonFlowStepKeys,
  SUPPORTED_LANGUAGES,
  toSupportedLanguage,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { RetrievalService } from '../documents/retrieval/retrieval.service';
import { DocumentService } from '../documents/document.service';
import { toCardView } from '../flashcards/card.mapper';
import { ConceptService } from '../concepts/concept.service';
import { MasteryService } from '../concepts/mastery.service';
import { localeDirective, resolveLocale } from '../common/learning-locale';
import type { GenerateLessonDto } from './dto/generate-lesson.dto';
import { ExperienceSessionService } from '../experience-sessions/experience-session.service';
import { LearningDataDeletionService } from '../experience-sessions/learning-data-deletion.service';
import type { LearningDeletionPreview } from '@second-brain/shared';
import { LearningCompletionService } from '../learning-evidence/learning-completion.service';
import { GoalsService } from '../goals/goals.service';
import { accountDataLockKey } from '../common/account-data-lock';
import { createHash } from 'node:crypto';
import { detectAll, supportedLanguages, toISO2 } from 'tinyld';

const CONTEXT_LIMIT = 5;

/** Instruction language and learning target are separate trusted server data.
 * These options never form part of the public GenerateLessonDto. */
export interface LanguageLessonRoleContext {
  supportLanguageCode: string;
  targetLanguageCode?: string;
  targetLanguage: string;
  moduleId?: string;
  lessonObjective?: string;
}

export interface LanguageRoleViolation {
  code: 'LESSON_SUPPORT_LANGUAGE_CONTRACT_VIOLATION';
  stage: 'content';
  reason: 'PEDAGOGICAL_LANGUAGE_MISMATCH';
  fields: string[];
}

type LanguageRoleContent = Pick<LessonView,
  'objective' | 'intro' | 'explanation' | 'examples' | 'questions' | 'exercises'
  | 'homework' | 'summary' | 'keyPoints' | 'revisionSheet'>
  & { commonMisconceptions?: readonly string[] };

const LANGUAGE_ID_CODES = new Map(supportedLanguages.map(code => {
  const iso2 = toISO2(code);
  return [toSupportedLanguage(iso2) ?? iso2, iso2] as const;
}));

const SYSTEM_PROMPT = [
  'You are a master teacher building a complete written lesson for a learner.',
  'Teach progressively, assuming no prior knowledge, building step by step.',
  'When context passages from the learner\'s own notes are provided, ground the',
  'lesson in them. Respond with ONLY a JSON object (no markdown, no code fences)',
  'with these string/array fields, forming a standard teaching flow:',
  '"objective" (what the learner will be able to do), "intro", "explanation"',
  '(a progressive main lesson with definitions, purpose/utility, prerequisites and',
  'step-by-step reasoning; may use markdown), "examples" (array of worked examples),',
  '"commonMisconceptions" (array of concrete misunderstandings and their correction),',
  '"questions" (array of 3-5 guided, open-ended comprehension questions that make',
  'the learner think — NOT graded, distinct from the exercises), "exercises"',
  '(a MIX of 4-6 items, each {"type","question","answer","options"?}: include at',
  'least one "qcm" (multiple choice — give an "options" array of 3-4 choices and',
  'set "answer" to the exact text of the correct option), one or more "open"',
  '(short open-ended), one or more "exercise" (a concrete application to solve),',
  'and one "case" (a realistic practical scenario to reason through). For every',
  'item "answer" is the model answer used as the correction),',
  '"homework", "summary", "keyPoints" (array of 3-5 concise key takeaways — the',
  'essential points to remember, one short sentence each), "revisionSheet" (a',
  'condensed study sheet).',
].join(' ');

const LANGUAGE_MASTERY_EXERCISE_PROMPT = [
  'For this language-mastery lesson only, replace the generic exercise mix with',
  'at least ten genuinely answerable items. Include at least one item for EACH',
  'languageFormat listed here exactly:',
  LANGUAGE_TRAINING_FORMATS.join(', '),
  'Every item keeps type as qcm|open|exercise|case and includes question and',
  'answer. recognition-mcq, contextual-discrimination, register-matching and',
  'listening-discrimination use qcm with 3-4 plausible options and the exact',
  'answer in options. fill-blank-no-hint must not include answer-revealing hints.',
  'sentence-reconstruction includes a shuffled tokens array and always remains',
  'answerable by typing. listening-discrimination includes audioText in the',
  'target language. guided-writing requires a real written production.',
  'voice-pronunciation includes audioText as the phrase to hear and repeat; do',
  'not claim a transcript alone measures pronunciation. mini-dialogue includes',
  'dialogueTurns with two or three contextual turns and asks for the next reply.',
  'Return languageFormat on every language exercise. Do not duplicate a prompt',
  'just to reach ten items.',
].join(' ');

const LANGUAGE_CORE_LESSON_DIRECTIVE = [
  'For this post-placement lesson ONLY, replace the generic 4-6 mixed exercise rule.',
  'Teach the exact server-authored lesson objective at its CEFR level; never invent a new curriculum order.',
  'Write a substantial progressive explanation (at least 600 characters, not two short paragraphs),',
  'at least three worked examples from simple to varied/contextual use and 3-5 guided practice prompts.',
  'Return exactly ten distinct independent multiple-choice exercises, each with type=qcm,',
  '3-4 plausible unique options, answer copied verbatim from one option, and correction.',
  'Each correction explains the mistake/rule, the correct form and another example.',
  'Use the configured support language for objective, intro, explanation, commonMisconceptions,',
  'questions (guided-practice instructions), exercises[].question (instructions), exercises[].correction,',
  'homework instructions, summary, keyPoints and revisionSheet. Preserve the meaning of the server objective,',
  'but translate its pedagogical wording into the support language; do not copy a target-language title as the objective.',
  'Use the target language for examples/expressions, with immediate support-language glosses.',
  'Independent exercise prompts/options must not reveal answers through translations or hints.',
  'Never claim acoustic pronunciation has been assessed from text. Oral teaching may use text practice.',
  'For remediation change the explanation, situations and every exercise, targeting only the specified weaknesses.',
].join(' ');

/**
 * Steering supplied by other services (not by API clients).
 *
 * Deliberately NOT part of GenerateLessonDto: `directive` is injected into the
 * system prompt, so exposing it on the public endpoint would hand callers a
 * prompt-steering knob for no product reason.
 */
export interface InternalLessonOptions {
  /** Post-placement catalogue lesson. Uses the existing writer/persistence,
   * not the unrelated ten-format acoustic mastery contract. Server-only. */
  languageLearningCore?: boolean;
  languageRoleContext?: LanguageLessonRoleContext;
  /** Language profile this lesson belongs to (language engine). */
  languageProfileId?: string;
  /** Extra teaching directive appended to the system prompt (e.g. the language
   *  mode's pedagogical contract). */
  directive?: string;
  /** Server-only switch for the language mastery exercise contract. */
  languageMastery?: boolean;
  /** Server-authored notion/criterion allow-list for one curriculum unit. */
  languageNotions?: readonly {
    notionId: string;
    criterionId: string;
  }[];
  /** Exact failed battery used only to reject duplicate remediation items
   * before the generated lesson is persisted. */
  remediationBaselineExercises?: readonly LessonExercise[];
  /** Persisted teaching content from the failed lesson. It is used only for
   * exact normalized reuse detection, never to judge semantic quality. */
  remediationBaselineContent?: {
    explanation: string;
    examples: readonly string[];
    questions?: readonly string[];
  };
  /** Durable server-only identity of the failed-exam remediation plan that
   * requested this lesson. It is never accepted from GenerateLessonDto. */
  masteryRemediationGenerationKey?: string;
  /** Durable identity for any RLLE lesson generation. Stored in the existing
   * server-only language-generation key column so retries cannot call the
   * provider twice. */
  languageGenerationKey?: string;
}

/** Structured lesson shape returned by the LLM. */
interface RawLesson {
  objective: string;
  intro: string;
  explanation: string;
  examples: string[];
  commonMisconceptions: string[];
  questions: string[];
  exercises: LessonExercise[];
  homework: string;
  summary: string;
  keyPoints: string[];
  revisionSheet: string;
}

/** Written-first learning engine: turns a topic/concept/session into a complete
 *  written lesson, indexes it into long-term memory, and spins up flashcards. */
@Injectable()
export class LessonService {
  private readonly logger = new Logger(LessonService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly retrieval: RetrievalService,
    private readonly documents: DocumentService,
    private readonly concepts: ConceptService,
    private readonly mastery: MasteryService,
    private readonly experienceSessions: ExperienceSessionService,
    private readonly learningDeletions: LearningDataDeletionService,
    private readonly completions: LearningCompletionService,
    private readonly goals: GoalsService,
  ) {}

  async generate(
    userId: string,
    dto: GenerateLessonDto,
    internal: InternalLessonOptions = {},
  ): Promise<LessonView> {
    const { topic, conceptId, tutorSessionId } = await this.resolveTopic(
      userId,
      dto,
    );
    const remediationKey = internal.masteryRemediationGenerationKey?.trim() || null;
    const languageGenerationKey = internal.languageGenerationKey?.trim() || remediationKey;
    if (
      remediationKey
      && internal.languageGenerationKey?.trim()
      && remediationKey !== internal.languageGenerationKey.trim()
    ) {
      throw new BadRequestException('Conflicting language lesson generation keys.');
    }
    if (languageGenerationKey) {
      if ((!internal.languageMastery && !internal.languageLearningCore) || !internal.languageProfileId) {
        throw new BadRequestException('A language generation key requires an owned language profile.');
      }
      const existing = await this.prisma.lesson.findFirst({
        where: { userId, masteryRemediationGenerationKey: languageGenerationKey },
        select: { id: true },
      });
      if (existing) {
        const lesson = await this.get(userId, existing.id);
        if (internal.languageLearningCore && internal.languageRoleContext) {
          this.requireLanguageRoleContent(lesson, internal.languageRoleContext);
        }
        return lesson;
      }
    }

    // Ground the lesson in the learner's existing notes when available.
    const context = internal.languageLearningCore ? '' : await this.retrieveContext(userId, topic);
    const teacherPreferences = await this.loadTeacherPreferences(userId);
    // "Difficulty auto-adapts — mastery down → simplify; mastery up → increase
    // complexity." An explicit level always wins. Turning automatic adaptation
    // off is authoritative and prevents reading mastery to infer a level.
    const level = dto.level ?? (
      teacherPreferences?.automaticAdaptation === false
        ? undefined
        : await this.levelFromMastery(userId, conceptId)
    );
    const localeInstruction =
      internal.directive ??
      (!dto.language ? localeDirective(await resolveLocale(this.prisma, userId)) : undefined);
    const teacherPolicy = resolveTeacherPolicy(teacherPreferences, {
      mode: 'lesson',
      intent: 'learn',
      difficulty: level ?? null,
    });
    const trustedDirective = [localeInstruction, teacherPolicyDirective(teacherPolicy)]
      .filter((value): value is string => Boolean(value))
      .join(' ');
    const generateRawLesson = () => this.generateLesson(
      topic,
      context,
      { ...dto, level },
      trustedDirective,
      internal.languageMastery === true,
      internal.remediationBaselineExercises,
      internal.languageNotions,
      internal.languageLearningCore === true,
      internal.remediationBaselineContent,
      internal.languageRoleContext,
    );
    const persist = async (tx: Prisma.TransactionClient, raw: RawLesson) => {
      const lockKey = accountDataLockKey(userId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      if (tutorSessionId) {
        const tutor = await tx.tutorSession.findFirst({
          where: { id: tutorSessionId, userId },
          select: { id: true },
        });
        if (!tutor) throw new BadRequestException('Tutor session is no longer available.');
      }
      if (internal.languageProfileId) {
        const profile = await tx.languageProfile.findFirst({
          where: { id: internal.languageProfileId, userId },
          select: { id: true },
        });
        if (!profile) throw new BadRequestException('Language profile is no longer available.');
      }
      const createdLesson = await this.guardLessonPersistence('persistence', () => tx.lesson.create({
        data: {
        userId,
        tutorSessionId: tutorSessionId ?? null,
        conceptId: conceptId ?? null,
        languageProfileId: internal.languageProfileId ?? null,
        masteryRemediationGenerationKey: languageGenerationKey,
        language: dto.language?.trim() || null,
        level: level ?? null,
        topic,
        objective: raw.objective,
        intro: raw.intro,
        explanation: raw.explanation,
        examples: raw.examples as unknown as Prisma.InputJsonValue,
        questions: raw.questions as unknown as Prisma.InputJsonValue,
        exercises: raw.exercises as unknown as Prisma.InputJsonValue,
        homework: raw.homework,
        summary: raw.summary,
        keyPoints: raw.keyPoints as unknown as Prisma.InputJsonValue,
        revisionSheet: raw.revisionSheet,
        },
      }), internal.languageLearningCore === true);

      // Freeze the effective policy with the lesson. Corrections later in this
      // lesson must not silently change because Profile preferences were edited.
      const initialFlow = this.initialFlow(this.toView(createdLesson, 0));
      const createdExperience = await this.guardLessonPersistence('lesson-session', () => this.experienceSessions.ensureLessonSession(userId, {
        title: `Lesson — ${topic}`.slice(0, 300),
        intent: 'learn',
        inputModality: 'text',
        currentStep: {
          id: 'lesson',
          label: topic,
          state: 'active',
          metadata: {
            teacherPolicy,
            teacherPolicySource: TEACHER_POLICY_METADATA_SOURCE,
            lessonFlow: initialFlow,
          },
        },
        resumeTarget: { kind: 'route', path: internal.languageLearningCore
          ? `/languages/${internal.languageProfileId}/course` : `/lesson/${createdLesson.id}` },
        links: { lessonId: createdLesson.id,
          ...(internal.languageLearningCore ? { languageProfileId: internal.languageProfileId } : {}) },
      }, tx), internal.languageLearningCore === true);

      // Keep the source document in the same owner-locked transaction as the
      // lesson and its experience wrapper. A concurrent permanent purge can
      // therefore observe either the whole graph or none of it, never an
      // orphan LESSON_AI document created after its lesson was removed.
      // Core lessons are already durable Lesson records. Do not leave a
      // pending Document that boot recovery would later index (and bill)
      // implicitly, even when no queue was started during this request.
      const createdDoc = internal.languageLearningCore ? null : await this.documents.createFromTextInTransaction(userId, {
        title: `Lesson — ${topic}`.slice(0, 300),
        content: this.assemblePlainText(topic, internal.languageLearningCore ? { ...raw, exercises: [] } : raw),
        sourceRef: `lesson:${createdLesson.id}`,
        contentType: 'LESSON_AI',
      }, tx);
      const linkedLesson = createdDoc ? await tx.lesson.update({
        where: { id: createdLesson.id },
        data: { sourceDocumentId: createdDoc.id },
      }) : createdLesson;
      return { lesson: linkedLesson, doc: createdDoc, experience: createdExperience };
    };

    const generated = await this.guardLessonPersistence('persistence', async () => languageGenerationKey
      ? await this.prisma.$transaction(async (tx) => {
          // Only the server-authored remediation path holds this key-scoped
          // lock across the provider call. PostgreSQL releases the xact lock
          // on commit, rollback or connection loss, so a crashed owner never
          // leaves a durable claim that must be guessed stale by a retry.
          const generationLockKey =
            `lesson-language-generation:${userId}:${languageGenerationKey}`;
          await tx.$executeRaw`
            SELECT pg_advisory_xact_lock(hashtextextended(${generationLockKey}, 0))
          `;
          // Fence after taking the lock: two callers may both have missed the
          // cheap preflight read above, but only the first may reach the LLM.
          const existing = await tx.lesson.findFirst({
            where: { userId, masteryRemediationGenerationKey: languageGenerationKey },
            select: { id: true },
          });
          if (existing) return { existingLessonId: existing.id } as const;

          const raw = await generateRawLesson();
          return { created: await persist(tx, raw) } as const;
        }, { maxWait: 10_000, timeout: 120_000 })
      : await (async () => {
          // Keep ordinary lesson generation outside the database transaction.
          const raw = await generateRawLesson();
          return {
            created: await this.prisma.$transaction(async (tx) => persist(tx, raw)),
          } as const;
        })(), internal.languageLearningCore === true);

    if ('existingLessonId' in generated) {
      const lesson = await this.get(userId, generated.existingLessonId);
      if (internal.languageLearningCore && internal.languageRoleContext) {
        this.requireLanguageRoleContent(lesson, internal.languageRoleContext);
      }
      return lesson;
    }
    const { lesson, doc, experience } = generated.created;

    // Workers must only see the generated document after its transaction has
    // committed. Their own durable status/error handling remains unchanged.
    // A bounded catalogue lesson must not trigger implicit paid embedding /
    // extraction calls. Its owned source remains available for later explicit
    // library processing; written learning does not require that enrichment.
    if (doc) this.documents.queuePostCreateProcessing(doc.id);

    if (dto.goalTitle?.trim()) {
      await this.goals.create(userId, {
        title: dto.goalTitle.trim(),
        period: dto.goalPeriod ?? 'weekly',
        experienceSessionId: experience.id,
      });
    }

    // A generated lesson is a draft learning artifact, not evidence of learning.
    // Flashcards and Reviewable rows are materialized only by the completion
    // service after every required step and a real evaluated attempt.
    const cardCount = 0;
    if (conceptId && doc) {
      await this.concepts
        .linkDocument(userId, conceptId, doc.id)
        .catch((e) => this.logger.warn('Learning operation failed.'));
    }

    return this.toView({ ...lesson, sourceDocumentId: doc?.id ?? null }, cardCount);
  }

  async list(userId: string): Promise<LessonSummary[]> {
    const lessons = await this.prisma.lesson.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return lessons.map((l) => ({
      id: l.id,
      topic: l.topic,
      objective: l.objective,
      conceptId: l.conceptId,
      language: l.language,
      createdAt: l.createdAt.toISOString(),
    }));
  }

  async get(userId: string, id: string): Promise<LessonView> {
    const lesson = await this.requireOwned(userId, id);
    const cardCount = lesson.sourceDocumentId
      ? await this.prisma.card.count({
          where: { userId, sourceDocumentId: lesson.sourceDocumentId },
        })
      : 0;
    return this.toView(lesson, cardCount);
  }

  /** The catalogue owns its autonomous assessment. Legacy HTTP readers may
   * show teaching content, never retrieve its unsubmitted answer battery. */
  async getPublic(userId: string, id: string): Promise<LessonView> {
    const lesson = await this.requireOwned(userId, id);
    const view = await this.get(userId, id);
    return lesson.masteryRemediationGenerationKey?.startsWith('language-core:')
      ? { ...view, exercises: [] } : view;
  }

  /** Server-authoritative guided navigation. The state lives on the existing
   * ExperienceSession so refresh/deep-link cannot unlock future steps. */
  async flow(userId: string, id: string): Promise<LessonFlowProgress> {
    const lesson = await this.requireOwned(userId, id);
    const session = await this.ensureFlowSession(userId, lesson);
    const current = this.readFlow(session.currentStep?.metadata?.lessonFlow, lesson);
    if (session.currentStep?.metadata?.lessonFlow) return current;
    await this.writeFlow(userId, session.id, session.currentStep, current);
    return current;
  }

  async validateFlowStep(
    userId: string,
    id: string,
    stepKey: LessonFlowStepKey,
  ): Promise<LessonFlowProgress> {
    const lesson = await this.requireOwned(userId, id);
    if (lesson.masteryRemediationGenerationKey?.startsWith('language-core:')) {
      throw new BadRequestException('This lesson progresses automatically through its language assessment.');
    }
    const session = await this.ensureFlowSession(userId, lesson);
    const flow = this.readFlow(session.currentStep?.metadata?.lessonFlow, lesson);
    if (flow.activeStepKey !== stepKey) {
      throw new BadRequestException('Only the active lesson step can be validated.');
    }
    if (flow.validatedStepKeys.includes(stepKey)) return flow;

    if (stepKey === 'exercises' || stepKey === 'correction' || stepKey === 'revision') {
      await this.requireExerciseCoverage(userId, lesson);
    }
    const isFinal = flow.activeIndex === flow.stepKeys.length - 1;
    // The RLLE autonomy gate is the sole canonical completion authority for
    // language-mastery lessons. Finishing their guided Lesson UI must never
    // create a generic lesson completion or unlock mastery before >= 90%.
    if (isFinal && !this.isLanguageMasteryLesson(lesson)) {
      const attempt = await this.prisma.exerciseAttempt.findFirst({
        where: { userId, lessonId: lesson.id, contentVersion: lesson.contentVersion },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (!attempt) {
        throw new BadRequestException('An evaluated exercise is required to finish this lesson.');
      }
      await this.completions.finalizeLesson(userId, {
        lessonId: lesson.id,
        experienceSessionId: session.id,
        evidence: { kind: 'exercise_attempt', id: attempt.id },
        startedAt: session.startedAt,
      });
    }

    const next: LessonFlowProgress = {
      ...flow,
      validatedStepKeys: [...flow.validatedStepKeys, stepKey],
      completed: isFinal,
      updatedAt: new Date().toISOString(),
    };
    await this.writeFlow(userId, session.id, session.currentStep, next);
    if (isFinal && session.status !== 'completed') {
      await this.experienceSessions.complete(userId, session.id);
    }
    return next;
  }

  async enterFlowStep(
    userId: string,
    id: string,
    stepKey: LessonFlowStepKey,
  ): Promise<LessonFlowProgress> {
    const lesson = await this.requireOwned(userId, id);
    const session = await this.ensureFlowSession(userId, lesson);
    const flow = this.readFlow(session.currentStep?.metadata?.lessonFlow, lesson);
    if (!flow.validatedStepKeys.includes(flow.activeStepKey)) {
      throw new BadRequestException('Validate the active lesson step before continuing.');
    }
    const nextIndex = flow.activeIndex + 1;
    if (nextIndex >= flow.stepKeys.length || flow.stepKeys[nextIndex] !== stepKey) {
      throw new BadRequestException('Lesson steps must be entered in order.');
    }
    const next: LessonFlowProgress = {
      ...flow,
      activeIndex: nextIndex,
      activeStepKey: stepKey,
      updatedAt: new Date().toISOString(),
    };
    await this.writeFlow(userId, session.id, session.currentStep, next);
    return next;
  }

  previewRemoval(userId: string, id: string): Promise<LearningDeletionPreview> {
    return this.learningDeletions.previewLesson(userId, id);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.learningDeletions.deleteLesson(userId, id);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private initialFlow(lesson: LessonView): LessonFlowProgress {
    const stepKeys = lessonFlowStepKeys(lesson);
    return {
      stepKeys,
      activeIndex: 0,
      activeStepKey: stepKeys[0],
      validatedStepKeys: [],
      completed: false,
      updatedAt: new Date().toISOString(),
    };
  }

  private readFlow(value: unknown, lesson: Lesson): LessonFlowProgress {
    const expected = lessonFlowStepKeys(this.toView(lesson, 0));
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return this.initialFlow(this.toView(lesson, 0));
    }
    const raw = value as Partial<LessonFlowProgress>;
    const sameSteps = Array.isArray(raw.stepKeys)
      && raw.stepKeys.length === expected.length
      && raw.stepKeys.every((step, index) => step === expected[index]);
    const activeIndex = Number.isInteger(raw.activeIndex) ? raw.activeIndex as number : -1;
    if (!sameSteps || activeIndex < 0 || activeIndex >= expected.length) {
      return this.initialFlow(this.toView(lesson, 0));
    }
    const validSet = new Set(expected);
    const validatedStepKeys = Array.isArray(raw.validatedStepKeys)
      ? raw.validatedStepKeys.filter(
          (step): step is LessonFlowStepKey =>
            typeof step === 'string' && validSet.has(step as LessonFlowStepKey),
        )
      : [];
    return {
      stepKeys: expected,
      activeIndex,
      activeStepKey: expected[activeIndex],
      validatedStepKeys: [...new Set(validatedStepKeys)],
      completed: raw.completed === true && activeIndex === expected.length - 1,
      updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : new Date().toISOString(),
    };
  }

  private async ensureFlowSession(userId: string, lesson: Lesson) {
    return this.experienceSessions.ensureLessonSession(userId, {
      title: `Lesson — ${lesson.topic}`.slice(0, 300),
      intent: 'learn',
      inputModality: 'text',
      currentStep: {
        id: 'lesson',
        label: lesson.topic,
        state: 'active',
        metadata: { lessonFlow: this.initialFlow(this.toView(lesson, 0)) },
      },
      resumeTarget: { kind: 'route', path: `/lesson/${lesson.id}` },
      links: { lessonId: lesson.id },
    });
  }

  private writeFlow(
    userId: string,
    sessionId: string,
    currentStep: { id: string; label?: string; index?: number; state?: 'pending' | 'active' | 'completed' | 'failed'; metadata?: Record<string, unknown> } | null,
    flow: LessonFlowProgress,
  ) {
    return this.experienceSessions.updateState(userId, sessionId, {
      currentStep: {
        ...(currentStep ?? { id: 'lesson' }),
        state: flow.completed ? 'completed' : 'active',
        metadata: { ...(currentStep?.metadata ?? {}), lessonFlow: flow },
      },
      progress: {
        completed: flow.validatedStepKeys.length,
        total: flow.stepKeys.length,
      },
    });
  }

  private async requireExerciseCoverage(userId: string, lesson: Lesson): Promise<void> {
    const exercises = (lesson.exercises as unknown as LessonExercise[]) ?? [];
    if (exercises.length === 0) {
      throw new BadRequestException('This lesson has no evaluable final exercise.');
    }
    const attempts = await this.prisma.exerciseAttempt.findMany({
      where: { userId, lessonId: lesson.id, contentVersion: lesson.contentVersion },
      distinct: ['exerciseIndex'],
      select: { exerciseIndex: true },
    });
    const attempted = new Set(attempts.map((attempt) => attempt.exerciseIndex));
    const languageMastery = this.isLanguageMasteryLesson(lesson);
    if (exercises.some((exercise, index) =>
      // Pronunciation is evaluated by the RLLE audio-native endpoint. It must
      // not be fabricated as a generic text ExerciseAttempt merely to advance
      // this presentation flow; the RLLE gate still requires its audio proof.
      !(languageMastery && exercise.languageFormat === 'voice-pronunciation')
      && !attempted.has(index))) {
      throw new BadRequestException('Complete every lesson exercise before continuing.');
    }
  }

  private isLanguageMasteryLesson(lesson: Lesson): boolean {
    if (!lesson.languageProfileId || !Array.isArray(lesson.exercises)) return false;
    const formats = new Set(
      (lesson.exercises as unknown as LessonExercise[])
        .map((exercise) => exercise.languageFormat)
        .filter((format): format is LanguageTrainingFormat => Boolean(format)),
    );
    return LANGUAGE_TRAINING_FORMATS.every((format) => formats.has(format));
  }

  private async resolveTopic(
    userId: string,
    dto: GenerateLessonDto,
  ): Promise<{ topic: string; conceptId?: string; tutorSessionId?: string }> {
    if (dto.topic?.trim()) {
      return {
        topic: dto.topic.trim(),
        conceptId: await this.validateConcept(userId, dto.conceptId),
        tutorSessionId: await this.validateSession(userId, dto.tutorSessionId),
      };
    }
    if (dto.conceptId) {
      const concept = await this.prisma.concept.findUnique({
        where: { id: dto.conceptId },
      });
      if (!concept || concept.userId !== userId) {
        throw new NotFoundException('Concept not found.');
      }
      return {
        topic: concept.name,
        conceptId: concept.id,
        tutorSessionId: await this.validateSession(userId, dto.tutorSessionId),
      };
    }
    if (dto.tutorSessionId) {
      const session = await this.prisma.tutorSession.findUnique({
        where: { id: dto.tutorSessionId },
      });
      if (!session || session.userId !== userId) {
        throw new NotFoundException('Tutor session not found.');
      }
      if (!session.title) {
        throw new BadRequestException(
          'That session has no topic yet — provide a topic explicitly.',
        );
      }
      return { topic: session.title, tutorSessionId: session.id };
    }
    throw new BadRequestException(
      'Provide a topic, conceptId, or tutorSessionId.',
    );
  }

  private async validateConcept(
    userId: string,
    conceptId?: string,
  ): Promise<string | undefined> {
    if (!conceptId) return undefined;
    const concept = await this.prisma.concept.findUnique({
      where: { id: conceptId },
    });
    if (!concept || concept.userId !== userId) {
      throw new NotFoundException('Concept not found.');
    }
    return concept.id;
  }

  private async validateSession(
    userId: string,
    sessionId?: string,
  ): Promise<string | undefined> {
    if (!sessionId) return undefined;
    const session = await this.prisma.tutorSession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Tutor session not found.');
    }
    return session.id;
  }

  /**
   * Pitch a concept lesson at the learner's current grasp of it (spec: "Active +
   * adaptive"). Returns undefined when there is no concept or no evidence yet —
   * guessing a level from nothing would be worse than letting the model choose.
   */
  private async levelFromMastery(
    userId: string,
    conceptId?: string,
  ): Promise<GenerateLessonDto['level']> {
    if (!conceptId) return undefined;
    const m = await this.mastery
      .conceptMastery(userId, conceptId)
      .catch(() => null);
    if (!m || m.mastery === null || m.reviewedCount === 0) return undefined;
    if (m.level === 'strong') return 'advanced';
    if (m.level === 'developing') return 'intermediate';
    return 'beginner';
  }

  private async loadTeacherPreferences(userId: string): Promise<KycTeacher | null> {
    const onboarding = await this.prisma.onboardingProfile.findUnique({
      where: { userId },
      select: { teacher: true },
    });
    return (onboarding?.teacher as KycTeacher | null) ?? null;
  }

  /**
   * Grounding is an enhancement, not a precondition: the lesson prompt already
   * handles an empty context. So a vector-store hiccup must degrade the lesson
   * to ungrounded, not destroy it — observed for real as a Qdrant
   * `Request Timeout` turning a whole lesson generation into a 500.
   */
  private async retrieveContext(userId: string, topic: string): Promise<string> {
    let results;
    try {
      ({ results } = await this.retrieval.search(userId, topic, {
        limit: CONTEXT_LIMIT,
      }));
    } catch (error) {
      this.logger.warn('Learning operation failed.');
      return '';
    }
    return results
      .map((r, i) => `[${i + 1}] (from "${r.documentTitle}")\n${r.content}`)
      .join('\n\n');
  }

  private async generateLesson(
    topic: string,
    context: string,
    dto: GenerateLessonDto,
    directive?: string,
    languageMastery = false,
    remediationBaselineExercises?: readonly LessonExercise[],
    languageNotions?: readonly { notionId: string; criterionId: string }[],
    languageLearningCore = false,
    remediationBaselineContent?: InternalLessonOptions['remediationBaselineContent'],
    languageRoleContext?: LanguageLessonRoleContext,
  ): Promise<RawLesson> {
    if (languageMastery && !languageNotions?.length) {
      throw new UnprocessableEntityException(
        'A structured language lesson requires server-authored notions.',
      );
    }
    const level = dto.level ? ` Pitch it at a ${dto.level} level.` : '';
    const language = dto.language
      ? languageLearningCore
        ? ` The language being learned is ${dto.language}; this is NOT an instruction to write teaching prose in that language.`
        : ` This is a ${dto.language} language lesson; teach ${dto.language}.`
      : '';
    const notionDirective = languageNotions?.length
      ? [
          'Every exercise must include a non-empty notionIds array.',
          'Use only these exact server-authorized notion/criterion pairs:',
          JSON.stringify(languageNotions),
          'Cover every authorized notion at least once across the complete exercise battery.',
          'When the response schema assigns notions to a format, follow that exact assignment.',
          'Select notionIds only; criterionIds are attached authoritatively by the server.',
        ].join(' ')
      : '';
    const baseSystem = languageLearningCore
      ? `${SYSTEM_PROMPT} ${LANGUAGE_CORE_LESSON_DIRECTIVE}`
      : languageMastery
      ? `${SYSTEM_PROMPT} ${LANGUAGE_MASTERY_EXERCISE_PROMPT} ${notionDirective}`
      : SYSTEM_PROMPT;
    // This scoped language-only contract is last, after TeacherPolicy and the
    // catalogue directive, so a target-language objective/preference cannot
    // silently replace the learner's selected instruction language.
    const finalLanguageDirective = languageLearningCore && languageRoleContext
      ? this.languageRoleDirective(languageRoleContext, dto.level) : '';
    const system = [baseSystem, directive, finalLanguageDirective].filter(Boolean).join(' ');
    let result: { text: string };
    try {
      result = await this.llm.generate(
        [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              `Create a complete written lesson on: "${topic}".${level}${language}` +
              (context ? `\n\nGround it in my notes where relevant:\n${context}` : ''),
          },
        ],
        {
          temperature: 0.4,
          operation: languageLearningCore ? 'language-core-lesson' : 'lesson',
          ...(languageLearningCore
            ? { jsonSchema: this.languageCoreLessonJsonSchema(languageRoleContext) }
            : languageMastery
            ? { jsonSchema: this.languageLessonJsonSchema(languageNotions ?? []) }
            : {}),
        },
      );
    } catch (error) {
      throw this.lessonGenerationFailure('provider', 'PROVIDER_REQUEST_FAILED');
    }
    const text = result?.text;
    if (languageLearningCore) this.lessonGenerationTrace('provider', 'PASS', {
      textType: typeof text, textCharacters: typeof text === 'string' ? text.length : 0,
    });
    if (typeof text !== 'string' || !text.trim()) {
      throw this.lessonGenerationFailure('adapter', 'PROVIDER_TEXT_MISSING', {
        textType: typeof text,
      });
    }
    if (languageLearningCore) this.lessonGenerationTrace('adapter', 'PASS', {
      textCharacters: text.length,
    });
    const lesson = this.parseLesson(text, languageMastery, remediationBaselineExercises,
      languageNotions, languageLearningCore, remediationBaselineContent);
    if (languageLearningCore && languageRoleContext) this.requireLanguageRoleContent(lesson, languageRoleContext);
    return lesson;
  }

  private languageCoreLessonJsonSchema(roles?: LanguageLessonRoleContext) {
    // Mirror the parser's existing structural minima in Structured Outputs so
    // a successful provider envelope cannot legally contain a one-line shell.
    // Content semantics, answer matching and novelty remain server checked.
    const support = roles ? this.languageRoleNames(roles).support : 'the configured support language';
    const target = roles ? this.languageRoleNames(roles).target : 'the learning target language';
    const text = { type: 'string', pattern: '\\S' };
    const teachingText = { ...text, description: `Pedagogical prose in ${support}. Target examples may be quoted in ${target}.` };
    const texts = (minimum: number, maximum?: number) => ({
      type: 'array', items: text, minItems: minimum,
      ...(maximum === undefined ? {} : { maxItems: maximum }),
    });
    return {
      name: 'language_core_lesson', strict: true,
      schema: {
        type: 'object', additionalProperties: false,
        required: ['objective', 'intro', 'explanation', 'examples', 'commonMisconceptions',
          'questions', 'exercises', 'homework', 'summary', 'keyPoints', 'revisionSheet'],
        properties: {
          objective: { ...teachingText, description: `Learning objective expressed in ${support}, preserving the catalogue objective meaning, not its original wording.` },
          intro: teachingText,
          explanation: { ...teachingText, pattern: '^[\\s\\S]{600,}$' },
          examples: { ...texts(3), description: `Keep each worked example in ${target}, followed by its immediate concise ${support} meaning. Do not replace the target text with its translation.` },
          commonMisconceptions: { ...texts(1), items: teachingText },
          questions: { ...texts(3, 5), items: teachingText },
          homework: { type: 'string', description: `Optional practice instructions in ${support}, with target production in ${target}.` },
          summary: teachingText, keyPoints: { ...texts(3, 5), items: teachingText }, revisionSheet: teachingText,
          exercises: { type: 'array', minItems: 10, maxItems: 12, items: {
            type: 'object', additionalProperties: false,
            required: ['question', 'answer', 'type', 'options', 'correction'],
            properties: { question: teachingText,
              answer: { ...text, description: `Exact correct option text; keep the requested learning production in ${target}.` },
              type: { type: 'string', enum: ['qcm'] },
              options: { ...texts(3, 4), description: `Independent learning options in ${target} where appropriate; no support-language translation revealing the answer.` },
              correction: { ...teachingText, description: `Explain the error and rule in ${support}; keep the corrected form and another quoted example in ${target}.` } },
          } },
        },
      },
    };
  }

  private languageRoleNames(roles: LanguageLessonRoleContext) {
    const supportCode = toSupportedLanguage(roles.supportLanguageCode);
    const targetCode = toSupportedLanguage(roles.targetLanguageCode ?? roles.targetLanguage);
    if (!supportCode || !targetCode) {
      throw new BadRequestException('A language lesson requires configured support and target language roles.');
    }
    return { supportCode, targetCode, support: SUPPORTED_LANGUAGES[supportCode].englishName,
      target: SUPPORTED_LANGUAGES[targetCode].englishName };
  }

  private languageRoleDirective(roles: LanguageLessonRoleContext, level?: string): string {
    const names = this.languageRoleNames(roles);
    return [
      'FINAL AUTHORITATIVE LANGUAGE ROLE CONTRACT (language roles only; never change grading or curriculum):',
      JSON.stringify({ supportLanguage: names.support, supportLanguageCode: names.supportCode,
        targetLanguage: names.target, targetLanguageCode: names.targetCode,
        level: level ?? null, module: roles.moduleId ?? null, lessonObjective: roles.lessonObjective ?? null }),
      'The catalogue objective/title may be written in the target language. Preserve its meaning,',
      'but express the objective field itself in supportLanguage, not by copying catalogue wording.',
      'Write objective, intro, explanation (including grammar/vocabulary rules and pedagogical notes),',
      'commonMisconceptions, questions/guided-practice instructions, exercise instructions in question,',
      'correction explanations, homework instructions, summary, keyPoints and revisionSheet primarily in supportLanguage.',
      'Write target vocabulary, expressions, dialogues, example sentences, listening/reading material,',
      'sentences to repeat and expected target-language productions in targetLanguage.',
      'Preserve each examples[] target sentence and follow it with the immediate support-language meaning.',
      'Each existing string may contain support-language instruction plus clearly quoted target-language text;',
      'use quotation marks or backticks for embedded target examples instead of switching the teaching prose.',
      'Corrections and remediation explain the mistake in supportLanguage but keep the corrected target form',
      'and new example in targetLanguage. Never translate away the language being learned.',
      'Autonomous exercises retain understandable support-language instructions, but no translations, hints,',
      'model answers or corrections that reveal the answer before submission.',
      'This explicit supportLanguage takes priority over target-language titles, input language, immersion',
      'ratios or general teacher language preferences. It never lowers an exam standard or mastery threshold.',
    ].join(' ');
  }

  /** No mutation, provider or logging. Null means no RELIABLE contradiction,
   * not semantic certification. Short, ambiguous and unsupported languages are
   * deliberately left UNKNOWN rather than rejecting legitimate bilingual work. */
  getLanguageRoleViolation(content: LanguageRoleContent, roles: LanguageLessonRoleContext): LanguageRoleViolation | null {
    const fields: [string, unknown][] = [
      ['objective', content.objective], ['intro', content.intro], ['explanation', content.explanation],
      ['homework', content.homework], ['summary', content.summary], ['revisionSheet', content.revisionSheet],
      ...(content.commonMisconceptions ?? []).map(value => ['commonMisconceptions', value] as [string, unknown]),
      ...(content.questions ?? []).map(value => ['questions', value] as [string, unknown]),
      ...(content.keyPoints ?? []).map(value => ['keyPoints', value] as [string, unknown]),
      ...(content.exercises ?? []).flatMap(exercise => [
        ['exercises.question', exercise.question], ['exercises.correction', exercise.correction],
      ] as [string, unknown][]),
    ];
    // examples[], answers, options, audioText and dialogueTurns are learning
    // target material, NOT samples for checking the teaching language.
    const violating = [...new Set(fields.filter(([, value]) => typeof value === 'string'
      && this.hasReliableTeachingLanguageMismatch(value, roles)).map(([field]) => field))];
    return violating.length ? { code: 'LESSON_SUPPORT_LANGUAGE_CONTRACT_VIOLATION',
      stage: 'content', reason: 'PEDAGOGICAL_LANGUAGE_MISMATCH', fields: violating } : null;
  }

  /** Professor Help reuses the exact same conservative checker. It never
   * changes a score, an assessment, a completion or a progress record. */
  getLanguageTeachingTextViolation(text: string, roles: LanguageLessonRoleContext): LanguageRoleViolation | null {
    return this.hasReliableTeachingLanguageMismatch(text, roles)
      ? { code: 'LESSON_SUPPORT_LANGUAGE_CONTRACT_VIOLATION', stage: 'content',
          reason: 'PEDAGOGICAL_LANGUAGE_MISMATCH', fields: ['teachingText'] }
      : null;
  }

  private requireLanguageRoleContent(content: LanguageRoleContent, roles: LanguageLessonRoleContext): void {
    const violation = this.getLanguageRoleViolation(content, roles);
    if (!violation) return;
    const shape = { invalidLanguageFieldCount: violation.fields.length };
    this.lessonGenerationTrace('content', 'FAIL', shape, violation.reason);
    const names = this.languageRoleNames(roles);
    this.logger.error(JSON.stringify({ event: 'LESSON_LANGUAGE_ROLE_REJECTED', ...violation,
      supportLanguageCode: names.supportCode, targetLanguageCode: names.targetCode }));
    throw new UnprocessableEntityException({ statusCode: 422,
      message: 'The teacher did not respect the selected teaching language.', ...violation,
      reasons: [violation.reason], shape });
  }

  private hasReliableTeachingLanguageMismatch(text: string, roles: LanguageLessonRoleContext): boolean {
    const support = toSupportedLanguage(roles.supportLanguageCode);
    if (!support) return false;
    const baseCode = new Intl.Locale(support).language;
    const detectorSupport = LANGUAGE_ID_CODES.get(support) ?? LANGUAGE_ID_CODES.get(baseCode);
    // TinyLD has no validated profiles for every product language. In
    // particular ln/sw/wo/ha must not be guessed from neighbouring languages.
    if (!detectorSupport) return false;
    const sample = text.normalize('NFKC')
      .replace(/```[\s\S]*?```/gu, ' ')
      .replace(/`[^`\n]*`/gu, ' ')
      .replace(/"[^"\n]*"|“[^”\n]*”|«[^»\n]*»|‘[^’\n]*’/gu, ' ')
      .replace(/https?:\/\/\S+/gu, ' ')
      .trim().slice(0, 12_000);
    const letters = sample.match(/\p{L}/gu) ?? [];
    if (letters.length < 80) return false;
    // Script contradictions are only a fallback on substantial prose. Quoted
    // target examples were removed above, never banned as English/Latin words.
    const target = toSupportedLanguage(roles.targetLanguageCode ?? roles.targetLanguage);
    if (target) {
      try {
        const expectedScript = new Intl.Locale(support).maximize().script;
        const targetScript = new Intl.Locale(target).maximize().script;
        if (expectedScript && targetScript && expectedScript !== targetScript) {
          const expected = new RegExp(`\\p{Script_Extensions=${expectedScript}}`, 'u');
          const other = new RegExp(`\\p{Script_Extensions=${targetScript}}`, 'u');
          if (!letters.some(letter => expected.test(letter)) && letters.every(letter => other.test(letter))) return true;
        }
      } catch { /* Composite Unicode scripts or uncertain tags remain UNKNOWN. */ }
    }
    const words = sample.match(/\p{L}[\p{L}\p{M}'’-]*/gu) ?? [];
    if (words.length < 12) return false;
    try {
      // Compare against ALL detector languages, not just a forced support /
      // target pair. Scores are heuristic signals, not calibrated probabilities.
      const candidates = detectAll(sample).filter(item => Number.isFinite(item.accuracy));
      const first = candidates[0];
      if (!first) return false;
      const second = candidates[1]?.accuracy ?? 0;
      const supportScore = candidates.find(item => item.lang === detectorSupport)?.accuracy ?? 0;
      const contradiction = first.lang !== detectorSupport && first.accuracy >= 0.97
        && first.accuracy - second >= 0.35 && supportScore <= 0.2;
      // Quoted target material was removed; short unquoted target sentences
      // cannot supply the substantial evidence required for a mixed-field
      // rejection. One support sentence, however, must not excuse an otherwise
      // overwhelmingly wrong-language pedagogical field.
      const spans = sample.split(/\n+|[.!?؟]+\s+/u).slice(0, 40);
      const corroborating = new Map<string, { count: number; letters: number }>();
      let supportEvidence = 0;
      for (const span of spans) {
        const spanLetters = (span.match(/\p{L}/gu) ?? []).length;
        const spanWords = (span.match(/\p{L}[\p{L}\p{M}'’-]*/gu) ?? []).length;
        if (spanLetters < 20 || spanWords < 4) continue;
        const ranked = detectAll(span).filter(item => Number.isFinite(item.accuracy));
        if (ranked[0]?.lang === detectorSupport && ranked[0].accuracy >= 0.97
          && ranked[0].accuracy - (ranked[1]?.accuracy ?? 0) >= 0.35) supportEvidence += spanLetters;
        if (spanLetters >= 40 && spanWords >= 8 && ranked[0] && ranked[0].lang !== detectorSupport
          && ranked[0].accuracy >= 0.97 && ranked[0].accuracy - (ranked[1]?.accuracy ?? 0) >= 0.35) {
          const evidence = corroborating.get(ranked[0].lang) ?? { count: 0, letters: 0 };
          corroborating.set(ranked[0].lang, { count: evidence.count + 1,
            letters: evidence.letters + spanLetters });
        }
      }
      // This is a conservative language-detection confidence boundary, never a
      // learning/mastery score. Unknown and short spans stay in the denominator.
      const overwhelming = [...corroborating.values()].some(evidence => evidence.count >= 2
        && evidence.letters / letters.length > 0.8);
      return overwhelming || (contradiction && supportEvidence === 0);
    } catch {
      // A detector failure must not fabricate a language verdict.
      return false;
    }
  }

  /** The provider guarantees the JSON envelope while the parser below remains
   *  authoritative for semantic rules (format coverage, QCM correctness and
   *  notion/criterion pairing). This prevents a valid provider response with
   *  prose or missing fields from becoming an unusable 422 course shell. */
  private languageLessonJsonSchema(
    languageNotions: readonly { notionId: string; criterionId: string }[],
  ): NonNullable<LLMGenerateOptions['jsonSchema']> {
    if (languageNotions.length === 0) {
      throw new UnprocessableEntityException(
        'A structured language lesson requires server-authored notions.',
      );
    }
    const notionAssignments = this.languageExerciseNotionAssignments(languageNotions);
    const stringArray = (minimum: number, maximum?: number) => ({
      type: 'array',
      items: { type: 'string', minLength: 1 },
      minItems: minimum,
      ...(maximum === undefined ? {} : { maxItems: maximum }),
    });
    const qcmFormats = new Set<LanguageTrainingFormat>([
      'recognition-mcq',
      'contextual-discrimination',
      'register-matching',
      'listening-discrimination',
    ]);
    const typeByFormat: Record<LanguageTrainingFormat, ExerciseType> = {
      'recognition-mcq': 'qcm',
      'contextual-discrimination': 'qcm',
      'fill-blank-no-hint': 'open',
      'sentence-reconstruction': 'exercise',
      'register-matching': 'qcm',
      'error-correction': 'exercise',
      'listening-discrimination': 'qcm',
      'guided-writing': 'open',
      'voice-pronunciation': 'open',
      'mini-dialogue': 'case',
    };
    const exerciseProperties = Object.fromEntries(
      LANGUAGE_TRAINING_FORMATS.map((format) => [format, {
        type: 'object',
        additionalProperties: false,
        description: `Generate an exercise that directly practices these server-assigned notions: ${notionAssignments[format].join(', ')}.`,
        required: [
          'type', 'question', 'answer', 'options', 'languageFormat', 'tokens',
          'audioText', 'dialogueTurns', 'notionIds',
        ],
        properties: {
          type: { type: 'string', enum: [typeByFormat[format]] },
          question: { type: 'string', minLength: 1 },
          answer: { type: 'string', minLength: 1 },
          options: qcmFormats.has(format) ? stringArray(3, 4) : { type: 'null' },
          languageFormat: { type: 'string', enum: [format] },
          tokens: format === 'sentence-reconstruction' ? stringArray(2) : { type: 'null' },
          audioText: format === 'listening-discrimination' || format === 'voice-pronunciation'
            ? { type: 'string', minLength: 1 }
            : { type: 'null' },
          dialogueTurns: format === 'mini-dialogue' ? stringArray(2, 3) : { type: 'null' },
          notionIds: {
            type: 'array',
            description: 'Return every assigned notion id exactly once.',
            items: { type: 'string', enum: notionAssignments[format] },
            minItems: notionAssignments[format].length,
            maxItems: notionAssignments[format].length,
          },
        },
      }]),
    );
    return {
      name: 'second_brain_language_lesson',
      description: 'A concise structured language lesson with exactly one activity for each required training format.',
      strict: true,
      schema: {
        type: 'object',
        additionalProperties: false,
        required: [
          'objective', 'intro', 'explanation', 'examples', 'commonMisconceptions',
          'questions', 'exercises', 'homework', 'summary', 'keyPoints', 'revisionSheet',
        ],
        properties: {
          objective: { type: 'string', minLength: 1 },
          intro: { type: 'string', minLength: 1 },
          explanation: { type: 'string', minLength: 1 },
          examples: stringArray(1),
          commonMisconceptions: stringArray(1),
          questions: stringArray(3, 5),
          exercises: {
            type: 'object',
            additionalProperties: false,
            description: 'Exactly one exercise for every canonical training format.',
            required: [...LANGUAGE_TRAINING_FORMATS],
            properties: exerciseProperties,
          },
          homework: { type: 'string' },
          summary: { type: 'string', minLength: 1 },
          keyPoints: stringArray(3, 5),
          revisionSheet: { type: 'string', minLength: 1 },
        },
      },
    };
  }

  /** Assign all canonical notions to the ten formats before calling a provider.
   *  This makes exercise linkage deterministic and keeps the curriculum—not a
   *  probabilistic response—as the authority for notion coverage. */
  private languageExerciseNotionAssignments(
    languageNotions: readonly { notionId: string; criterionId: string }[],
  ): Record<LanguageTrainingFormat, string[]> {
    if (languageNotions.length === 0) {
      throw new UnprocessableEntityException(
        'A structured language lesson requires server-authored notions.',
      );
    }
    const assignments = Object.fromEntries(
      LANGUAGE_TRAINING_FORMATS.map((format) => [format, [] as string[]]),
    ) as Record<LanguageTrainingFormat, string[]>;
    languageNotions.forEach((notion, index) => {
      assignments[LANGUAGE_TRAINING_FORMATS[index % LANGUAGE_TRAINING_FORMATS.length]].push(
        notion.notionId,
      );
    });
    LANGUAGE_TRAINING_FORMATS.forEach((format, index) => {
      if (assignments[format].length === 0) {
        assignments[format].push(languageNotions[index % languageNotions.length].notionId);
      }
    });
    return assignments;
  }

  private parseLesson(
    raw: string,
    languageMastery = false,
    remediationBaselineExercises?: readonly LessonExercise[],
    languageNotions?: readonly { notionId: string; criterionId: string }[],
    languageLearningCore = false,
    remediationBaselineContent?: InternalLessonOptions['remediationBaselineContent'],
  ): RawLesson {
    if (typeof raw !== 'string' || !raw.trim()) {
      throw this.lessonGenerationFailure('adapter', 'PROVIDER_TEXT_MISSING', { textType: typeof raw });
    }
    // Strict core output is one JSON object, never an array whose first object
    // is silently salvaged. Keep the legacy prose-envelope compatibility only
    // for the unrelated generic lesson writer.
    const json = raw.trim().replace(/^```(?:json)?\s*\n?([\s\S]*?)\n?```$/iu, '$1').trim();
    let root: unknown;
    try {
      root = JSON.parse(json);
    } catch {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (!languageLearningCore && start !== -1 && end > start) {
        try { root = JSON.parse(raw.slice(start, end + 1)); } catch { /* fail closed below */ }
      }
      if (root === undefined) throw this.lessonGenerationFailure('parser', 'INVALID_JSON', {
        textCharacters: raw.length,
      });
    }
    if (!root || typeof root !== 'object' || Array.isArray(root)) {
      throw this.lessonGenerationFailure('parser', 'JSON_OBJECT_REQUIRED', {
        rootType: root === null ? 'null' : Array.isArray(root) ? 'array' : typeof root,
      });
    }
    const parsed = root as Record<string, unknown>;
    if (languageLearningCore) this.lessonGenerationTrace('parser', 'PASS');
    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    const objective = str(parsed.objective);
    const intro = str(parsed.intro);
    const explanation = str(parsed.explanation);
    const summary = str(parsed.summary);
    const revisionSheet = str(parsed.revisionSheet);
    const examples = this.nonEmptyStrings(parsed.examples);
    const commonMisconceptions = this.nonEmptyStrings(parsed.commonMisconceptions);
    const questions = this.nonEmptyStrings(parsed.questions);
    const keyPoints = this.nonEmptyStrings(parsed.keyPoints);
    const structuredExercises = languageMastery
      && parsed.exercises
      && typeof parsed.exercises === 'object'
      && !Array.isArray(parsed.exercises)
        ? parsed.exercises as Record<string, unknown>
        : null;
    const notionAssignments = structuredExercises && languageNotions?.length
      ? this.languageExerciseNotionAssignments(languageNotions)
      : null;
    const rawExercises = Array.isArray(parsed.exercises)
      ? parsed.exercises
      : structuredExercises
        ? LANGUAGE_TRAINING_FORMATS.map((format) => {
            const candidate = structuredExercises[format];
            return candidate && typeof candidate === 'object' && notionAssignments
              ? { ...candidate, notionIds: notionAssignments[format] }
              : candidate;
          })
        : [];
    const exercises = rawExercises.length > 0
      ? rawExercises
          .map((exercise) => this.normalizeExercise(exercise, languageMastery, languageNotions))
          .filter((exercise): exercise is LessonExercise => exercise !== null)
      : [];
    const exerciseTypes = new Set(exercises.map((exercise) => exercise.type));
    const genericExerciseContract =
      exercises.length >= 4 && exercises.length <= 6 &&
      (['qcm', 'open', 'exercise', 'case'] as const).every((type) => exerciseTypes.has(type));
    const languageExerciseContract =
      exercises.length >= LANGUAGE_TRAINING_FORMATS.length &&
      LANGUAGE_TRAINING_FORMATS.every((format) =>
        exercises.some((exercise) => exercise.languageFormat === format));
    const coreExerciseContract = exercises.length >= 10 && exercises.length <= 12
      && exercises.every((exercise) => exercise.type === 'qcm' && Boolean(exercise.correction))
      && new Set(exercises.map((exercise) => exercise.question.normalize('NFKC').trim().toLowerCase())).size === exercises.length;
    const coveredNotions = new Set(exercises.flatMap((exercise) => exercise.notionIds ?? []));
    const notionCoverageContract = !languageNotions?.length
      || languageNotions.every((notion) => coveredNotions.has(notion.notionId));
    const reasons: string[] = [];
    if (!objective) reasons.push('OBJECTIVE_REQUIRED');
    if (!intro) reasons.push('INTRO_REQUIRED');
    if (!explanation) reasons.push('EXPLANATION_REQUIRED');
    if (!summary) reasons.push('SUMMARY_REQUIRED');
    if (!revisionSheet) reasons.push('REVISION_SHEET_REQUIRED');
    if (examples.length < (languageLearningCore ? 3 : 1)) reasons.push('WORKED_EXAMPLES_REQUIRED');
    if (languageLearningCore && explanation.length < 600) reasons.push('EXPLANATION_TOO_SHORT');
    if (commonMisconceptions.length < 1) reasons.push('MISCONCEPTION_CORRECTION_REQUIRED');
    if (questions.length < 3 || questions.length > 5) reasons.push('GUIDED_PRACTICE_REQUIRED');
    if (keyPoints.length < 3 || keyPoints.length > 5) reasons.push('KEY_POINTS_REQUIRED');
    if (languageLearningCore) {
      const distinctText = (values: readonly string[]) => new Set(values.map(value =>
        value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase())).size;
      if (distinctText(examples) !== examples.length) reasons.push('DUPLICATE_WORKED_EXAMPLE');
      if (distinctText(questions) !== questions.length) reasons.push('DUPLICATE_GUIDED_PROMPT');
      if (!rawExercises.length) reasons.push('EXERCISES_REQUIRED');
      if (rawExercises.length !== exercises.length) reasons.push('INVALID_EXERCISE_ITEM');
      if (exercises.length < 10 || exercises.length > 12) reasons.push('EXERCISE_COUNT_INVALID');
      if (exercises.some(exercise => exercise.type !== 'qcm')) reasons.push('QCM_EXERCISE_REQUIRED');
      if (exercises.some(exercise => !exercise.correction)) reasons.push('EXERCISE_CORRECTION_REQUIRED');
      if (new Set(exercises.map(exercise => exercise.question.normalize('NFKC').trim().toLowerCase())).size !== exercises.length) {
        reasons.push('DUPLICATE_EXERCISE_PROMPT');
      }
      if (!coreExerciseContract) reasons.push('CORE_EXERCISE_CONTRACT_INVALID');
      for (const key of ['examples', 'commonMisconceptions', 'questions', 'keyPoints'] as const) {
        const values = parsed[key];
        if (!Array.isArray(values) || values.some(value => typeof value !== 'string' || !value.trim())) {
          reasons.push('INVALID_CONTENT_ARRAY_ITEM');
        }
      }
      if (rawExercises.some(value => {
        if (!value || typeof value !== 'object') return false;
        const options = (value as Record<string, unknown>).options;
        return Array.isArray(options) && (options.some(option => typeof option !== 'string' || !option.trim())
          || new Set(options.map(option => typeof option === 'string' ? option.trim() : '')).size !== options.length);
      })) reasons.push('INVALID_QCM_OPTIONS');
    } else if (languageMastery ? !languageExerciseContract || !notionCoverageContract : !genericExerciseContract) {
      reasons.push(languageMastery ? 'LANGUAGE_EXERCISE_CONTRACT_INVALID' : 'EXERCISE_CONTRACT_INVALID');
    }
    const shape = {
      explanationCharacters: explanation.length, exampleCount: examples.length,
      guidedPracticeCount: questions.length, exerciseCount: rawExercises.length,
      validExerciseCount: exercises.length, keyPointCount: keyPoints.length,
    };
    if (reasons.length) throw this.lessonGenerationFailure('content', reasons[0], shape, [...new Set(reasons)]);
    if (languageLearningCore) this.lessonGenerationTrace('content', 'PASS', shape);
    if ((languageMastery || languageLearningCore) && remediationBaselineExercises) {
      this.requireNovelRemediationExercises(exercises, remediationBaselineExercises);
    }
    if (languageLearningCore && remediationBaselineContent) {
      const normalize = (value: string) => value.normalize('NFKC').replace(/\s+/gu, ' ').trim().toLowerCase();
      // Stored explanations contain the appended misconception callouts.
      // Compare the actual teaching body, not these supplementary callouts.
      const previousExplanation = remediationBaselineContent.explanation.split(/\n\n> ⚠️ /u)[0];
      if (normalize(explanation) === normalize(previousExplanation)) {
        throw this.lessonGenerationFailure('content', 'REMEDIATION_EXPLANATION_REUSED', shape);
      }
      const previousExamples = new Set(remediationBaselineContent.examples.map(normalize));
      if (examples.some(example => previousExamples.has(normalize(example)))) {
        throw this.lessonGenerationFailure('content', 'REMEDIATION_EXAMPLES_REUSED', shape);
      }
    }
    return {
      objective,
      intro,
      explanation: [
        explanation,
        ...commonMisconceptions.map((item) => `> ⚠️ ${item}`),
      ].join('\n\n'),
      examples,
      commonMisconceptions,
      questions,
      exercises,
      homework: str(parsed.homework),
      summary,
      keyPoints,
      revisionSheet,
    };
  }

  private lessonGenerationTrace(
    stage: string,
    status: 'PASS' | 'FAIL',
    shape: Readonly<Record<string, string | number>> = {},
    reason?: string,
  ): void {
    const trace = JSON.stringify({ event: 'lesson-generation', stage, status,
      ...(reason ? { reason } : {}), shape });
    if (status === 'FAIL') this.logger.error(trace);
    else this.logger.log(trace);
  }

  /** Never expose exception messages or provider/user text. Only fixed stage /
   * reason codes and numeric/type shape metadata cross this boundary. */
  private lessonGenerationFailure(
    stage: 'provider' | 'adapter' | 'parser' | 'content' | 'persistence' | 'lesson-session',
    reason: string,
    shape: Readonly<Record<string, string | number>> = {},
    reasons: readonly string[] = [reason],
  ): HttpException {
    const invalidContent = stage === 'parser' || stage === 'content';
    const code = stage === 'lesson-session' ? 'LESSON_SESSION_FAILED'
      : `LESSON_${stage.toUpperCase()}_${invalidContent ? 'INVALID' : 'FAILED'}`;
    this.lessonGenerationTrace(stage, 'FAIL', shape, reason);
    const response = {
      statusCode: invalidContent ? 422 : 503,
      message: reason === 'REMEDIATION_EXERCISE_REUSED'
        ? 'The remediation battery reused an existing or duplicate exercise.'
        : reason === 'REMEDIATION_MINIMUM_NOT_MET'
        ? 'The remediation battery must contain at least ten genuinely new exercises.'
        : invalidContent
        ? 'The teacher did not return a complete, usable lesson. Try again.'
        : 'The teacher is temporarily unavailable. Please try again shortly.',
      code, stage, reason, reasons, shape,
    };
    return invalidContent ? new UnprocessableEntityException(response) : new ServiceUnavailableException(response);
  }

  private async guardLessonPersistence<T>(
    stage: 'persistence' | 'lesson-session',
    operation: () => Promise<T>,
    traceSuccess = false,
  ): Promise<T> {
    try {
      const result = await operation();
      if (traceSuccess) this.lessonGenerationTrace(stage, 'PASS');
      return result;
    } catch (error) {
      if (error instanceof HttpException) throw error;
      throw this.lessonGenerationFailure(stage, stage === 'lesson-session'
        ? 'LESSON_SESSION_CREATE_FAILED' : 'LESSON_TRANSACTION_FAILED');
    }
  }

  /** Deterministic novelty only: this deliberately does not claim that a new
   * string is pedagogically well targeted. It rejects exact/normalised reuse
   * of prompt plus essential exercise content and duplicate generated items. */
  private requireNovelRemediationExercises(
    exercises: readonly LessonExercise[],
    baseline: readonly LessonExercise[],
  ): void {
    const previous = new Set(baseline.map((exercise) => this.languageExerciseFingerprint(exercise)));
    const generated = new Set<string>();
    for (const exercise of exercises) {
      const fingerprint = this.languageExerciseFingerprint(exercise);
      if (previous.has(fingerprint) || generated.has(fingerprint)) {
        throw this.lessonGenerationFailure('content', 'REMEDIATION_EXERCISE_REUSED', {},
          ['REMEDIATION_EXERCISE_REUSED']);
      }
      generated.add(fingerprint);
    }
    if (generated.size < LANGUAGE_REMEDIATION_MINIMUM_EXERCISES) {
      throw this.lessonGenerationFailure('content', 'REMEDIATION_MINIMUM_NOT_MET');
    }
  }

  private languageExerciseFingerprint(exercise: LessonExercise): string {
    const normalize = (value: string | undefined): string => (value ?? '')
      .normalize('NFKC')
      .toLowerCase()
      .replace(/[\p{P}\p{S}\s]+/gu, ' ')
      .trim();
    const normalizedList = (values: readonly string[] | undefined): string =>
      [...new Set((values ?? []).map((value) => normalize(value)).filter(Boolean))]
        .sort()
        .join('|');
    const canonical = [
      normalize(exercise.question),
      normalize(exercise.answer),
      normalizedList(exercise.options),
      normalizedList(exercise.tokens),
      normalize(exercise.audioText),
      normalizedList(exercise.dialogueTurns),
    ].join('\u241f');
    return createHash('sha256').update(canonical, 'utf8').digest('hex');
  }

  private nonEmptyStrings(value: unknown): string[] {
    return Array.isArray(value)
      ? value
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim())
      : [];
  }

  /** Accept only complete, known exercise shapes. Invalid QCM data is rejected
   * instead of being silently downgraded to an ungraded generic exercise. */
  private normalizeExercise(
    value: unknown,
    languageMastery = false,
    languageNotions?: readonly { notionId: string; criterionId: string }[],
  ): LessonExercise | null {
    if (!value || typeof value !== 'object') return null;
    const e = value as Record<string, unknown>;
    const types: ExerciseType[] = ['qcm', 'open', 'exercise', 'case'];
    if (!types.includes(e.type as ExerciseType)) return null;
    const type = e.type as ExerciseType;
    const question = typeof e.question === 'string' ? e.question.trim() : '';
    const answer = typeof e.answer === 'string' ? e.answer.trim() : '';
    if (!question || !answer) return null;
    const base: LessonExercise = {
      question,
      answer,
      type,
      ...(typeof e.correction === 'string' && e.correction.trim()
        ? { correction: e.correction.trim() } : {}),
    };
    if (languageMastery) {
      if (!(LANGUAGE_TRAINING_FORMATS as readonly unknown[]).includes(e.languageFormat)) return null;
      base.languageFormat = e.languageFormat as LanguageTrainingFormat;
      const strings = (candidate: unknown): string[] | undefined => {
        if (!Array.isArray(candidate)) return undefined;
        const values = [...new Set(candidate
          .filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
          .map((item) => item.trim()))];
        return values.length > 0 ? values : undefined;
      };
      const tokens = strings(e.tokens);
      const dialogueTurns = strings(e.dialogueTurns);
      const audioText = typeof e.audioText === 'string' ? e.audioText.trim() : '';
      if (base.languageFormat === 'sentence-reconstruction') {
        if (!tokens || tokens.length < 2) return null;
        base.tokens = tokens;
      }
      if (base.languageFormat === 'listening-discrimination' || base.languageFormat === 'voice-pronunciation') {
        if (!audioText) return null;
        base.audioText = audioText;
      }
      if (base.languageFormat === 'mini-dialogue') {
        if (!dialogueTurns || dialogueTurns.length < 2 || dialogueTurns.length > 3) return null;
        base.dialogueTurns = dialogueTurns;
      }
      if (base.languageFormat === 'fill-blank-no-hint' && (tokens || Array.isArray(e.options))) return null;
      if (languageNotions?.length) {
        const ids = (candidate: unknown): string[] => Array.isArray(candidate)
          ? [...new Set(candidate.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
              .map((item) => item.trim()))]
          : [];
        const notionIds = ids(e.notionIds);
        const suppliedCriterionIds = ids(e.criterionIds);
        if (notionIds.length === 0) return null;
        const allowed = new Map(languageNotions.map((item) => [item.notionId, item.criterionId]));
        if (notionIds.some((id) => !allowed.has(id))) return null;
        const expectedCriteria = new Set(notionIds.map((id) => allowed.get(id)!));
        if (
          suppliedCriterionIds.length > 0
          && (
            suppliedCriterionIds.some((id) => !expectedCriteria.has(id))
            || [...expectedCriteria].some((id) => !suppliedCriterionIds.includes(id))
          )
        ) return null;
        base.notionIds = notionIds;
        base.criterionIds = [...expectedCriteria];
      }
    }
    if (type === 'qcm') {
      if (!Array.isArray(e.options)) return null;
      const options = e.options.filter(
        (o): o is string => typeof o === 'string' && o.trim().length > 0,
      ).map((option) => option.trim());
      const uniqueOptions = [...new Set(options)];
      if (uniqueOptions.length < 3 || uniqueOptions.length > 4) return null;
      if (uniqueOptions.filter((option) => option === answer).length !== 1) return null;
      return { ...base, options: uniqueOptions };
    }
    if (languageMastery && [
      'recognition-mcq',
      'contextual-discrimination',
      'register-matching',
      'listening-discrimination',
    ].includes(base.languageFormat ?? '')) return null;
    return base;
  }

  private assemblePlainText(topic: string, l: RawLesson): string {
    const parts = [
      `# ${topic}`,
      `Objective: ${l.objective}`,
      l.intro,
      `## Explanation\n${l.explanation}`,
      l.examples.length ? `## Examples\n${l.examples.join('\n\n')}` : '',
      l.questions.length ? `## Questions\n${l.questions.join('\n')}` : '',
      l.keyPoints.length ? `## Key takeaways\n${l.keyPoints.map((p) => `- ${p}`).join('\n')}` : '',
      l.summary ? `## Summary\n${l.summary}` : '',
      l.revisionSheet ? `## Revision sheet\n${l.revisionSheet}` : '',
    ];
    return parts.filter(Boolean).join('\n\n');
  }

  /** The flashcards this lesson generated (standard-flow step 9). They are the
   *  cards created from the lesson's indexed document. */
  async flashcards(userId: string, lessonId: string): Promise<CardView[]> {
    const lesson = await this.requireOwned(userId, lessonId);
    if (!lesson.sourceDocumentId) return [];
    const cards = await this.prisma.card.findMany({
      where: { userId, sourceDocumentId: lesson.sourceDocumentId },
      orderBy: { createdAt: 'asc' },
    });
    return cards.map(toCardView);
  }

  private async requireOwned(userId: string, id: string): Promise<Lesson> {
    const lesson = await this.prisma.lesson.findUnique({ where: { id } });
    if (!lesson || lesson.userId !== userId) {
      throw new NotFoundException('Lesson not found.');
    }
    return lesson;
  }

  private toView(lesson: Lesson, cardCount: number): LessonView {
    return {
      id: lesson.id,
      topic: lesson.topic,
      objective: lesson.objective,
      intro: lesson.intro,
      explanation: lesson.explanation,
      examples: (lesson.examples as unknown as string[]) ?? [],
      questions: (lesson.questions as unknown as string[]) ?? [],
      exercises: (lesson.exercises as unknown as LessonExercise[]) ?? [],
      homework: lesson.homework,
      summary: lesson.summary,
      keyPoints: (lesson.keyPoints as unknown as string[]) ?? [],
      revisionSheet: lesson.revisionSheet,
      conceptId: lesson.conceptId,
      tutorSessionId: lesson.tutorSessionId,
      language: lesson.language,
      languageProfileId: lesson.languageProfileId,
      level: (lesson.level as LessonView['level']) ?? null,
      sourceDocumentId: lesson.sourceDocumentId,
      cardCount,
      createdAt: lesson.createdAt.toISOString(),
    };
  }
}
