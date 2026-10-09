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
  FinalizeLegacyLanguageUnitCompletionInput,
  FinalizeLessonCompletionInput,
  LearningCompletionProvenance,
  LearningCompletionResult,
  LearningCompletionView,
  LearningCriterionResult,
  LearningDimensionScores,
  LanguageMasteryDecision,
  LanguageTrainingFormat,
  LanguageTrainingEvidence,
  RlleCapabilityEvidence,
} from '@second-brain/shared';
import {
  emptyLearningDimensionScores,
  isNormalisedLearningScore,
  LANGUAGE_MASTERY_POLICY_VERSION,
  LANGUAGE_MASTERY_THRESHOLD,
  LANGUAGE_TRAINING_FORMATS,
  languageUnitIdFromLearningRef,
  languageUnitLearningRef,
  LEARNING_EVIDENCE_DIMENSIONS,
  missingLanguageTrainingFormats,
  RLLE_CURRICULUM,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CardGenerationService } from '../flashcards/card-generation.service';

// Version 1 used controlled Can-Do observations and may remain visible as
// history. Version 2 is awarded only from the autonomy/mastery policy below.
const LANGUAGE_CURRICULUM_CONTENT_VERSION = 2;
const LEGACY_LANGUAGE_CURRICULUM_CONTENT_VERSION = 1;
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
  currentLesson?: unknown;
  milestoneMastery?: unknown;
  evidence?: unknown;
}

interface StoredLanguageMasteryMetadata {
  policyVersion: string;
  profileId: string;
  courseSessionId: string;
  unitId: string;
  lessonId: string;
  attemptId: string;
  helpUsed: boolean;
  answerLeak: boolean;
  sealedAt: string;
}

interface StoredAssessmentQuestion {
  id: string;
  prompt: string;
  points: number;
}

interface StoredGradedResult {
  questionId: string;
  awarded: number;
  max: number;
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
    if (!('policyVersion' in input)) {
      return this.finalizeLegacyLanguageUnit(userId, input);
    }
    if (input.policyVersion !== LANGUAGE_MASTERY_POLICY_VERSION) {
      throw new BadRequestException('Unsupported language mastery policy.');
    }
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
    const activeLesson = this.record(state.currentLesson);
    if (activeLesson?.unitId !== unit.id || activeLesson.lessonId !== input.lessonId) {
      throw new UnprocessableEntityException('The assessed language lesson is not active in this course.');
    }

    const lesson = await this.prisma.lesson.findFirst({
      where: { id: input.lessonId, userId, languageProfileId: profile.id },
      select: { id: true, contentVersion: true, exercises: true },
    });
    if (!lesson) throw new NotFoundException('Language lesson not found.');
    if (lesson.contentVersion !== input.lessonContentVersion) {
      throw new BadRequestException('Language lesson content version is stale.');
    }

    const submission = await this.prisma.assessmentSubmission.findFirst({
      where: { id: input.assessmentSubmissionId, userId },
      include: { assessment: true },
    });
    if (
      !submission
      || submission.assessment.userId !== userId
      || submission.assessment.lessonId !== lesson.id
      || submission.assessment.contentVersion !== lesson.contentVersion
    ) {
      throw new NotFoundException('Versioned language assessment submission not found.');
    }
    if (submission.assessment.type !== 'open') {
      throw new UnprocessableEntityException('Language autonomy evidence must use open production questions.');
    }

    const payload = this.languageAssessmentPayload(submission.assessment.questions);
    const metadata = payload.metadata;
    if (
      metadata.policyVersion !== LANGUAGE_MASTERY_POLICY_VERSION
      || metadata.profileId !== profile.id
      || metadata.courseSessionId !== session.id
      || metadata.unitId !== unit.id
      || metadata.lessonId !== lesson.id
      || !metadata.sealedAt
    ) {
      throw new BadRequestException('Language mastery assessment provenance is invalid.');
    }
    if (metadata.helpUsed || metadata.answerLeak) {
      throw new UnprocessableEntityException('Assisted autonomy evidence cannot prove language mastery.');
    }

