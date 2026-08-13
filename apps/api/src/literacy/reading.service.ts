import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { ReadingExercise } from '@prisma/client';
import type {
  GenerateReadingRequest,
  GradedAnswer,
  LevelChange,
  QuestionFormat,
  ReadingExerciseSummary,
  ReadingExerciseView,
  ReadingLevel,
  ReadingQuestionView,
  ReadingResultView,
} from '@second-brain/shared';
import { READING_LEVELS } from '@second-brain/shared';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { localeDirective, resolveLocale } from '../common/learning-locale';
import { parseJsonObject } from './json';

interface StoredQuestion {
  id: string;
  prompt: string;
  format: QuestionFormat;
  options?: string[];
  points: number;
  answerKey: string;
  rubric: string;
}

const READING_PERSONA =
  'You are a reading comprehension coach. You write engaging, level-appropriate ' +
  'passages and fair comprehension questions, and you mark answers honestly, ' +
  'always explaining. Reply in the learner\'s language.';

const DEFAULT_LEVEL: ReadingLevel = 'intermediate';

@Injectable()
export class ReadingService {
  private readonly logger = new Logger(ReadingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  /** The learner's current auto-tracked level: whatever the last exercise
   *  adapted to, else the level it was set at, else the default. */
  async currentLevel(userId: string): Promise<ReadingLevel> {
    const last = await this.prisma.readingExercise.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    if (!last) return DEFAULT_LEVEL;
    return this.asLevel(last.adaptedLevel ?? last.level);
  }

  async generate(
    userId: string,
    dto: GenerateReadingRequest,
  ): Promise<ReadingExerciseView> {
    const level = dto.level ?? (await this.currentLevel(userId));
    const locale = await resolveLocale(this.prisma, userId);
    const { title, text, questions } = await this.compose(level, dto.topic, locale);
    if (!text || questions.length === 0) {
      throw new ServiceUnavailableException(
        'The reading coach could not draft that passage. Please try again.',
      );
    }

    const exercise = await this.prisma.readingExercise.create({
      data: {
        userId,
        level,
        topic: dto.topic?.trim() || null,
        title,
        text,
        questions: questions as unknown as object,
      },
    });
    return this.toView(exercise);
  }

  async list(userId: string): Promise<ReadingExerciseSummary[]> {
    const rows = await this.prisma.readingExercise.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((e) => ({
      id: e.id,
      level: this.asLevel(e.level),
      title: e.title,
      topic: e.topic,
      score: e.score,
      createdAt: e.createdAt.toISOString(),
    }));
  }

  async get(userId: string, id: string): Promise<ReadingExerciseView> {
    return this.toView(await this.requireOwned(userId, id));
  }

  async submit(
    userId: string,
    id: string,
    answers: string[],
  ): Promise<ReadingResultView> {
    const exercise = await this.requireOwned(userId, id);
    const questions = exercise.questions as unknown as StoredQuestion[];
    const previousLevel = this.asLevel(exercise.level);

    const locale = await resolveLocale(this.prisma, userId);
    const { score, results, summary } = await this.evaluate(questions, answers, locale);
    const newLevel = this.adapt(previousLevel, score);
    const levelChange: LevelChange =
      newLevel === previousLevel
        ? 'same'
        : READING_LEVELS.indexOf(newLevel) > READING_LEVELS.indexOf(previousLevel)
          ? 'up'
          : 'down';

    const result: ReadingResultView = {
      score,
      results,
      summary,
      previousLevel,
      newLevel,
      levelChange,
    };

    await this.prisma.readingExercise.update({
      where: { id },
      data: {
        score,
        adaptedLevel: newLevel,
        result: result as unknown as object,
      },
    });
    return result;
  }

  async requireOwned(userId: string, id: string): Promise<ReadingExercise> {
    const exercise = await this.prisma.readingExercise.findUnique({ where: { id } });
    if (!exercise || exercise.userId !== userId) {
      throw new NotFoundException('Reading exercise not found.');
    }
    return exercise;
  }

  // ── generation ───────────────────────────────────────────────────────────

  private async compose(
    level: ReadingLevel,
    topic: string | undefined,
    locale: string,
  ): Promise<{ title: string; text: string; questions: StoredQuestion[] }> {
    const about = topic?.trim() ? ` about "${topic.trim()}"` : ' on an interesting topic';
    const user = [
      `Write a ${level}-level reading passage${about} (a few paragraphs, pitched`,
      'precisely to that reading level), then 4-5 comprehension questions mixing',
      '"mcq" (4 options, answerKey = the correct option text) and "open" formats.',
      'For each question give points, an answerKey and a rubric.',
      'Return ONLY JSON: {"title": string, "text": string, "questions":',
      '[{"prompt": string, "format": "mcq"|"open", "options": string[] (mcq only),',
      '"points": number, "answerKey": string, "rubric": string}]}.',
      localeDirective(locale),
    ].join(' ');

    let raw: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: READING_PERSONA },
          { role: 'user', content: user },
        ],
        { temperature: 0.6 },
      );
      raw = result.text;
    } catch (error) {
      this.logger.error(`Reading generation failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The reading coach is temporarily unavailable. Please try again shortly.',
      );
    }

    const d = parseJsonObject(raw);
    if (!d) return { title: '', text: '', questions: [] };
    const rawQs = Array.isArray(d.questions) ? d.questions : [];
    const questions = rawQs
      .filter((q): q is Record<string, unknown> => typeof q === 'object' && q !== null)
      .map((q) => {
        const format: QuestionFormat = q.format === 'mcq' ? 'mcq' : 'open';
        return {
          id: randomUUID(),
          prompt: typeof q.prompt === 'string' ? q.prompt.trim() : '',
          format,
          options:
            format === 'mcq' && Array.isArray(q.options)
              ? q.options.map((o) => String(o)).filter(Boolean)
              : undefined,
          points: typeof q.points === 'number' && q.points > 0 ? Math.round(q.points) : 1,
          answerKey: typeof q.answerKey === 'string' ? q.answerKey.trim() : '',
          rubric: typeof q.rubric === 'string' ? q.rubric.trim() : '',
        } satisfies StoredQuestion;
      })
      .filter((q) => q.prompt && (q.format === 'open' || (q.options?.length ?? 0) >= 2));

    return {
      title: typeof d.title === 'string' ? d.title.trim() : 'Reading passage',
      text: typeof d.text === 'string' ? d.text.trim() : '',
      questions,
    };
  }

  // ── evaluation ─────────────────────────────────────────────────────────

  private async evaluate(
    questions: StoredQuestion[],
    answers: string[],
    locale: string,
  ): Promise<{ score: number; results: GradedAnswer[]; summary: string }> {
    const maxTotal = questions.reduce((s, q) => s + q.points, 0) || 1;
    const items = questions.map((q, i) => ({
      id: q.id,
      prompt: q.prompt,
      format: q.format,
      options: q.options,
      points: q.points,
      answerKey: q.answerKey,
      rubric: q.rubric,
      learnerAnswer: (answers[i] ?? '').trim(),
    }));

    const user = [
      'Mark these reading-comprehension answers. You are given each question, its',
      'answer key and rubric, and the learner\'s answer. Award marks with partial',
      'credit. For EACH question return "why" (why it is/is not right), "how" (how',
      'to reach the right answer), "errorMade" (the specific mistake or null) and',
      '"howToAvoid" (or null), plus "verdict" ("correct"|"partial"|"incorrect").',
      'Also give an overall "summary".',
      'Questions and answers (JSON):',
      JSON.stringify(items),
      'Return ONLY JSON: {"results":[{"questionId": string, "awarded": number,',
      '"verdict": string, "why": string, "how": string, "errorMade": string|null,',
      '"howToAvoid": string|null}], "summary": string}.',
      localeDirective(locale),
    ].join(' ');

    let raw: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: READING_PERSONA },
          { role: 'user', content: user },
        ],
        { temperature: 0.2 },
      );
      raw = result.text;
    } catch (error) {
      this.logger.error(`Reading evaluation failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'Could not mark those answers. Please try again shortly.',
      );
    }

    const d = parseJsonObject(raw);
    const rawResults = d && Array.isArray(d.results) ? d.results : [];
    const byId = new Map<string, Record<string, unknown>>();
    for (const r of rawResults) {
      if (typeof r === 'object' && r !== null && 'questionId' in r) {
        byId.set(String((r as Record<string, unknown>).questionId), r as Record<string, unknown>);
      }
    }

    const verdicts = ['correct', 'partial', 'incorrect'] as const;
    const results: GradedAnswer[] = questions.map((q, i) => {
      const r = byId.get(q.id) ?? {};
      const verdict = verdicts.includes(r.verdict as (typeof verdicts)[number])
        ? (r.verdict as GradedAnswer['verdict'])
        : 'incorrect';
      let awarded =
        typeof r.awarded === 'number' ? r.awarded : verdict === 'correct' ? q.points : 0;
      awarded = Math.max(0, Math.min(q.points, awarded));
      return {
        questionId: q.id,
        prompt: q.prompt,
        learnerAnswer: (answers[i] ?? '').trim(),
        awarded,
        max: q.points,
        verdict,
        why: typeof r.why === 'string' ? r.why.trim() : '',
        how: typeof r.how === 'string' ? r.how.trim() : '',
        errorMade:
          typeof r.errorMade === 'string' && r.errorMade.trim() ? r.errorMade.trim() : null,
        howToAvoid:
          typeof r.howToAvoid === 'string' && r.howToAvoid.trim() ? r.howToAvoid.trim() : null,
      };
    });

    const awardedTotal = results.reduce((s, r) => s + r.awarded, 0);
    const score = Math.round((awardedTotal / maxTotal) * 100);
    return {
      score,
      results,
      summary: d && typeof d.summary === 'string' ? d.summary.trim() : '',
    };
  }

  /** Auto-adapt: strong performance moves up a level, weak moves down. */
  private adapt(level: ReadingLevel, score: number): ReadingLevel {
    const i = READING_LEVELS.indexOf(level);
    if (score >= 80 && i < READING_LEVELS.length - 1) return READING_LEVELS[i + 1];
    if (score < 50 && i > 0) return READING_LEVELS[i - 1];
    return level;
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private asLevel(v: string | null): ReadingLevel {
    return READING_LEVELS.includes(v as ReadingLevel)
      ? (v as ReadingLevel)
      : DEFAULT_LEVEL;
  }

  private toView(e: ReadingExercise): ReadingExerciseView {
    const stored = e.questions as unknown as StoredQuestion[];
    return {
      id: e.id,
      level: this.asLevel(e.level),
      topic: e.topic,
      title: e.title,
      text: e.text,
      questions: (Array.isArray(stored) ? stored : []).map(
        (q): ReadingQuestionView => ({
          id: q.id,
          prompt: q.prompt,
          format: q.format,
          options: q.options,
          points: q.points,
        }),
      ),
      createdAt: e.createdAt.toISOString(),
      latestResult: e.result ? (e.result as unknown as ReadingResultView) : null,
    };
  }
}
