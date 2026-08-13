import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Homework, Lesson, Prisma } from '@prisma/client';
import type {
  ExerciseType,
  HomeworkView,
  LessonExercise,
  SubmitAttemptResponse,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { MasteryService } from '../concepts/mastery.service';
import { RetrievalService } from '../documents/retrieval/retrieval.service';
import { AssessmentService, type MarkContext } from '../lessons/assessment.service';

const CONTEXT_LIMIT = 5;
const MAX_ANSWER_CHARS = 4000;

const SYSTEM_PROMPT = [
  'You are a teacher setting PERSONALISED homework after a lesson — not a generic',
  'worksheet. You are told the learner\'s current mastery of the topic. ADAPT:',
  'if they are weak, drill the fundamentals with scaffolded, confidence-building',
  'items; if they are strong, stretch them with harder application and edge cases.',
  'When passages from the learner\'s own notes are provided, ground the homework',
  'in them so it revisits what they actually studied. Respond with ONLY a JSON',
  'object (no markdown, no code fences) with these fields:',
  '"focus" (1-2 sentences, addressed to the learner, saying what this homework',
  'targets and WHY, referencing their level),',
  '"exercises" (a MIX of 3-5 items, each {"type","question","answer","options"?}:',
  'include at least one "qcm" (give an "options" array of 3-4 and set "answer" to',
  'the exact correct option), and a spread of "open", "exercise" and "case"; for',
  'every item "answer" is the model answer used as the correction),',
  '"questions" (2-3 reflective, open-ended questions to think through, not graded).',
].join(' ');

/** Homework Engine: after a lesson, generates homework calibrated to the
 *  learner's Digital Twin (ConceptMastery) and grounded in their Learning
 *  Memory (retrieval). Exercises are corrected by the same Examiner as lessons. */
@Injectable()
export class HomeworkService {
  private readonly logger = new Logger(HomeworkService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly mastery: MasteryService,
    private readonly retrieval: RetrievalService,
    private readonly assessment: AssessmentService,
  ) {}

  /** The homework for a lesson, generating it lazily on first request. This is
   *  how "homework after every lesson" is fulfilled without slowing lesson
   *  creation or coupling the two services. */
  async forLesson(userId: string, lessonId: string): Promise<HomeworkView> {
    const lesson = await this.requireOwnedLesson(userId, lessonId);
    const existing = await this.prisma.homework.findUnique({
      where: { lessonId },
    });
    if (existing) return this.toView(existing, lesson);
    return this.generate(userId, lesson);
  }

  /** Force a fresh, re-adapted homework (the learner's mastery may have moved). */
  async regenerate(userId: string, lessonId: string): Promise<HomeworkView> {
    const lesson = await this.requireOwnedLesson(userId, lessonId);
    return this.generate(userId, lesson);
  }

  /** Mark one homework exercise — reuses the lesson Examiner, ephemerally. */
  async submitAttempt(
    userId: string,
    homeworkId: string,
    exerciseIndex: number,
    answer: string,
  ): Promise<SubmitAttemptResponse> {
    const homework = await this.prisma.homework.findUnique({
      where: { id: homeworkId },
    });
    if (!homework || homework.userId !== userId) {
      throw new NotFoundException('Homework not found.');
    }
    const exercises = (homework.exercises as unknown as LessonExercise[]) ?? [];
    const exercise = exercises[exerciseIndex];
    if (!exercise) {
      throw new NotFoundException(
        `This homework has no exercise at index ${exerciseIndex} (it has ${exercises.length}).`,
      );
    }
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: homework.lessonId },
    });
    const ctx: MarkContext = {
      topic: lesson?.topic ?? 'Homework',
      language: homework.language,
      conceptId: homework.conceptId,
    };
    return this.assessment.gradeEphemeral(
      userId,
      ctx,
      exercise,
      exerciseIndex,
      answer.slice(0, MAX_ANSWER_CHARS),
    );
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async generate(userId: string, lesson: Lesson): Promise<HomeworkView> {
    // Digital Twin: how well does the learner actually grasp this concept?
    const mastery = lesson.conceptId
      ? await this.mastery
          .conceptMastery(userId, lesson.conceptId)
          .catch(() => null)
      : null;
    const masteryValue = mastery?.mastery ?? null;
    const levelLine = mastery
      ? `The learner's mastery of "${mastery.name}" is ${mastery.level}` +
        (masteryValue !== null ? ` (${Math.round(masteryValue * 100)}%).` : ' (not yet assessed).')
      : 'The learner has no tracked mastery for this topic yet — assume a beginner.';

    // Learning Memory: ground the homework in what they studied.
    const notes = await this.retrieveContext(userId, lesson.topic);
    const notesBlock = notes ? `\n\nFrom the learner's notes:\n${notes}` : '';

    const languageLine = lesson.language
      ? ` Write the homework in ${lesson.language}.`
      : '';

    let raw: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: SYSTEM_PROMPT + languageLine },
          {
            role: 'user',
            content:
              `Lesson topic: ${lesson.topic}\n` +
              `Objective: ${lesson.objective}\n` +
              `${levelLine}${notesBlock}`,
          },
        ],
        { temperature: 0.5 },
      );
      raw = result.text;
    } catch (error) {
      this.logger.error(`Homework LLM call failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The homework engine is temporarily unavailable. Please try again shortly.',
      );
    }

    const parsed = this.parse(raw);
    const saved = await this.prisma.homework.upsert({
      where: { lessonId: lesson.id },
      create: {
        userId,
        lessonId: lesson.id,
        conceptId: lesson.conceptId,
        language: lesson.language,
        focus: parsed.focus,
        exercises: parsed.exercises as unknown as Prisma.InputJsonValue,
        questions: parsed.questions as unknown as Prisma.InputJsonValue,
        masteryAtGeneration: masteryValue,
      },
      update: {
        focus: parsed.focus,
        exercises: parsed.exercises as unknown as Prisma.InputJsonValue,
        questions: parsed.questions as unknown as Prisma.InputJsonValue,
        masteryAtGeneration: masteryValue,
      },
    });
    return this.toView(saved, lesson);
  }

  private async retrieveContext(userId: string, topic: string): Promise<string> {
    try {
      const { results } = await this.retrieval.search(userId, topic, {
        limit: CONTEXT_LIMIT,
      });
      return results
        .map((r, i) => `[${i + 1}] (from "${r.documentTitle}")\n${r.content}`)
        .join('\n\n');
    } catch (error) {
      // Grounding is an enhancement, never a precondition.
      this.logger.warn(
        `Homework grounding failed; generating ungrounded: ${(error as Error).message}`,
      );
      return '';
    }
  }

  private parse(raw: string): {
    focus: string;
    exercises: LessonExercise[];
    questions: string[];
  } {
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

    const exercises = Array.isArray(parsed.exercises)
      ? parsed.exercises
          .filter(
            (e): e is LessonExercise =>
              !!e &&
              typeof (e as LessonExercise).question === 'string' &&
              typeof (e as LessonExercise).answer === 'string',
          )
          .map((e) => this.normalizeExercise(e))
      : [];
    if (exercises.length === 0) {
      throw new UnprocessableEntityException(
        'The homework engine did not return usable exercises. Try again.',
      );
    }
    const questions = Array.isArray(parsed.questions)
      ? parsed.questions
          .filter((q): q is string => typeof q === 'string' && q.trim().length > 0)
          .map((q) => q.trim())
      : [];

    return { focus: str(parsed.focus), exercises, questions };
  }

  /** Keep only known exercise types and valid QCM options. */
  private normalizeExercise(e: LessonExercise): LessonExercise {
    const types: ExerciseType[] = ['qcm', 'open', 'exercise', 'case'];
    const type = types.includes(e.type as ExerciseType) ? e.type : 'exercise';
    const base: LessonExercise = { question: e.question, answer: e.answer, type };
    if (type === 'qcm' && Array.isArray(e.options)) {
      const options = e.options.filter((o): o is string => typeof o === 'string');
      if (options.length >= 2) base.options = options;
    }
    return base;
  }

  private async requireOwnedLesson(userId: string, lessonId: string): Promise<Lesson> {
    const lesson = await this.prisma.lesson.findUnique({ where: { id: lessonId } });
    if (!lesson || lesson.userId !== userId) {
      throw new NotFoundException('Lesson not found.');
    }
    return lesson;
  }

  private toView(homework: Homework, lesson: Lesson): HomeworkView {
    return {
      id: homework.id,
      lessonId: homework.lessonId,
      topic: lesson.topic,
      conceptId: homework.conceptId,
      language: homework.language,
      focus: homework.focus,
      exercises: (homework.exercises as unknown as LessonExercise[]) ?? [],
      questions: (homework.questions as unknown as string[]) ?? [],
      masteryAtGeneration:
        homework.masteryAtGeneration !== null &&
        homework.masteryAtGeneration !== undefined
          ? Math.round(homework.masteryAtGeneration * 100)
          : null,
      createdAt: homework.createdAt.toISOString(),
    };
  }
}
