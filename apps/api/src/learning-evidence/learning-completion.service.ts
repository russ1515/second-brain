import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import {
  LearningCompletionKind as PrismaCompletionKind,
  LearningEvidenceSourceKind as PrismaEvidenceKind,
  Prisma,
} from '@prisma/client';
import type {
  FinalizeLanguageUnitCompletionInput,
  FinalizeLessonCompletionInput,
  LearningCompletionProvenance,
  LearningCompletionResult,
  LearningCompletionView,
  LearningCriterionResult,
  LearningDimensionScores,
  RlleCapabilityEvidence,
} from '@second-brain/shared';
import {
  emptyLearningDimensionScores,
  isNormalisedLearningScore,
  languageUnitIdFromLearningRef,
  languageUnitLearningRef,
  LEARNING_EVIDENCE_DIMENSIONS,
  RLLE_CURRICULUM,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CardGenerationService } from '../flashcards/card-generation.service';

const LANGUAGE_CURRICULUM_CONTENT_VERSION = 1;
const COMPLETION_FLASHCARD_COUNT = 8;

type CompletionWithRelations = Prisma.LearningCompletionGetPayload<{
  include: {
    goals: true;
    lesson: { select: { topic: true } };
    languageProfile: { select: { language: true } };
  };
}>;

interface RlleCourseState {
  completedUnitIds?: unknown;
  evidence?: unknown;
}

/**
 * The single server-side write boundary for proof-backed completion.
 *
 * It deliberately has no HTTP controller. Product services call it only after
 * their own evaluated final activity. Merely generating/opening/clicking a
 * lesson cannot reach this boundary.
 */
@Injectable()
export class LearningCompletionService {
  private readonly logger = new Logger(LearningCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly cardGeneration: CardGenerationService,
  ) {}

  async finalizeLesson(
    userId: string,
    input: FinalizeLessonCompletionInput,
  ): Promise<LearningCompletionView> {
    const lesson = await this.prisma.lesson.findFirst({
      where: { id: input.lessonId, userId },
      select: {
        id: true,
        topic: true,
        contentVersion: true,
        sourceDocumentId: true,
        conceptId: true,
      },
    });
    if (!lesson) throw new NotFoundException('Lesson not found.');

    const session = input.experienceSessionId
      ? await this.requireSession(userId, input.experienceSessionId, {
          lessonId: lesson.id,
        })
      : null;
    const evidence = await this.lessonEvidence(userId, lesson.id, lesson.contentVersion, input);
    const goalIds = await this.resolveGoalIds(userId, input.goalIds, session?.id ?? null);
    const dimensions = this.dimensionScores(input.dimensions, [evidence.refId]);
    const provenance: LearningCompletionProvenance = {
      schemaVersion: 1,
      contentVersion: lesson.contentVersion,
      evidenceSource: evidence.source,
      evidenceRefIds: [evidence.refId],
      experienceSessionId: session?.id ?? null,
      evaluatedAt: evidence.evaluatedAt.toISOString(),
    };

    const completion = await this.prisma.$transaction(async (tx) => {
      const row = await tx.learningCompletion.upsert({
        where: {
          userId_kind_learningRefId_contentVersion: {
            userId,
            kind: PrismaCompletionKind.lesson,
            learningRefId: lesson.id,
            contentVersion: lesson.contentVersion,
          },
        },
        create: {
          userId,
          kind: PrismaCompletionKind.lesson,
          learningRefId: lesson.id,
          contentVersion: lesson.contentVersion,
          evidenceSource: evidence.prismaSource,
          evidenceRefId: evidence.refId,
          lessonId: lesson.id,
          experienceSessionId: session?.id,
          exerciseAttemptId: evidence.exerciseAttemptId,
          assessmentSubmissionId: evidence.assessmentSubmissionId,
          criteria: evidence.criteria as unknown as Prisma.InputJsonValue,
          result: evidence.result as unknown as Prisma.InputJsonValue,
          provenance: provenance as unknown as Prisma.InputJsonValue,
          dimensionScores: dimensions as unknown as Prisma.InputJsonValue,
          startedAt: this.optionalDate(input.startedAt) ?? session?.startedAt,
          goals: goalIds.length
            ? { createMany: { data: goalIds.map((goalId) => ({ goalId })), skipDuplicates: true } }
            : undefined,
        },
        update: {},
      });

      // Publishing starts only after canonical evidence exists. A Reviewable is
      // the minimum eligible revision item; any pre-generated cards remain
      // drafts until linked here.
      const reviewable = await tx.reviewable.upsert({
        where: { userId_kind_refId: { userId, kind: 'lesson', refId: lesson.id } },
        create: { userId, kind: 'lesson', refId: lesson.id, title: `Lesson — ${lesson.topic}`.slice(0, 200) },
        update: { title: `Lesson — ${lesson.topic}`.slice(0, 200) },
      });
      await tx.learningCompletionReviewable.upsert({
        where: { completionId_reviewableId: { completionId: row.id, reviewableId: reviewable.id } },
        create: { completionId: row.id, reviewableId: reviewable.id },
        update: {},
      });

      if (lesson.sourceDocumentId) {
        const draftCards = await tx.card.findMany({
          where: { userId, sourceDocumentId: lesson.sourceDocumentId },
          select: { id: true },
        });
        if (draftCards.length) {
          await tx.learningCompletionCard.createMany({
            data: draftCards.map(({ id: cardId }) => ({ completionId: row.id, cardId })),
            skipDuplicates: true,
          });
        }
      }

      return tx.learningCompletion.findUniqueOrThrow({
        where: { id: row.id },
        include: {
          goals: true,
          lesson: { select: { topic: true } },
          languageProfile: { select: { language: true } },
        },
      });
    });
    await this.publishLessonCards(
      userId,
      completion.id,
      lesson.sourceDocumentId,
      lesson.conceptId,
    );
    return this.toView(completion);
  }

