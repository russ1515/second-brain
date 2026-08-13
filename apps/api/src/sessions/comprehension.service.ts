import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  ComprehensionResult,
  ComprehensionVerdict,
} from '@second-brain/shared';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../concepts/mastery.service';

const MAX_LESSON_CHARS = 4000;
const VERDICTS: ComprehensionVerdict[] = ['understood', 'partial', 'confused'];

const SYSTEM_PROMPT = [
  'You are Second Brain, a patient AI teacher checking whether a student',
  'understood, during a live lesson. You are given the lesson, the question you',
  'asked, and the student\'s answer. Judge their understanding honestly but',
  'kindly. Return ONLY a JSON object: {"verdict": "understood"|"partial"|',
  '"confused", "feedback": "<one or two encouraging sentences on their answer>",',
  '"reexplanation": "<if verdict is partial or confused, a simpler re-explanation',
  'of exactly the point they missed; empty string if understood>"}.',
  'Base everything on the lesson. Write in the lesson\'s language.',
].join(' ');

interface RawResult {
  verdict?: unknown;
  feedback?: unknown;
  reexplanation?: unknown;
}

/**
 * AI Teacher Core (Sprint 7.1) — the comprehension check. During the Questions
 * step the teacher asks, the student answers, and this detects a misunderstanding
 * and adapts the pace: a partial/confused answer comes back with a simpler
 * re-explanation instead of just moving on. Grounded in the session's lesson,
 * pitched at the learner's level (Digital Twin).
 */
@Injectable()
export class ComprehensionService {
  private readonly logger = new Logger(ComprehensionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly mastery: MasteryService,
  ) {}

  async assess(
    userId: string,
    sessionId: string,
    question: string,
    answer: string,
  ): Promise<ComprehensionResult> {
    const session = await this.prisma.studySession.findUnique({
      where: { id: sessionId },
    });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Study session not found.');
    }
    if (!session.lessonId) {
      throw new UnprocessableEntityException('This session has no lesson.');
    }
    const lesson = await this.prisma.lesson.findUnique({
      where: { id: session.lessonId },
    });
    if (!lesson) {
      throw new UnprocessableEntityException('The session lesson is unavailable.');
    }

    const level = await this.level(userId);
    const lessonText = [lesson.objective, lesson.explanation]
      .filter(Boolean)
      .join('\n\n')
      .slice(0, MAX_LESSON_CHARS);

    let raw: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content:
              `Learner level: ${level}.\n\nLESSON:\n${lessonText}\n\n` +
              `QUESTION: ${question}\n\nSTUDENT'S ANSWER: ${answer}`,
          },
        ],
        { temperature: 0.2 },
      );
      raw = result.text;
    } catch (error) {
      this.logger.error(`Comprehension check failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The language model is temporarily unavailable. Please try again shortly.',
      );
    }

    return this.parse(raw);
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async level(userId: string): Promise<string> {
    const twin = await this.mastery.twin(userId).catch(() => null);
    const avg = twin?.summary.averageMastery ?? null;
    if (avg === null) return 'beginner';
    if (avg < 0.5) return 'beginner';
    if (avg < 0.8) return 'intermediate';
    return 'advanced';
  }

  private parse(raw: string): ComprehensionResult {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    let parsed: RawResult = {};
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1)) as RawResult;
      } catch {
        parsed = {};
      }
    }
    const verdict =
      typeof parsed.verdict === 'string' &&
      VERDICTS.includes(parsed.verdict.toLowerCase() as ComprehensionVerdict)
        ? (parsed.verdict.toLowerCase() as ComprehensionVerdict)
        : 'partial';
    const feedback =
      typeof parsed.feedback === 'string' && parsed.feedback.trim()
        ? parsed.feedback.trim()
        : '';
    const reexplanationText =
      typeof parsed.reexplanation === 'string' ? parsed.reexplanation.trim() : '';
    return {
      verdict,
      feedback,
      reexplanation:
        verdict !== 'understood' && reexplanationText ? reexplanationText : null,
    };
  }
}
