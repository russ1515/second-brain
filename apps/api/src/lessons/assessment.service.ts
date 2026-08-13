import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Lesson } from '@prisma/client';
import type {
  ExerciseAttemptView,
  KnowledgeGap,
  LessonExercise,
  SubmitAttemptResponse,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { RootCauseService } from '../concepts/root-cause.service';
import { RevisionEngineService } from '../revision/revision-engine.service';

const MAX_ANSWER_CHARS = 4000;

const EXAMINER_SYSTEM = [
  'You are a real teacher correcting one exercise — never a machine that only',
  'stamps "correct" or "incorrect". Judge the learner’s UNDERSTANDING, not their',
  'wording: a differently-phrased but correct answer is correct. Award partial',
  'credit where understanding is partial. You are given the question, the model',
  'answer, and the learner’s answer. Respond with ONLY a JSON object (no markdown,',
  'no code fences) with these fields:',
  '"correct" (boolean — true only if substantially right),',
  '"score" (number 0..1),',
  '"why" (Pourquoi ? — why the answer is right or wrong, referencing the model',
  'answer; never merely restate it),',
  '"how" (Comment ? — how to reach/derive the correct answer, the reasoning),',
  '"error" (Quelle erreur ? — the specific mistake the learner made, or empty',
  'string "" if the answer was correct),',
  '"avoid" (Comment éviter ? — a concrete habit or check to avoid that mistake',
  'next time, or "" if correct),',
  '"feedback" (1-2 sentences of warm, personalised encouragement pointing to the',
  'next step). Be concrete and kind. Do not invent facts beyond the model answer.',
].join(' ');

/** The Examiner's raw, structured verdict. */
interface RawVerdict {
  correct: boolean;
  score: number;
  why: string;
  how: string;
  error: string;
  avoid: string;
  feedback: string;
}

/** The minimum an exercise needs to be marked, independent of where it lives
 *  (a lesson or a piece of homework). */
export interface MarkContext {
  topic: string;
  language: string | null;
  conceptId: string | null;
}

/**
 * The Examiner role (Educational Engine): "creates assessments, corrects,
 * explains mistakes, measures mastery, updates progress."
 *
 * Lessons already ship exercises WITH model answers; until now nothing let the
 * learner answer them, so the pedagogical flow stopped at step 8 of 16. This
 * closes steps 9-11 (assessment → detailed correction → personalised feedback)
 * and, on a mistake, triggers the spec's knowledge-gap root-cause analysis.
 *
 * It deliberately does NOT touch the mastery formula: mastery stays derived from
 * FSRS review state. The Examiner records and diagnoses; the twin's arithmetic
 * is unchanged.
 */
@Injectable()
export class AssessmentService {
  private readonly logger = new Logger(AssessmentService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly rootCause: RootCauseService,
    private readonly revision: RevisionEngineService,
  ) {}

  async submit(
    userId: string,
    lessonId: string,
    exerciseIndex: number,
    answer: string,
  ): Promise<SubmitAttemptResponse> {
    const lesson = await this.requireOwnedLesson(userId, lessonId);
    const exercise = this.exerciseAt(lesson, exerciseIndex);

    const ctx: MarkContext = {
      topic: lesson.topic,
      language: lesson.language,
      conceptId: lesson.conceptId,
    };
    const verdict = await this.mark(ctx, exercise, answer);

    // Knowledge-gap detection: a wrong answer is a symptom, not the disease.
    const gap =
      !verdict.correct && lesson.conceptId
        ? await this.rootCause
            .findFor(userId, lesson.conceptId)
            .catch(() => null) // diagnosis is a bonus; never fail the marking
        : null;

    const attempt = await this.prisma.exerciseAttempt.create({
      data: {
        userId,
        lessonId,
        exerciseIndex,
        question: exercise.question,
        expectedAnswer: exercise.answer,
        learnerAnswer: answer.slice(0, MAX_ANSWER_CHARS),
        correct: verdict.correct,
        score: verdict.score,
        // `correction` stays populated (the composed why+how) for the indexed
        // record and any older reader; the four structured fields drive the UI.
        correction: this.composeCorrection(verdict),
        feedback: verdict.feedback,
        why: verdict.why,
        how: verdict.how,
        errorMade: verdict.error || null,
        howToAvoid: verdict.avoid || null,
        conceptId: lesson.conceptId,
        rootCauseConceptId: gap?.conceptId ?? null,
      },
    });

    // Feed the FSRS Revision Engine: an exercise is a reviewable activity, and
    // its score drives the grade (task 5.1). Best-effort — never blocks marking.
    await this.revision.gradeActivity(
      userId,
      'exercise',
      `${lessonId}:${exerciseIndex}`,
      exercise.question,
      { score: verdict.score },
    );

    return { attempt: this.toView(attempt), rootCause: gap };
  }

  /** Every attempt on a lesson, newest first — the learner's exam history. */
  async history(
    userId: string,
    lessonId: string,
  ): Promise<ExerciseAttemptView[]> {
    await this.requireOwnedLesson(userId, lessonId);
    const attempts = await this.prisma.exerciseAttempt.findMany({
      where: { userId, lessonId },
      orderBy: { createdAt: 'desc' },
    });
    return attempts.map((a) => this.toView(a));
  }

  /**
   * Mark one exercise WITHOUT persisting an attempt — used by the Homework
   * Engine, where practice is ephemeral (the Digital Twin is driven by FSRS
   * reviews, not by attempt records, so nothing is lost by not storing these).
   * Reuses the exact same Examiner and root-cause diagnosis as lesson marking.
   */
  async gradeEphemeral(
    userId: string,
    ctx: MarkContext,
    exercise: LessonExercise,
    exerciseIndex: number,
    answer: string,
  ): Promise<SubmitAttemptResponse> {
    const verdict = await this.mark(ctx, exercise, answer);
    const gap =
      !verdict.correct && ctx.conceptId
        ? await this.rootCause.findFor(userId, ctx.conceptId).catch(() => null)
        : null;

    const attempt: ExerciseAttemptView = {
      id: 'ephemeral',
      lessonId: '',
      exerciseIndex,
      question: exercise.question,
      expectedAnswer: exercise.answer,
      learnerAnswer: answer.slice(0, MAX_ANSWER_CHARS),
      correct: verdict.correct,
      score: verdict.score,
      correction: this.composeCorrection(verdict),
      feedback: verdict.feedback,
      why: verdict.why,
      how: verdict.how,
      errorMade: verdict.error || null,
      howToAvoid: verdict.avoid || null,
      conceptId: ctx.conceptId,
      createdAt: new Date().toISOString(),
    };
    return { attempt, rootCause: gap };
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async requireOwnedLesson(
    userId: string,
    lessonId: string,
  ): Promise<Lesson> {
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: lessonId },
    });
    if (!lesson || lesson.userId !== userId) {
      throw new NotFoundException('Lesson not found.');
    }
    return lesson;
  }

  private exerciseAt(lesson: Lesson, index: number): LessonExercise {
    const exercises = (lesson.exercises as unknown as LessonExercise[]) ?? [];
    const exercise = exercises[index];
    if (!exercise) {
      throw new NotFoundException(
        `This lesson has no exercise at index ${index} (it has ${exercises.length}).`,
      );
    }
    return exercise;
  }

  private async mark(
    ctx: MarkContext,
    exercise: LessonExercise,
    answer: string,
  ): Promise<RawVerdict> {
    const language = ctx.language
      ? ` This is a ${ctx.language} language exercise; mark the ${ctx.language} too.`
      : '';
    let text: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: EXAMINER_SYSTEM + language },
          {
            role: 'user',
            content:
              `Topic: ${ctx.topic}\n\n` +
              `Question: ${exercise.question}\n\n` +
              `Model answer: ${exercise.answer}\n\n` +
              `Learner's answer: ${answer}`,
          },
        ],
        // Marking should be reproducible, not creative.
        { temperature: 0.1 },
      );
      text = result.text;
    } catch (error) {
      this.logger.error(`Examiner LLM call failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The examiner is temporarily unavailable. Please try again shortly.',
      );
    }
    return this.parse(text);
  }

  /**
   * Parse the verdict, tolerating fences/prose.
   *
   * An unparseable verdict must NOT silently become "wrong" — that would tell a
   * learner they failed when the model merely misbehaved. Fall back to the one
   * honest signal we have: refuse to grade.
   */
  private parse(raw: string): RawVerdict {
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
    const why = str(parsed.why);
    // A verdict with no boolean and no explanation is the model misbehaving —
    // do NOT silently tell the learner they failed. Refuse to grade.
    if (typeof parsed.correct !== 'boolean' || !why) {
      throw new ServiceUnavailableException(
        'The examiner did not return a usable verdict. Your answer was not recorded — please try again.',
      );
    }

    const rawScore = typeof parsed.score === 'number' ? parsed.score : parsed.correct ? 1 : 0;
    const how = str(parsed.how);
    return {
      correct: parsed.correct,
      score: Math.max(0, Math.min(1, rawScore)),
      why,
      how,
      error: str(parsed.error),
      avoid: str(parsed.avoid),
      feedback: str(parsed.feedback) || how || why,
    };
  }

  /** A single-string correction kept for storage/back-compat, composed from the
   *  structured parts so nothing is lost for readers that only know `correction`. */
  private composeCorrection(v: RawVerdict): string {
    return [
      v.why,
      v.how,
      v.error ? `Mistake: ${v.error}` : '',
      v.avoid ? `To avoid it: ${v.avoid}` : '',
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  private toView(attempt: {
    id: string;
    lessonId: string;
    exerciseIndex: number;
    question: string;
    expectedAnswer: string;
    learnerAnswer: string;
    correct: boolean;
    score: number;
    correction: string;
    feedback: string;
    why: string | null;
    how: string | null;
    errorMade: string | null;
    howToAvoid: string | null;
    conceptId: string | null;
    createdAt: Date;
  }): ExerciseAttemptView {
    return {
      id: attempt.id,
      lessonId: attempt.lessonId,
      exerciseIndex: attempt.exerciseIndex,
      question: attempt.question,
      expectedAnswer: attempt.expectedAnswer,
      learnerAnswer: attempt.learnerAnswer,
      correct: attempt.correct,
      score: attempt.score,
      correction: attempt.correction,
      feedback: attempt.feedback,
      // Older attempts (pre-structured) fall back to the composite correction.
      why: attempt.why ?? attempt.correction,
      how: attempt.how ?? '',
      errorMade: attempt.errorMade,
      howToAvoid: attempt.howToAvoid,
      conceptId: attempt.conceptId,
      createdAt: attempt.createdAt.toISOString(),
    };
  }
}