  async finalizeLanguageUnit(
    userId: string,
    input: FinalizeLanguageUnitCompletionInput,
  ): Promise<LearningCompletionView> {
    const profile = await this.prisma.languageProfile.findFirst({
      where: { id: input.languageProfileId, userId },
      select: { id: true, language: true },
    });
    if (!profile) throw new NotFoundException('Language profile not found.');
    const session = await this.requireSession(userId, input.experienceSessionId, {
      languageProfileId: profile.id,
    });
    const unit = RLLE_CURRICULUM.find((candidate) => candidate.id === input.unitId);
    if (!unit) throw new BadRequestException('Unknown language unit.');

    const state = this.rlleState(session.currentStep);
    const completedUnitIds = this.stringArray(state.completedUnitIds);
    if (!completedUnitIds.includes(unit.id)) {
      throw new UnprocessableEntityException('The language unit has not completed its required path.');
    }
    const sessionEvidence = this.rlleEvidence(state.evidence);
    const requestedIds = [...new Set(input.evidenceIds)].sort();
    if (requestedIds.length === 0) {
      throw new UnprocessableEntityException('Final evaluated evidence is required.');
    }
    const selected = requestedIds.map((id) => sessionEvidence.find((item) => item.id === id));
    if (selected.some((item) => !item)) {
      throw new BadRequestException('Language evidence is not owned by this learning session.');
    }
    const evidence = selected as RlleCapabilityEvidence[];
    if (evidence.some((item) => !unit.canDoIds.includes(item.canDoId))) {
      throw new BadRequestException('Evidence does not belong to this language unit.');
    }
    if (unit.canDoIds.some((canDoId) => !evidence.some((item) => item.canDoId === canDoId))) {
      throw new UnprocessableEntityException('Every required Can-Do must have evaluated evidence.');
    }

    const goalIds = await this.resolveGoalIds(userId, input.goalIds, session.id);
    const demonstrated = evidence.filter((item) => item.result === 'demonstrated').length;
    const criteria: LearningCriterionResult[] = unit.canDoIds.map((canDoId) => {
      const observations = evidence.filter((item) => item.canDoId === canDoId);
      return {
        id: canDoId,
        label: canDoId,
        met: observations.some((item) => item.result === 'demonstrated'),
        score: null,
      };
    });
    const result: LearningCompletionResult = {
      outcome: demonstrated === evidence.length ? 'demonstrated' : 'not_demonstrated',
      score: null,
      passed: null,
      feedback: evidence.map((item) => item.observation).filter(Boolean).join(' ').slice(0, 2000) || null,
    };
    const dimensions = this.dimensionScores(input.dimensions, requestedIds);
    const evaluatedAt = new Date(
      Math.max(...evidence.map((item) => new Date(item.observedAt).getTime())),
    );
    if (!Number.isFinite(evaluatedAt.getTime())) {
      throw new BadRequestException('Language evidence timestamp is invalid.');
    }
    const provenance: LearningCompletionProvenance = {
      schemaVersion: 1,
      contentVersion: LANGUAGE_CURRICULUM_CONTENT_VERSION,
      evidenceSource: 'language_capability',
      evidenceRefIds: requestedIds,
      experienceSessionId: session.id,
      evaluatedAt: evaluatedAt.toISOString(),
    };
    const learningRefId = languageUnitLearningRef(profile.id, unit.id);

    const completion = await this.prisma.$transaction(async (tx) => {
      const row = await tx.learningCompletion.upsert({
        where: {
          userId_kind_learningRefId_contentVersion: {
            userId,
            kind: PrismaCompletionKind.language_unit,
            learningRefId,
            contentVersion: LANGUAGE_CURRICULUM_CONTENT_VERSION,
          },
        },
        create: {
          userId,
          kind: PrismaCompletionKind.language_unit,
          learningRefId,
          contentVersion: LANGUAGE_CURRICULUM_CONTENT_VERSION,
          evidenceSource: PrismaEvidenceKind.language_capability,
          evidenceRefId: requestedIds[0],
          languageProfileId: profile.id,
          experienceSessionId: session.id,
          criteria: criteria as unknown as Prisma.InputJsonValue,
          result: result as unknown as Prisma.InputJsonValue,
          provenance: provenance as unknown as Prisma.InputJsonValue,
          dimensionScores: dimensions as unknown as Prisma.InputJsonValue,
          startedAt: this.optionalDate(input.startedAt) ?? session.startedAt,
          goals: goalIds.length
            ? { createMany: { data: goalIds.map((goalId) => ({ goalId })), skipDuplicates: true } }
            : undefined,
        },
        update: {},
      });
      const reviewable = await tx.reviewable.upsert({
        where: { userId_kind_refId: { userId, kind: 'language', refId: `${profile.id}:${unit.id}` } },
        create: {
          userId,
          kind: 'language',
          refId: `${profile.id}:${unit.id}`,
          title: `${profile.language} — ${unit.titleCode}`.slice(0, 200),
        },
        update: {},
      });
      await tx.learningCompletionReviewable.upsert({
        where: { completionId_reviewableId: { completionId: row.id, reviewableId: reviewable.id } },
        create: { completionId: row.id, reviewableId: reviewable.id },
        update: {},
      });
      return tx.learningCompletion.findUniqueOrThrow({
        where: { id: row.id },
        include: {
          goals: true,
          lesson: { select: { topic: true } },
          languageProfile: { select: { language: true } },
        },
      });
    });
    return this.toView(completion);
  }

