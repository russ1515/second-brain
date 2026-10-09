import {
  BadRequestException,
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

const CONTEXT_LIMIT = 5;

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

/**
 * Steering supplied by other services (not by API clients).
 *
 * Deliberately NOT part of GenerateLessonDto: `directive` is injected into the
 * system prompt, so exposing it on the public endpoint would hand callers a
 * prompt-steering knob for no product reason.
 */
export interface InternalLessonOptions {
  /** Language profile this lesson belongs to (language engine). */
  languageProfileId?: string;
  /** Extra teaching directive appended to the system prompt (e.g. the language
   *  mode's pedagogical contract). */
  directive?: string;
  /** Server-only switch for the language mastery exercise contract. */
  languageMastery?: boolean;
  /** Exact failed battery used only to reject duplicate remediation items
   * before the generated lesson is persisted. */
  remediationBaselineExercises?: readonly LessonExercise[];
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

    // Ground the lesson in the learner's existing notes when available.
    const context = await this.retrieveContext(userId, topic);
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
    const raw = await this.generateLesson(
      topic,
      context,
      { ...dto, level },
      trustedDirective,
      internal.languageMastery === true,
      internal.remediationBaselineExercises,
    );

    const { lesson, doc, experience } = await this.prisma.$transaction(async (tx) => {
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
      const createdLesson = await tx.lesson.create({
        data: {
        userId,
        tutorSessionId: tutorSessionId ?? null,
        conceptId: conceptId ?? null,
        languageProfileId: internal.languageProfileId ?? null,
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
      });

      // Freeze the effective policy with the lesson. Corrections later in this
      // lesson must not silently change because Profile preferences were edited.
      const initialFlow = this.initialFlow(this.toView(createdLesson, 0));
      const createdExperience = await this.experienceSessions.ensureLessonSession(userId, {
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
        resumeTarget: { kind: 'route', path: `/lesson/${createdLesson.id}` },
        links: { lessonId: createdLesson.id },
      }, tx);

      // Keep the source document in the same owner-locked transaction as the
      // lesson and its experience wrapper. A concurrent permanent purge can
      // therefore observe either the whole graph or none of it, never an
      // orphan LESSON_AI document created after its lesson was removed.
      const createdDoc = await this.documents.createFromTextInTransaction(userId, {
        title: `Lesson — ${topic}`.slice(0, 300),
        content: this.assemblePlainText(topic, raw),
        sourceRef: `lesson:${createdLesson.id}`,
        contentType: 'LESSON_AI',
      }, tx);
      const linkedLesson = await tx.lesson.update({
        where: { id: createdLesson.id },
        data: { sourceDocumentId: createdDoc.id },
      });
      return { lesson: linkedLesson, doc: createdDoc, experience: createdExperience };
    });

    // Workers must only see the generated document after its transaction has
    // committed. Their own durable status/error handling remains unchanged.
    this.documents.queuePostCreateProcessing(doc.id);

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
    if (conceptId) {
      await this.concepts
        .linkDocument(userId, conceptId, doc.id)
        .catch((e) => this.logger.warn('Learning operation failed.'));
    }

    return this.toView({ ...lesson, sourceDocumentId: doc.id }, cardCount);
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
  ): Promise<RawLesson> {
    const level = dto.level ? ` Pitch it at a ${dto.level} level.` : '';
    const language = dto.language
      ? ` This is a ${dto.language} language lesson; teach ${dto.language}.`
      : '';
    const baseSystem = languageMastery
      ? `${SYSTEM_PROMPT} ${LANGUAGE_MASTERY_EXERCISE_PROMPT}`
      : SYSTEM_PROMPT;
    const system = directive ? `${baseSystem} ${directive}` : baseSystem;
    let text: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              `Create a complete written lesson on: "${topic}".${level}${language}` +
              (context ? `\n\nGround it in my notes where relevant:\n${context}` : ''),
          },
        ],
        { temperature: 0.4, operation: 'lesson' },
      );
      text = result.text;
    } catch (error) {
      this.logger.error('Learning operation failed.');
      throw new ServiceUnavailableException(
        'The teacher is temporarily unavailable. Please try again shortly.',
      );
    }
    return this.parseLesson(text, languageMastery, remediationBaselineExercises);
  }

  private parseLesson(
    raw: string,
    languageMastery = false,
    remediationBaselineExercises?: readonly LessonExercise[],
  ): RawLesson {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    let parsed: Record<string, unknown> = {};
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } catch {
        parsed = {};
      }
    }
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
    const exercises = Array.isArray(parsed.exercises)
      ? parsed.exercises
          .map((exercise) => this.normalizeExercise(exercise, languageMastery))
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
    const structurallyComplete =
      Boolean(objective && intro && explanation && summary && revisionSheet) &&
      examples.length >= 1 &&
      commonMisconceptions.length >= 1 &&
      questions.length >= 3 && questions.length <= 5 &&
      (languageMastery ? languageExerciseContract : genericExerciseContract) &&
      keyPoints.length >= 3 && keyPoints.length <= 5;
    if (!structurallyComplete) {
      throw new UnprocessableEntityException(
        'The teacher did not return a complete, usable lesson. Try again.',
      );
    }
    if (languageMastery && remediationBaselineExercises) {
      this.requireNovelRemediationExercises(exercises, remediationBaselineExercises);
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
        throw new UnprocessableEntityException(
          'The remediation battery reused an existing or duplicate exercise.',
        );
      }
      generated.add(fingerprint);
    }
    if (generated.size < LANGUAGE_REMEDIATION_MINIMUM_EXERCISES) {
      throw new UnprocessableEntityException(
        'The remediation battery must contain at least ten genuinely new exercises.',
      );
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
  private normalizeExercise(value: unknown, languageMastery = false): LessonExercise | null {
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
