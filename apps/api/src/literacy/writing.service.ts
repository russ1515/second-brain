import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { WritingSubmission } from '@prisma/client';
import type {
  ReviewWritingRequest,
  WritingDimension,
  WritingDimensionKind,
  WritingRating,
  WritingReview,
  WritingSubmissionSummary,
  WritingSubmissionView,
  WritingType,
} from '@second-brain/shared';
import { WRITING_DIMENSIONS } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { localeDirective, resolveLocale } from '../common/learning-locale';
import { parseJsonObject } from './json';

const WRITING_PERSONA =
  'You are an expert academic writing coach. You read a learner\'s written work ' +
  'and give a precise, structured critique. You are honest but constructive: ' +
  'improvement is never only about faults, and every criticism comes with a ' +
  'concrete way to fix it. Reply in the language the piece is written in.';

const TYPE_LABEL: Record<WritingType, string> = {
  redaction: 'essay (rédaction)',
  dissertation: 'dissertation',
  memoire: 'thesis / dissertation (mémoire)',
  rapport: 'report (rapport)',
  compte_rendu: 'summary / minutes (compte rendu)',
  devoir: 'homework assignment (devoir)',
};

@Injectable()
export class WritingService {
  private readonly logger = new Logger(WritingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async review(
    userId: string,
    dto: ReviewWritingRequest,
  ): Promise<WritingSubmissionView> {
    const text = dto.text.trim();
    const locale = await resolveLocale(this.prisma, userId);
    const review = await this.analyse(dto.type, text, locale, dto.instructions);

    const submission = await this.prisma.writingSubmission.create({
      data: {
        userId,
        type: dto.type,
        title: dto.title?.trim() || null,
        text,
        score: review.score,
        review: review as unknown as object,
      },
    });
    return this.toView(submission);
  }

  async list(userId: string): Promise<WritingSubmissionSummary[]> {
    const rows = await this.prisma.writingSubmission.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((s) => ({
      id: s.id,
      type: s.type as WritingType,
      title: s.title,
      score: s.score,
      createdAt: s.createdAt.toISOString(),
    }));
  }

  async get(userId: string, id: string): Promise<WritingSubmissionView> {
    const submission = await this.prisma.writingSubmission.findUnique({
      where: { id },
    });
    if (!submission || submission.userId !== userId) {
      throw new NotFoundException('Writing submission not found.');
    }
    return this.toView(submission);
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async analyse(
    type: WritingType,
    text: string,
    locale: string,
    instructions?: string,
  ): Promise<WritingReview> {
    const brief = instructions?.trim()
      ? `The piece was meant to answer this brief: "${instructions.trim()}". `
      : '';
    const user = [
      `Review this ${TYPE_LABEL[type]}.`,
      brief,
      localeDirective(locale),
      'Analyse it across EXACTLY these seven dimensions: "structure",',
      '"logic", "clarity", "spelling", "grammar", "argumentation" and',
      '"academic_quality". For each, give a "rating" ("good"|"fair"|',
      '"needs_work"), an "observation" (what you saw, grounded in the text) and',
      '"howToImprove" (precise, actionable). Then give an overall "score" (0-100',
      'academic quality), a "summary", a "strengths" array (what already works)',
      'and a "priorities" array (the most important fixes, in order).',
      'Return ONLY JSON: {"score": number, "summary": string,',
      '"strengths": string[], "dimensions": [{"kind": string, "rating": string,',
      '"observation": string, "howToImprove": string}], "priorities": string[]}.',
      'The text to review follows between triple backticks:',
      '```',
      text,
      '```',
    ].join(' ');

    let raw: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: WRITING_PERSONA },
          { role: 'user', content: user },
        ],
        { temperature: 0.3 },
      );
      raw = result.text;
    } catch (error) {
      this.logger.error(`Writing review failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The writing coach is temporarily unavailable. Please try again shortly.',
      );
    }

    return this.parseReview(raw);
  }

  private parseReview(raw: string): WritingReview {
    const d = parseJsonObject(raw);
    if (!d) {
      throw new ServiceUnavailableException(
        'The writing coach returned an unreadable review. Please try again.',
      );
    }

    const ratings: WritingRating[] = ['good', 'fair', 'needs_work'];
    const rawDims = Array.isArray(d.dimensions) ? d.dimensions : [];
    const byKind = new Map<WritingDimensionKind, WritingDimension>();
    for (const item of rawDims) {
      if (typeof item !== 'object' || item === null) continue;
      const di = item as Record<string, unknown>;
      const kind = di.kind as WritingDimensionKind;
      if (!WRITING_DIMENSIONS.includes(kind)) continue;
      byKind.set(kind, {
        kind,
        rating: ratings.includes(di.rating as WritingRating)
          ? (di.rating as WritingRating)
          : 'fair',
        observation: typeof di.observation === 'string' ? di.observation.trim() : '',
        howToImprove:
          typeof di.howToImprove === 'string' ? di.howToImprove.trim() : '',
      });
    }
    const dimensions = WRITING_DIMENSIONS.map(
      (kind) =>
        byKind.get(kind) ?? {
          kind,
          rating: 'fair' as WritingRating,
          observation: '',
          howToImprove: '',
        },
    );

    const score =
      typeof d.score === 'number'
        ? Math.max(0, Math.min(100, Math.round(d.score)))
        : 0;

    return {
      score,
      summary: typeof d.summary === 'string' ? d.summary.trim() : '',
      strengths: this.stringArray(d.strengths),
      dimensions,
      priorities: this.stringArray(d.priorities),
    };
  }

  private stringArray(v: unknown): string[] {
    return Array.isArray(v)
      ? v.filter((x): x is string => typeof x === 'string').map((x) => x.trim()).filter(Boolean)
      : [];
  }

  private toView(s: WritingSubmission): WritingSubmissionView {
    return {
      id: s.id,
      type: s.type as WritingType,
      title: s.title,
      text: s.text,
      score: s.score,
      review: s.review as unknown as WritingReview,
      createdAt: s.createdAt.toISOString(),
    };
  }
}