  /** Attach an owned goal to an owned in-progress learning session. */
  async linkGoal(
    userId: string,
    experienceSessionId: string,
    goalId: string,
    isPrimary = false,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const [session, goal] = await Promise.all([
        tx.experienceSession.findFirst({ where: { id: experienceSessionId, userId }, select: { id: true } }),
        tx.goal.findFirst({ where: { id: goalId, userId }, select: { id: true } }),
      ]);
      if (!session || !goal) throw new NotFoundException('Learning session or goal not found.');
      if (isPrimary) {
        await tx.learningGoalLink.updateMany({
          where: { userId, experienceSessionId, isPrimary: true },
          data: { isPrimary: false },
        });
      }
      await tx.learningGoalLink.upsert({
        where: { experienceSessionId_goalId: { experienceSessionId, goalId } },
        create: { userId, experienceSessionId, goalId, isPrimary },
        update: { isPrimary },
      });
      if (isPrimary) {
        await tx.experienceSession.update({ where: { id: experienceSessionId }, data: { goalId } });
      }
    });
  }

  async unlinkGoal(userId: string, experienceSessionId: string, goalId: string): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const link = await tx.learningGoalLink.findFirst({
        where: { userId, experienceSessionId, goalId },
      });
      if (!link) throw new NotFoundException('Learning goal link not found.');
      await tx.learningGoalLink.delete({ where: { id: link.id } });
      if (link.isPrimary) {
        const replacement = await tx.learningGoalLink.findFirst({
          where: { userId, experienceSessionId },
          orderBy: { createdAt: 'asc' },
        });
        if (replacement) {
          await tx.learningGoalLink.update({ where: { id: replacement.id }, data: { isPrimary: true } });
        }
        await tx.experienceSession.update({
          where: { id: experienceSessionId },
          data: { goalId: replacement?.goalId ?? null },
        });
      }
    });
  }

  private async lessonEvidence(
    userId: string,
    lessonId: string,
    contentVersion: number,
    input: FinalizeLessonCompletionInput,
  ) {
    if (input.evidence.kind === 'exercise_attempt') {
      const attempt = await this.prisma.exerciseAttempt.findFirst({
        where: { id: input.evidence.id, userId, lessonId, contentVersion },
      });
      if (!attempt) throw new NotFoundException('Evaluated lesson attempt not found.');
      const score = isNormalisedLearningScore(attempt.score) ? attempt.score : null;
      const criteria: LearningCriterionResult[] = [{
        id: `exercise:${attempt.exerciseIndex}`,
        label: attempt.question.slice(0, 500),
        met: attempt.correct,
        score,
      }];
      const result: LearningCompletionResult = {
        outcome: attempt.correct ? 'demonstrated' : 'not_demonstrated',
        score,
        passed: attempt.correct,
        feedback: attempt.feedback || attempt.correction || null,
      };
      return {
        source: 'exercise_attempt' as const,
        prismaSource: PrismaEvidenceKind.exercise_attempt,
        refId: attempt.id,
        evaluatedAt: attempt.createdAt,
        criteria,
        result,
        exerciseAttemptId: attempt.id,
        assessmentSubmissionId: undefined,
      };
    }

    const submission = await this.prisma.assessmentSubmission.findFirst({
      where: { id: input.evidence.id, userId },
      include: { assessment: true },
    });
    if (
      !submission ||
      submission.assessment.lessonId !== lessonId ||
      submission.assessment.contentVersion !== contentVersion
    ) {
      throw new NotFoundException('Versioned lesson assessment submission not found.');
    }
    const score = Number.isFinite(submission.score) && submission.score >= 0 && submission.score <= 100
      ? submission.score / 100
      : null;
    const criteria: LearningCriterionResult[] = [{
      id: `assessment:${submission.assessmentId}`,
      label: submission.assessment.title.slice(0, 500),
      met: null,
      score,
    }];
    const result: LearningCompletionResult = {
      outcome: 'evaluated',
      score,
      passed: null,
      feedback: submission.summary || submission.advice || null,
    };
    return {
      source: 'assessment_submission' as const,
      prismaSource: PrismaEvidenceKind.assessment_submission,
      refId: submission.id,
      evaluatedAt: submission.createdAt,
      criteria,
      result,
      exerciseAttemptId: undefined,
      assessmentSubmissionId: submission.id,
    };
  }

  private async publishLessonCards(
    userId: string,
    completionId: string,
    sourceDocumentId: string | null,
    conceptId: string | null,
  ): Promise<void> {
    if (!sourceDocumentId) return;
    try {
      let cards = await this.prisma.card.findMany({
        where: { userId, sourceDocumentId },
        select: { id: true },
      });
      if (cards.length === 0) {
        await this.cardGeneration.generateFromDocument(userId, sourceDocumentId, {
          count: COMPLETION_FLASHCARD_COUNT,
        });
        cards = await this.prisma.card.findMany({
          where: { userId, sourceDocumentId },
          select: { id: true },
        });
      }
      if (cards.length === 0) return;
      await this.prisma.$transaction(async (tx) => {
        await tx.learningCompletionCard.createMany({
          data: cards.map(({ id: cardId }) => ({ completionId, cardId })),
          skipDuplicates: true,
        });
        if (conceptId) {
          await tx.conceptCard.createMany({
            data: cards.map(({ id: cardId }) => ({ conceptId, cardId })),
            skipDuplicates: true,
          });
        }
      });
    } catch {
      // Completion remains truthful even if the optional revision artefact could
      // not be generated. A retry will reuse/link any cards that did succeed.
      this.logger.warn('Post-completion flashcard publication failed.');
    }
  }

  private async requireSession(
    userId: string,
    id: string,
    expected: { lessonId?: string; languageProfileId?: string },
  ) {
    const session = await this.prisma.experienceSession.findFirst({ where: { id, userId } });
    if (!session) throw new NotFoundException('Learning session not found.');
    if (expected.lessonId && session.lessonId !== expected.lessonId) {
      throw new BadRequestException('Learning session does not belong to this lesson.');
    }
    if (expected.languageProfileId && session.languageProfileId !== expected.languageProfileId) {
      throw new BadRequestException('Learning session does not belong to this language profile.');
    }
    return session;
  }

  private async resolveGoalIds(
    userId: string,
    requested: string[] | undefined,
    experienceSessionId: string | null,
  ): Promise<string[]> {
    const explicit = [...new Set(requested ?? [])];
    if (explicit.length) {
      const owned = await this.prisma.goal.findMany({
        where: { userId, id: { in: explicit } },
        select: { id: true },
      });
      if (owned.length !== explicit.length) throw new NotFoundException('Learning goal not found.');
      if (experienceSessionId) {
        for (let index = 0; index < explicit.length; index += 1) {
          await this.linkGoal(userId, experienceSessionId, explicit[index], index === 0);
        }
      }
      return explicit;
    }
    if (!experienceSessionId) return [];
    const links = await this.prisma.learningGoalLink.findMany({
      where: { userId, experienceSessionId },
      orderBy: [{ isPrimary: 'desc' }, { createdAt: 'asc' }],
      select: { goalId: true },
    });
    if (links.length) return links.map((link) => link.goalId);
    const session = await this.prisma.experienceSession.findUnique({
      where: { id: experienceSessionId },
      select: { goalId: true },
    });
    return session?.goalId ? [session.goalId] : [];
  }

  private dimensionScores(
    raw: FinalizeLessonCompletionInput['dimensions'],
    evidenceRefIds: string[],
  ): LearningDimensionScores {
    const scores = emptyLearningDimensionScores();
    for (const dimension of LEARNING_EVIDENCE_DIMENSIONS) {
      const value = raw?.[dimension];
      if (value === undefined || value === null) continue;
      if (!isNormalisedLearningScore(value)) {
        throw new BadRequestException(`Invalid normalised score for ${dimension}.`);
      }
      scores[dimension] = {
        dimension,
        score: value,
        criterionIds: [],
        evidenceRefIds,
      };
    }
    return scores;
  }

  private optionalDate(value?: string): Date | undefined {
    if (!value) return undefined;
    const parsed = new Date(value);
    if (!Number.isFinite(parsed.getTime())) throw new BadRequestException('Invalid start date.');
    return parsed;
  }

  private rlleState(currentStep: Prisma.JsonValue | null): RlleCourseState {
    if (!currentStep || Array.isArray(currentStep) || typeof currentStep !== 'object') {
      throw new UnprocessableEntityException('This language session has no readable course state.');
    }
    const metadata = (currentStep as Record<string, unknown>).metadata;
    if (!metadata || Array.isArray(metadata) || typeof metadata !== 'object') {
      throw new UnprocessableEntityException('This language session has no readable course state.');
    }
    const state = (metadata as Record<string, unknown>).rlleCourse;
    if (!state || Array.isArray(state) || typeof state !== 'object') {
      throw new UnprocessableEntityException('This language session has no readable course state.');
    }
    return state as RlleCourseState;
  }

  private stringArray(value: unknown): string[] {
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
  }

  private rlleEvidence(value: unknown): RlleCapabilityEvidence[] {
    if (!Array.isArray(value)) return [];
    return value.filter((item): item is RlleCapabilityEvidence => {
      if (!item || Array.isArray(item) || typeof item !== 'object') return false;
      const evidence = item as Record<string, unknown>;
      return (
        typeof evidence.id === 'string' &&
        typeof evidence.canDoId === 'string' &&
        typeof evidence.source === 'string' &&
        typeof evidence.sourceId === 'string' &&
        (evidence.result === 'demonstrated' || evidence.result === 'not-demonstrated') &&
        typeof evidence.observedAt === 'string' &&
        typeof evidence.observation === 'string'
      );
    });
  }

  private toView(row: CompletionWithRelations): LearningCompletionView {
    const unit = row.kind === PrismaCompletionKind.language_unit
      ? RLLE_CURRICULUM.find(
          (candidate) => candidate.id === languageUnitIdFromLearningRef(row.learningRefId),
        )
      : null;
    return {
      id: row.id,
      kind: row.kind,
      learningRefId: row.learningRefId,
      title: row.lesson?.topic ?? (unit ? `${row.languageProfile?.language ?? ''} — ${unit.titleCode}` : row.learningRefId),
      contentVersion: row.contentVersion,
      status: row.status,
      goalIds: row.goals.map((goal) => goal.goalId),
      startedAt: row.startedAt?.toISOString() ?? null,
      finalizedAt: row.finalizedAt.toISOString(),
      criteria: row.criteria as unknown as LearningCriterionResult[],
      result: row.result as unknown as LearningCompletionResult,
      dimensions: row.dimensionScores as unknown as LearningDimensionScores,
      provenance: row.provenance as unknown as LearningCompletionProvenance,
    };
  }
}