    const graded = this.completeLanguageRubric(
      payload.questions,
      submission.answers,
      submission.results,
    );
    if (graded.rawScore < LANGUAGE_MASTERY_THRESHOLD) {
      throw new UnprocessableEntityException('Language mastery threshold was not met.');
    }
    await this.requireLanguageMilestoneMastery(
      userId,
      input.mastery,
      unit.id,
      metadata.attemptId,
      submission.assessmentId,
      graded.rawScore,
      lesson,
    );

    const goalIds = await this.resolveGoalIds(userId, input.goalIds, session.id);
    const criteria: LearningCriterionResult[] = payload.questions.map((question) => {
      const observation = graded.byQuestion.get(question.id)!;
      const score = observation.awarded / observation.max;
      return {
        id: question.id,
        label: question.prompt.slice(0, 500),
        met: score >= LANGUAGE_MASTERY_THRESHOLD,
        score,
      };
    });
    const result: LearningCompletionResult = {
      outcome: 'demonstrated',
      score: graded.rawScore,
      passed: true,
      feedback: [submission.summary, submission.advice].filter(Boolean).join(' ').slice(0, 2000) || null,
    };
    const evidenceRefIds = [submission.id];
    const dimensions = this.dimensionScores(input.dimensions, evidenceRefIds);
    const evaluatedAt = submission.createdAt;
    if (!Number.isFinite(evaluatedAt.getTime())) {
      throw new BadRequestException('Language evidence timestamp is invalid.');
    }
    const provenance: LearningCompletionProvenance = {
      schemaVersion: 1,
      contentVersion: LANGUAGE_CURRICULUM_CONTENT_VERSION,
      evidenceSource: 'assessment_submission',
      evidenceRefIds,
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
          evidenceSource: PrismaEvidenceKind.assessment_submission,
          evidenceRefId: submission.id,
          languageProfileId: profile.id,
          experienceSessionId: session.id,
          assessmentSubmissionId: submission.id,
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

  private async finalizeLegacyLanguageUnit(
    userId: string,
    input: FinalizeLegacyLanguageUnitCompletionInput,
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
      throw new UnprocessableEntityException(
        'The language unit has not completed its required path.',
      );
    }
    const sessionEvidence = this.rlleEvidence(state.evidence);
    const requestedIds = [...new Set(input.evidenceIds)].sort();
    if (requestedIds.length === 0) {
      throw new UnprocessableEntityException('Final evaluated evidence is required.');
    }
    const selected = requestedIds.map((id) =>
      sessionEvidence.find((item) => item.id === id));
    if (selected.some((item) => !item)) {
      throw new BadRequestException(
        'Language evidence is not owned by this learning session.',
      );
    }
    const evidence = selected as RlleCapabilityEvidence[];
    if (evidence.some((item) => !unit.canDoIds.includes(item.canDoId))) {
      throw new BadRequestException('Evidence does not belong to this language unit.');
    }
    if (
      unit.canDoIds.some(
        (canDoId) => !evidence.some((item) => item.canDoId === canDoId),
      )
    ) {
      throw new UnprocessableEntityException(
        'Every required Can-Do must have evaluated evidence.',
      );
    }

    const goalIds = await this.resolveGoalIds(userId, input.goalIds, session.id);
    const demonstrated = evidence.filter(
      (item) => item.result === 'demonstrated',
    ).length;
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
      outcome:
        demonstrated === evidence.length ? 'demonstrated' : 'not_demonstrated',
      score: null,
      passed: null,
      feedback:
        evidence
          .map((item) => item.observation)
          .filter(Boolean)
          .join(' ')
          .slice(0, 2_000) || null,
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
      contentVersion: LEGACY_LANGUAGE_CURRICULUM_CONTENT_VERSION,
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
            contentVersion: LEGACY_LANGUAGE_CURRICULUM_CONTENT_VERSION,
          },
        },
        create: {
          userId,
          kind: PrismaCompletionKind.language_unit,
          learningRefId,
          contentVersion: LEGACY_LANGUAGE_CURRICULUM_CONTENT_VERSION,
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
            ? {
                createMany: {
                  data: goalIds.map((goalId) => ({ goalId })),
                  skipDuplicates: true,
                },
              }
            : undefined,
        },
        update: {},
      });
      const reviewRefId = profile.id + ':' + unit.id;
      const reviewable = await tx.reviewable.upsert({
        where: {
          userId_kind_refId: {
            userId,
            kind: 'language',
            refId: reviewRefId,
          },
        },
        create: {
          userId,
          kind: 'language',
          refId: reviewRefId,
          title: (profile.language + ' — ' + unit.titleCode).slice(0, 200),
        },
        update: {},
      });
      await tx.learningCompletionReviewable.upsert({
        where: {
          completionId_reviewableId: {
            completionId: row.id,
            reviewableId: reviewable.id,
          },
        },
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

  private languageAssessmentPayload(value: unknown): {
    metadata: StoredLanguageMasteryMetadata;
    questions: StoredAssessmentQuestion[];
  } {
    const payload = this.record(value);
    const metadata = this.record(payload?.languageMastery);
    const questionsValue = payload?.questions;
    if (
      payload?.version !== 2
      || !metadata
      || typeof metadata.policyVersion !== 'string'
      || typeof metadata.profileId !== 'string'
      || typeof metadata.courseSessionId !== 'string'
      || typeof metadata.unitId !== 'string'
      || typeof metadata.lessonId !== 'string'
      || typeof metadata.attemptId !== 'string'
      || typeof metadata.helpUsed !== 'boolean'
      || typeof metadata.answerLeak !== 'boolean'
      || typeof metadata.sealedAt !== 'string'
      || !metadata.sealedAt
      || !Array.isArray(questionsValue)
      || questionsValue.length === 0
    ) {
      throw new UnprocessableEntityException('Language mastery assessment metadata is incomplete.');
    }

    const questions: StoredAssessmentQuestion[] = [];
    const ids = new Set<string>();
    for (const value of questionsValue) {
      const question = this.record(value);
      if (
        !question
        || typeof question.id !== 'string'
        || !question.id
        || typeof question.prompt !== 'string'
        || !question.prompt.trim()
        || typeof question.points !== 'number'
        || !Number.isFinite(question.points)
        || question.points <= 0
        || ids.has(question.id)
      ) {
        throw new UnprocessableEntityException('Language mastery assessment rubric is invalid.');
      }
      ids.add(question.id);
      questions.push({ id: question.id, prompt: question.prompt, points: question.points });
    }
    return {
      metadata: metadata as unknown as StoredLanguageMasteryMetadata,
      questions,
    };
  }

  private completeLanguageRubric(
    questions: readonly StoredAssessmentQuestion[],
    answersValue: unknown,
    resultsValue: unknown,
  ): {
    rawScore: number;
    byQuestion: Map<string, StoredGradedResult>;
  } {
    if (
      !Array.isArray(answersValue)
      || answersValue.length !== questions.length
      || answersValue.some((answer) => typeof answer !== 'string' || !answer.trim())
      || !Array.isArray(resultsValue)
      || resultsValue.length !== questions.length
    ) {
      throw new UnprocessableEntityException('Language autonomy submission is incomplete.');
    }

    const questionsById = new Map(questions.map((question) => [question.id, question]));
    const byQuestion = new Map<string, StoredGradedResult>();
    let awarded = 0;
    let maximum = 0;
    for (const value of resultsValue) {
      const result = this.record(value);
      const question = typeof result?.questionId === 'string'
        ? questionsById.get(result.questionId)
        : undefined;
      if (
        !result
        || !question
        || byQuestion.has(question.id)
        || typeof result.awarded !== 'number'
        || typeof result.max !== 'number'
        || !Number.isFinite(result.awarded)
        || !Number.isFinite(result.max)
        || result.max <= 0
        || result.max !== question.points
        || result.awarded < 0
        || result.awarded > result.max
      ) {
        throw new UnprocessableEntityException('Language autonomy grading rubric is incomplete or invalid.');
      }
      const graded = {
        questionId: question.id,
        awarded: result.awarded,
        max: result.max,
      };
      byQuestion.set(question.id, graded);
      awarded += graded.awarded;
      maximum += graded.max;
    }
    if (byQuestion.size !== questions.length || maximum <= 0) {
      throw new UnprocessableEntityException('Language autonomy grading rubric is incomplete or invalid.');
    }
    return { rawScore: awarded / maximum, byQuestion };
  }

  private async requireLanguageMilestoneMastery(
    userId: string,
    masteryValue: unknown,
    unitId: string,
    attemptId: string,
    assessmentId: string,
    rawScore: number,
    lesson: { id: string; contentVersion: number; exercises: Prisma.JsonValue },
  ): Promise<void> {
    const milestone = this.record(masteryValue);
    if (
      !milestone
      || milestone.unitId !== unitId
      || milestone.status !== 'mastered'
      || typeof milestone.masteredAt !== 'string'
      || !Number.isFinite(new Date(milestone.masteredAt).getTime())
    ) {
      throw new UnprocessableEntityException('The language milestone is not mastered.');
    }

    const training = this.languageTrainingEvidence(milestone.trainingEvidence);
    if (missingLanguageTrainingFormats(training).length > 0) {
      throw new UnprocessableEntityException('Required language training is incomplete.');
    }
    await this.requireVersionedLanguageTraining(userId, lesson, training);

    if (!Array.isArray(milestone.attempts)) {
      throw new UnprocessableEntityException('Language autonomy attempt is missing.');
    }
    const attempt = milestone.attempts
      .map((value) => this.record(value))
      .find((value) => value?.id === attemptId);
    const decision = this.languageMasteryDecision(attempt?.decision);
    if (
      !attempt
      || attempt.assessmentId !== assessmentId
      || attempt.status !== 'evaluated'
      || attempt.helpUsed !== false
      || attempt.answerLeak !== false
      || !decision
      || decision.policyVersion !== LANGUAGE_MASTERY_POLICY_VERSION
      || decision.verdict !== 'mastered'
      || decision.trainingComplete !== true
      || decision.missingTrainingFormats.length !== 0
      || decision.helpUsed !== false
      || decision.rawScore === null
      || !Number.isFinite(decision.rawScore)
      || decision.rawScore < LANGUAGE_MASTERY_THRESHOLD
      || decision.threshold !== LANGUAGE_MASTERY_THRESHOLD
      || Math.abs(decision.rawScore - rawScore) > 1e-12
    ) {
      throw new UnprocessableEntityException('Language mastery decision does not match this submission.');
    }
  }

  /** Bind every claimed training completion to the exact generated lesson and
   * content version. Ordinary formats must reference their canonical attempt;
   * pronunciation remains audio-native evidence and can never be substituted
   * by a text/STT attempt. */
  private async requireVersionedLanguageTraining(
    userId: string,
    lesson: { id: string; contentVersion: number; exercises: Prisma.JsonValue },
    training: readonly LanguageTrainingEvidence[],
  ): Promise<void> {
    const knownFormats = new Set<string>(LANGUAGE_TRAINING_FORMATS);
    const exercises = Array.isArray(lesson.exercises)
      ? lesson.exercises.map((value, exerciseIndex) => {
          const item = this.record(value);
          const format = typeof item?.languageFormat === 'string'
            && knownFormats.has(item.languageFormat)
            ? item.languageFormat as LanguageTrainingFormat
            : null;
          return format ? { exerciseIndex, format } : null;
        }).filter((value): value is { exerciseIndex: number; format: LanguageTrainingFormat } => Boolean(value))
      : [];
    if (
      exercises.length < LANGUAGE_TRAINING_FORMATS.length
      || missingLanguageTrainingFormats(exercises.map(({ exerciseIndex, format }) => ({
        id: 'declared:' + exerciseIndex,
        format,
        state: 'completed' as const,
        helpUsed: false,
      }))).length > 0
    ) {
      throw new UnprocessableEntityException('The versioned language training battery is incomplete.');
    }

    const evidenceByIndex = new Map<number, LanguageTrainingEvidence>();
    for (const item of training) {
      if (
        item.state !== 'completed'
        || item.lessonId !== lesson.id
        || item.contentVersion !== lesson.contentVersion
        || !Number.isInteger(item.exerciseIndex)
        || item.exerciseIndex! < 0
        || evidenceByIndex.has(item.exerciseIndex!)
      ) {
        throw new UnprocessableEntityException('Language training provenance is incomplete or invalid.');
      }
      evidenceByIndex.set(item.exerciseIndex!, item);
    }
    if (evidenceByIndex.size !== exercises.length) {
      throw new UnprocessableEntityException('Language training provenance is incomplete or invalid.');
    }

    const attemptIds: string[] = [];
    for (const exercise of exercises) {
      const evidence = evidenceByIndex.get(exercise.exerciseIndex);
      if (!evidence || evidence.format !== exercise.format) {
        throw new UnprocessableEntityException('Language training provenance is incomplete or invalid.');
      }
      if (exercise.format === 'voice-pronunciation') {
        if (
          evidence.source !== 'audio-native-coaching'
          || evidence.sourceId !== ['lesson', lesson.id, 'voice', exercise.exerciseIndex].join(':')
        ) {
          throw new UnprocessableEntityException('Pronunciation requires audio-native training evidence.');
        }
      } else {
        if (evidence.source !== 'exercise-attempt' || !evidence.sourceId) {
          throw new UnprocessableEntityException('Language training attempt provenance is missing.');
        }
        attemptIds.push(evidence.sourceId);
      }
    }

    const attempts = attemptIds.length > 0
      ? await this.prisma.exerciseAttempt.findMany({
          where: {
            id: { in: [...new Set(attemptIds)] },
            userId,
            lessonId: lesson.id,
            contentVersion: lesson.contentVersion,
          },
          select: { id: true, exerciseIndex: true },
        })
      : [];
    const attemptIndexById = new Map(attempts.map((attempt) => [attempt.id, attempt.exerciseIndex]));
    for (const exercise of exercises) {
      if (exercise.format === 'voice-pronunciation') continue;
      const evidence = evidenceByIndex.get(exercise.exerciseIndex)!;
      if (attemptIndexById.get(evidence.sourceId!) !== exercise.exerciseIndex) {
        throw new UnprocessableEntityException('Language training attempt provenance is invalid.');
      }
    }
  }

  private languageTrainingEvidence(value: unknown): LanguageTrainingEvidence[] {
    if (!Array.isArray(value)) return [];
    const formats = new Set<string>(LANGUAGE_TRAINING_FORMATS);
    const states = new Set(['completed', 'incomplete', 'technical-error', 'not-evaluable']);
    return value.flatMap((entry) => {
      const item = this.record(entry);
      return item
        && typeof item.id === 'string'
        && typeof item.format === 'string'
        && formats.has(item.format)
        && typeof item.state === 'string'
        && states.has(item.state)
        && typeof item.helpUsed === 'boolean'
        ? [item as unknown as LanguageTrainingEvidence]
        : [];
    });
  }

  private languageMasteryDecision(value: unknown): LanguageMasteryDecision | null {
    const decision = this.record(value);
    if (
      !decision
      || typeof decision.policyVersion !== 'string'
      || typeof decision.verdict !== 'string'
      || typeof decision.trainingComplete !== 'boolean'
      || !Array.isArray(decision.missingTrainingFormats)
      || (decision.rawScore !== null && typeof decision.rawScore !== 'number')
      || typeof decision.threshold !== 'number'
      || typeof decision.helpUsed !== 'boolean'
    ) return null;
    return decision as unknown as LanguageMasteryDecision;
  }

  private record(value: unknown): Record<string, unknown> | null {
    return value && !Array.isArray(value) && typeof value === 'object'
      ? value as Record<string, unknown>
      : null;
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
        typeof evidence.id === 'string'
        && typeof evidence.canDoId === 'string'
        && typeof evidence.source === 'string'
        && typeof evidence.sourceId === 'string'
        && (
          evidence.result === 'demonstrated'
          || evidence.result === 'not-demonstrated'
        )
        && typeof evidence.observedAt === 'string'
        && typeof evidence.observation === 'string'
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
