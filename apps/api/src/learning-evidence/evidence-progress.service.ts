import { Injectable } from '@nestjs/common';
import { LearningCompletionStatus, Prisma } from '@prisma/client';
import type {
  EvidenceBasedLearningProgress,
  LearningCompletionResult,
  LearningDimensionProgress,
  LearningDimensionScores,
  LearningHistoryView,
} from '@second-brain/shared';
import {
  isNormalisedLearningScore,
  languageUnitIdFromLearningRef,
  LEARNING_EVIDENCE_DIMENSIONS,
  RLLE_CURRICULUM,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class EvidenceProgressService {
  constructor(private readonly prisma: PrismaService) {}

  async progress(userId: string): Promise<EvidenceBasedLearningProgress> {
    const completions = await this.prisma.learningCompletion.findMany({
      where: { userId, status: LearningCompletionStatus.verified },
      select: { id: true, finalizedAt: true, dimensionScores: true },
      orderBy: { finalizedAt: 'asc' },
    });
    const dimensions: LearningDimensionProgress[] = LEARNING_EVIDENCE_DIMENSIONS.map((dimension) => {
      const observations = completions.flatMap((completion) => {
        const scores = completion.dimensionScores as unknown as Partial<LearningDimensionScores>;
        const score = scores?.[dimension]?.score;
        return isNormalisedLearningScore(score)
          ? [{ id: completion.id, score, at: completion.finalizedAt }]
          : [];
      });
      return {
        dimension,
        percent: observations.length
          ? Math.round((observations.reduce((sum, item) => sum + item.score, 0) / observations.length) * 100)
          : null,
        evaluatedEvidenceCount: observations.length,
        latestEvidenceAt: observations.at(-1)?.at.toISOString() ?? null,
        completionIds: observations.map((item) => item.id),
      };
    });
    return { completedCount: completions.length, dimensions, generatedAt: new Date().toISOString() };
  }

  async history(userId: string): Promise<LearningHistoryView> {
    const rows = await this.prisma.learningCompletion.findMany({
      where: { userId, status: LearningCompletionStatus.verified },
      include: {
        lesson: { select: { topic: true, objective: true } },
        languageProfile: { select: { language: true, goal: true } },
        goals: { include: { goal: { select: { title: true } } } },
      },
      orderBy: { finalizedAt: 'desc' },
    });
    return {
      items: rows.map((row) => {
        const unit = row.kind === 'language_unit'
          ? RLLE_CURRICULUM.find(
              (candidate) => candidate.id === languageUnitIdFromLearningRef(row.learningRefId),
            )
          : null;
        return {
          completionId: row.id,
          kind: row.kind,
          learningRefId: row.learningRefId,
          title: row.lesson?.topic ?? `${row.languageProfile?.language ?? ''} — ${unit?.titleCode ?? row.learningRefId}`,
          objective: row.lesson?.objective ?? row.goals.find((link) => link.goal)?.goal.title ?? row.languageProfile?.goal ?? null,
          startedAt: row.startedAt?.toISOString() ?? null,
          finalizedAt: row.finalizedAt.toISOString(),
          result: row.result as unknown as LearningCompletionResult,
          dimensions: row.dimensionScores as unknown as LearningDimensionScores,
          provenance: row.provenance as unknown as import('@second-brain/shared').LearningCompletionProvenance,
          goalIds: row.goals.map((link) => link.goalId),
        };
      }),
      generatedAt: new Date().toISOString(),
    };
  }

  async eligibleCardIds(userId: string): Promise<string[]> {
    const links = await this.prisma.learningCompletionCard.findMany({
      where: { completion: { userId, status: LearningCompletionStatus.verified } },
      select: { cardId: true },
      distinct: ['cardId'],
    });
    return links.map(({ cardId }) => cardId);
  }

  async eligibleReviewableIds(userId: string): Promise<string[]> {
    const links = await this.prisma.learningCompletionReviewable.findMany({
      where: { completion: { userId, status: LearningCompletionStatus.verified } },
      select: { reviewableId: true },
      distinct: ['reviewableId'],
    });
    return links.map(({ reviewableId }) => reviewableId);
  }

  verifiedCompletionWhere(userId: string): Prisma.LearningCompletionWhereInput {
    return { userId, status: LearningCompletionStatus.verified };
  }
}
