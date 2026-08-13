import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Assessment, AssessmentSubmission } from '@prisma/client';
import type {
  AssessmentDifficulty,
  AssessmentSubmissionView,
  AssessmentSummary,
  AssessmentType,
  AssessmentView,
  CreateAssessmentRequest,
  GradedAnswer,
  QuestionFormat,
} from '@second-brain/shared';
import { randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { localeDirective, resolveLocale } from '../common/learning-locale';

/** A question as stored — carries the answer key/rubric used for grounded
 *  grading. The key is NEVER sent to a client (see toQuestionView). */
interface StoredQuestion {
  id: string;
  prompt: string;
  format: QuestionFormat;
  options?: string[];
  points: number;
  /** Correct answer (mcq/exercise) or model answer (open). */
  answerKey: string;
  /** What a good answer must contain — the marking rubric. */
  rubric: string;
}

const EXAMINER_PERSONA =
  'You are an experienced, fair examiner AND teacher. You write clear, valid ' +
  'assessments and mark them honestly. Your feedback is never a bare grade: ' +
  'every mistake is turned into a learning opportunity. Explanations are warm ' +
  'but precise.';

/** Per-type generation guidance + sensible default question counts. */
const TYPE_BRIEF: Record<
  AssessmentType,
  { guidance: string; defaultCount: number; fixedCount?: number }
> = {
  mcq: {
    guidance:
      'Write multiple-choice questions. Each has exactly 4 plausible options ' +
      '(format "mcq", options array of 4). Exactly one is correct; put the ' +
      'correct option text in answerKey. Distractors must be tempting, not silly.',
    defaultCount: 5,
  },
  open: {
    guidance:
      'Write short open questions (format "open") that require a few sentences. ' +
      'answerKey holds a model answer; rubric lists the points a full answer needs.',
    defaultCount: 3,
  },
  dissertation: {
    guidance:
      'Write ONE essay/dissertation prompt (format "open") inviting a structured ' +
      'argument. rubric describes what a strong essay must do (thesis, evidence, ' +
      'structure, conclusion); answerKey sketches a model outline.',
    defaultCount: 1,
    fixedCount: 1,
  },
  exercise: {
    guidance:
      'Write practical exercises/problems to solve (format "open"). answerKey ' +
      'holds the worked solution; rubric lists the steps that earn marks.',
    defaultCount: 4,
  },
  case_study: {
    guidance:
      'Write ONE realistic case study: a scenario paragraph followed by 3-4 ' +
      'analysis sub-questions. Put the scenario at the top of the first prompt. ' +
      'Each question format "open"; rubric lists what the analysis must cover.',
    defaultCount: 4,
  },
  mock_exam: {
    guidance:
      'Write a MIXED mock exam: a blend of "mcq" (4 options, answerKey = correct ' +
      'option) and "open" questions, ordered easiest-first, with varied points. ' +
      'It should feel like a real paper.',
    defaultCount: 6,
  },
  oral: {
    guidance:
      'Write oral-evaluation prompts (format "open") the learner would ANSWER ' +
      'ALOUD — conversational, probing questions. rubric lists what a confident ' +
      'spoken answer covers. (Answers are submitted as text/transcript here.)',
    defaultCount: 4,
  },
};

@Injectable()
export class ExaminerService {
  private readonly logger = new Logger(ExaminerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async create(
    userId: string,
    dto: CreateAssessmentRequest,
  ): Promise<AssessmentView> {
    const type = dto.type;
    const topic = dto.topic.trim();
    const difficulty: AssessmentDifficulty = dto.difficulty ?? 'intermediate';
    const brief = TYPE_BRIEF[type];
    const count =
      brief.fixedCount ??
      Math.min(20, Math.max(1, dto.questionCount ?? brief.defaultCount));

    const locale = await resolveLocale(this.prisma, userId);
    const questions = await this.generate(type, topic, difficulty, count, brief, locale);
    if (questions.length === 0) {
      throw new ServiceUnavailableException(
        'The examiner could not draft that assessment. Please try again.',
      );
    }

    const assessment = await this.prisma.assessment.create({
      data: {
        userId,
        type,
        topic,
        title: this.titleFor(type, topic),
        level: difficulty,
        conceptId: dto.conceptId ?? null,
        questions: questions as unknown as object,
      },
    });
    return this.toView(assessment, null);
  }

  async list(userId: string): Promise<AssessmentSummary[]> {
    const rows = await this.prisma.assessment.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        submissions: { orderBy: { createdAt: 'desc' }, take: 1 },
      },
    });
    return rows.map((a) => {
      const qs = a.questions as unknown as StoredQuestion[];
      return {
        id: a.id,
        type: a.type as AssessmentType,
        topic: a.topic,
        title: a.title,
        questionCount: Array.isArray(qs) ? qs.length : 0,
        createdAt: a.createdAt.toISOString(),
        score: a.submissions[0] ? a.submissions[0].score : null,
      };
    });
  }

  async get(userId: string, id: string): Promise<AssessmentView> {
    const assessment = await this.requireOwned(userId, id);
    const latest = await this.prisma.assessmentSubmission.findFirst({
      where: { assessmentId: id },
      orderBy: { createdAt: 'desc' },
    });
    return this.toView(assessment, latest);
  }

  async submit(
    userId: string,
    id: string,
    answers: string[],
  ): Promise<AssessmentSubmissionView> {
    const assessment = await this.requireOwned(userId, id);
    const questions = assessment.questions as unknown as StoredQuestion[];

    const locale = await resolveLocale(this.prisma, userId);
    const graded = await this.grade(assessment, questions, answers, locale);

    const submission = await this.prisma.assessmentSubmission.create({
      data: {
        assessmentId: id,
        userId,
        answers: answers as unknown as object,
        score: graded.score,
        results: graded.results as unknown as object,
        summary: graded.summary,
        advice: graded.advice,
      },
    });
    return this.toSubmissionView(submission);
  }

  async requireOwned(userId: string, id: string): Promise<Assessment> {
    const assessment = await this.prisma.assessment.findUnique({ where: { id } });
    if (!assessment || assessment.userId !== userId) {
      throw new NotFoundException('Assessment not found.');
    }
    return assessment;
  }

  // ── generation ───────────────────────────────────────────────────────────

  private async generate(
    type: AssessmentType,
    topic: string,
    difficulty: AssessmentDifficulty,
    count: number,
    brief: (typeof TYPE_BRIEF)[AssessmentType],
    locale: string,
  ): Promise<StoredQuestion[]> {
    const countLine =
      brief.fixedCount === 1
        ? 'Produce exactly ONE question.'
        : `Produce ${count} questions.`;
    const user = [
      `Create a ${difficulty}-level assessment on: "${topic}".`,
      brief.guidance,
      countLine,
      'Return ONLY JSON: {"questions":[{"prompt": string, "format": "mcq"|"open",',
      '"options": string[] (only for mcq), "points": number,',
      '"answerKey": string, "rubric": string}]}.',
      localeDirective(locale),
    ].join(' ');

    let raw: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: EXAMINER_PERSONA },
          { role: 'user', content: user },
        ],
        { temperature: 0.5 },
      );
      raw = result.text;
    } catch (error) {
      this.logger.error(`Assessment generation failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The examiner is temporarily unavailable. Please try again shortly.',
      );
    }

    const parsed = this.parseJson(raw) as { questions?: unknown } | null;
    const list = parsed && Array.isArray(parsed.questions) ? parsed.questions : [];
    return list
      .filter((q): q is Record<string, unknown> => typeof q === 'object' && q !== null)
      .map((q) => {
        const format: QuestionFormat = q.format === 'mcq' ? 'mcq' : 'open';
        const options =
          format === 'mcq' && Array.isArray(q.options)
            ? q.options.map((o) => String(o)).filter(Boolean)
            : undefined;
        return {
          id: randomUUID(),
          prompt: typeof q.prompt === 'string' ? q.prompt.trim() : '',
          format,
          options,
          points:
            typeof q.points === 'number' && q.points > 0
              ? Math.round(q.points)
              : 1,
          answerKey: typeof q.answerKey === 'string' ? q.answerKey.trim() : '',
          rubric: typeof q.rubric === 'string' ? q.rubric.trim() : '',
        } satisfies StoredQuestion;
      })
      .filter((q) => q.prompt && (q.format === 'open' || (q.options?.length ?? 0) >= 2));
  }

  // ── grading ──────────────────────────────────────────────────────────────

  private async grade(
    assessment: Assessment,
    questions: StoredQuestion[],
    answers: string[],
    locale: string,
  ): Promise<{
    score: number;
    results: GradedAnswer[];
    summary: string;
    advice: string;
  }> {
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
      `Mark this ${assessment.type} on "${assessment.topic}". You are given each`,
      'question, its answer key and rubric, and the learner\'s answer. Award marks',
      'fairly with partial credit. For EACH question return the four teacher',
      'questions: "why" (why the answer is/is not right), "how" (how to reach the',
      'right answer), "errorMade" (the specific mistake, or null if fully correct)',
      'and "howToAvoid" (how to avoid it next time, or null if fully correct).',
      'Set "verdict" to "correct" | "partial" | "incorrect". The grade is never',
      'alone: also give an overall "summary" and concrete "advice" on what to',
      'study next.',
      'Questions and answers (JSON):',
      JSON.stringify(items),
      'Return ONLY JSON: {"results":[{"questionId": string, "awarded": number,',
      '"verdict": "correct"|"partial"|"incorrect", "why": string, "how": string,',
      '"errorMade": string|null, "howToAvoid": string|null}],',
      '"summary": string, "advice": string}.',
      localeDirective(locale),
    ].join(' ');

    let raw: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: EXAMINER_PERSONA },
          { role: 'user', content: user },
        ],
        { temperature: 0.2 },
      );
      raw = result.text;
    } catch (error) {
      this.logger.error(`Assessment grading failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'Could not mark that submission. Please try again shortly.',
      );
    }

    const parsed = this.parseJson(raw) as
      | { results?: unknown; summary?: unknown; advice?: unknown }
      | null;
    const rawResults =
      parsed && Array.isArray(parsed.results) ? parsed.results : [];
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
          typeof r.errorMade === 'string' && r.errorMade.trim()
            ? r.errorMade.trim()
            : null,
        howToAvoid:
          typeof r.howToAvoid === 'string' && r.howToAvoid.trim()
            ? r.howToAvoid.trim()
            : null,
      };
    });

    const awardedTotal = results.reduce((s, r) => s + r.awarded, 0);
    const score = Math.round((awardedTotal / maxTotal) * 100);

    return {
      score,
      results,
      summary:
        parsed && typeof parsed.summary === 'string' ? parsed.summary.trim() : '',
      advice:
        parsed && typeof parsed.advice === 'string' ? parsed.advice.trim() : '',
    };
  }

  // ── helpers ──────────────────────────────────────────────────────────────

  private parseJson(raw: string): unknown {
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end === -1) return null;
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
  }

  private titleFor(type: AssessmentType, topic: string): string {
    const label: Record<AssessmentType, string> = {
      mcq: 'MCQ',
      open: 'Open questions',
      dissertation: 'Dissertation',
      exercise: 'Exercises',
      case_study: 'Case study',
      mock_exam: 'Mock exam',
      oral: 'Oral evaluation',
    };
    return `${label[type]} — ${topic}`.slice(0, 200);
  }

  private toView(
    assessment: Assessment,
    latest: AssessmentSubmission | null,
  ): AssessmentView {
    const stored = assessment.questions as unknown as StoredQuestion[];
    return {
      id: assessment.id,
      type: assessment.type as AssessmentType,
      topic: assessment.topic,
      title: assessment.title,
      level: assessment.level,
      questions: (Array.isArray(stored) ? stored : []).map((q) => ({
        id: q.id,
        prompt: q.prompt,
        format: q.format,
        options: q.options,
        points: q.points,
      })),
      createdAt: assessment.createdAt.toISOString(),
      latestSubmission: latest ? this.toSubmissionView(latest) : null,
    };
  }

  private toSubmissionView(s: AssessmentSubmission): AssessmentSubmissionView {
    return {
      id: s.id,
      assessmentId: s.assessmentId,
      score: s.score,
      results: s.results as unknown as GradedAnswer[],
      summary: s.summary,
      advice: s.advice,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
