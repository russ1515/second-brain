import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  LearningDeletionCounts,
  LearningDeletionPreview,
  LearningDeletionResult,
  WorkspaceSourceReference,
} from '@second-brain/shared';
import { accountDataLockKey } from '../common/account-data-lock';
import { PrismaService } from '../prisma/prisma.service';
import { QdrantService } from '../qdrant/qdrant.service';
import { DOCUMENT_CHUNKS_COLLECTION } from '../qdrant/qdrant.constants';
import { CacheService } from '../redis/cache.service';

interface WorkspaceSourceUpdate {
  id: string;
  sources: WorkspaceSourceReference[];
}

type LearningDataClient = PrismaService | Prisma.TransactionClient;

interface SessionDeletionPlan {
  preview: LearningDeletionPreview;
  selectedSessionId: string | null;
  selectedTutorSessionId: string | null;
  sessionIds: string[];
  lessonIds: string[];
  tutorSessionIds: string[];
  studySessionIds: string[];
  homeworkIds: string[];
  documentIds: string[];
  completionIds: string[];
  cardIds: string[];
  candidateGoalIds: string[];
  reviewableIds: string[];
  recommendationIds: string[];
  workspaceUpdates: WorkspaceSourceUpdate[];
  detachedWorkspaceIds: string[];
  remainingSessionSourceUpdates: Array<{ id: string; sourceReferences: Prisma.InputJsonValue }>;
}

const EMPTY_COUNTS = (): LearningDeletionCounts => ({
  sessions: 0,
  lessons: 0,
  tutorMessages: 0,
  studySessions: 0,
  exerciseAttempts: 0,
  homework: 0,
  reviewItems: 0,
  cards: 0,
  documentsDeleted: 0,
  workspaceReferences: 0,
  recommendations: 0,
  calendarEvents: 0,
});

/**
 * One ownership-checked operation for every lesson/session deletion entrypoint.
 * It relies only on stable ids and structured references; translated titles are
 * deliberately never used as joins.
 */
@Injectable()
export class LearningDataDeletionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly qdrant: QdrantService,
    private readonly cache: CacheService,
  ) {}

  async previewSession(userId: string, id: string): Promise<LearningDeletionPreview> {
    return (await this.planSession(userId, id)).preview;
  }

  async previewLesson(userId: string, id: string): Promise<LearningDeletionPreview> {
    return (await this.planLesson(userId, id)).preview;
  }

  async deleteSession(userId: string, id: string): Promise<LearningDeletionResult> {
    const selected = await this.prisma.experienceSession.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!selected) {
      await this.invalidateUserViews(userId, true);
      return { deleted: false, alreadyDeleted: true, preview: null };
    }
    return this.execute(userId, await this.planSession(userId, id));
  }

  /** Domain-specific Tutor deletion enters the same authoritative purge path
   * as Home/Learn instead of merely abandoning its resumable envelope. */
  async deleteTutorSession(userId: string, id: string): Promise<LearningDeletionResult> {
    const tutor = await this.prisma.tutorSession.findFirst({
      where: { id, userId },
      select: { id: true, title: true },
    });
    if (!tutor) {
      await this.invalidateUserViews(userId, true);
      return { deleted: false, alreadyDeleted: true, preview: null };
    }
    const plan = await this.buildPlan(userId, {
      target: 'experience-session',
      targetId: id,
      title: tutor.title,
      selectedSessionId: null,
      selectedTutorSessionId: id,
      lessonIds: [],
      tutorSessionIds: [id],
      studySessionIds: [],
    });
    return this.execute(userId, plan);
  }

  async deleteLesson(userId: string, id: string): Promise<LearningDeletionResult> {
    const selected = await this.prisma.lesson.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!selected) {
      await this.invalidateUserViews(userId, true);
      return { deleted: false, alreadyDeleted: true, preview: null };
    }
    return this.execute(userId, await this.planLesson(userId, id));
  }

  async previewGoal(userId: string, id: string): Promise<LearningDeletionPreview> {
    const goal = await this.prisma.goal.findFirst({ where: { id, userId } });
    if (!goal) throw new NotFoundException('Goal not found.');
    const recommendations = await this.prisma.recommendation.count({
      where: {
        userId,
        OR: [
          { targetKind: 'goal', targetId: id },
          { dedupeKey: `goal:${id}` },
        ],
      },
    });
    return {
      target: 'goal',
      id,
      title: goal.title,
      // Linked sessions are detached, not deleted. The preview reports only
      // destructive effects so completed learning is never presented as lost.
      counts: { ...EMPTY_COUNTS(), recommendations },
      sharedDocumentsPreserved: 0,
    };
  }

  async deleteGoal(userId: string, id: string): Promise<LearningDeletionResult> {
    const exists = await this.prisma.goal.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!exists) return { deleted: false, alreadyDeleted: true, preview: null };
    const preview = await this.previewGoal(userId, id);
    await this.prisma.$transaction(async (tx) => {
      const lockKey = accountDataLockKey(userId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      const owned = await tx.goal.findFirst({ where: { id, userId }, select: { id: true } });
      if (!owned) return;
      const affectedLinks = await tx.learningGoalLink.findMany({
        where: { userId, goalId: id },
        select: { experienceSessionId: true },
      });
      await tx.experienceSession.updateMany({
        where: { userId, goalId: id },
        data: { goalId: null, version: { increment: 1 } },
      });
      await tx.recommendation.deleteMany({
        where: {
          userId,
          OR: [
            { targetKind: 'goal', targetId: id },
            { dedupeKey: `goal:${id}` },
          ],
        },
      });
      // Goal removal intentionally preserves completed lessons, documents,
      // concepts and learning evidence.
      await tx.goal.deleteMany({ where: { id, userId } });
      for (const { experienceSessionId } of affectedLinks) {
        // Deleting a secondary goal must not silently replace the learner's
        // explicit primary goal with the oldest remaining link. Only promote
        // the oldest remaining goal when the deleted goal actually left the
        // learning journey without a primary.
        const currentPrimary = await tx.learningGoalLink.findFirst({
          where: { userId, experienceSessionId, isPrimary: true },
        });
        const replacement = currentPrimary ?? await tx.learningGoalLink.findFirst({
          where: { userId, experienceSessionId },
          orderBy: { createdAt: 'asc' },
        });
        if (replacement && !currentPrimary) {
          await tx.learningGoalLink.update({
            where: { id: replacement.id },
            data: { isPrimary: true },
          });
        }
        await tx.experienceSession.updateMany({
          where: { id: experienceSessionId, userId },
          data: { goalId: replacement?.goalId ?? null, version: { increment: 1 } },
        });
      }
    });
    await this.invalidateUserViews(userId, false);
    return { deleted: true, alreadyDeleted: false, preview };
  }

  private async planSession(userId: string, id: string): Promise<SessionDeletionPlan> {
    const session = await this.prisma.experienceSession.findFirst({ where: { id, userId } });
    if (!session) throw new NotFoundException('Experience session not found.');
    return this.buildPlan(userId, {
      target: 'experience-session',
      targetId: id,
      title: session.title,
      selectedSessionId: id,
      selectedTutorSessionId: null,
      lessonIds: session.lessonId ? [session.lessonId] : [],
      tutorSessionIds: session.tutorSessionId ? [session.tutorSessionId] : [],
      studySessionIds: session.studySessionId ? [session.studySessionId] : [],
    });
  }

  private async planLesson(userId: string, id: string): Promise<SessionDeletionPlan> {
    const lesson = await this.prisma.lesson.findFirst({ where: { id, userId } });
    if (!lesson) throw new NotFoundException('Lesson not found.');
    return this.buildPlan(userId, {
      target: 'lesson',
      targetId: id,
      title: lesson.topic,
      selectedSessionId: null,
      selectedTutorSessionId: null,
      lessonIds: [id],
      tutorSessionIds: [],
      studySessionIds: [],
    });
  }

  private async buildPlan(
    userId: string,
    seed: {
      target: 'experience-session' | 'lesson';
      targetId: string;
      title: string | null;
      selectedSessionId: string | null;
      selectedTutorSessionId: string | null;
      lessonIds: string[];
      tutorSessionIds: string[];
      studySessionIds: string[];
    },
    db: LearningDataClient = this.prisma,
  ): Promise<SessionDeletionPlan> {
    const lessonIds = new Set(seed.lessonIds);
    if (seed.tutorSessionIds.length) {
      const generated = await db.lesson.findMany({
        where: { userId, tutorSessionId: { in: seed.tutorSessionIds } },
        select: { id: true },
      });
      for (const row of generated) lessonIds.add(row.id);
    }

    // Study sessions derived from a lesson are exclusive activities. A study
    // session selected on its own does not delete its referenced lesson.
    const derivedStudy = lessonIds.size
      ? await db.studySession.findMany({
          where: { userId, lessonId: { in: [...lessonIds] } },
          select: { id: true },
        })
      : [];
    const studySessionIds = new Set([
      ...seed.studySessionIds,
      ...derivedStudy.map((row) => row.id),
    ]);

    const lessons = lessonIds.size
      ? await db.lesson.findMany({
          where: { userId, id: { in: [...lessonIds] } },
          select: { id: true, sourceDocumentId: true, tutorSessionId: true },
        })
      : [];
    const existingLessonIds = lessons.map((row) => row.id);

    const tutorSessionIds = new Set(seed.tutorSessionIds);
    for (const tutorSessionId of new Set(
      lessons.map((lesson) => lesson.tutorSessionId).filter((id): id is string => Boolean(id)),
    )) {
      if (tutorSessionIds.has(tutorSessionId)) continue;
      const survivingLessons = await db.lesson.count({
        where: {
          userId,
          tutorSessionId,
          ...(existingLessonIds.length ? { id: { notIn: existingLessonIds } } : {}),
        },
      });
      if (survivingLessons === 0) tutorSessionIds.add(tutorSessionId);
    }

    const sessionWhere: Prisma.ExperienceSessionWhereInput[] = [];
    if (seed.selectedSessionId) sessionWhere.push({ id: seed.selectedSessionId });
    if (existingLessonIds.length) sessionWhere.push({ lessonId: { in: existingLessonIds } });
    if (tutorSessionIds.size) sessionWhere.push({ tutorSessionId: { in: [...tutorSessionIds] } });
    if (studySessionIds.size) sessionWhere.push({ studySessionId: { in: [...studySessionIds] } });
    const linkedSessions = sessionWhere.length
      ? await db.experienceSession.findMany({
          where: { userId, OR: sessionWhere },
          select: { id: true, goalId: true },
        })
      : [];
    const sessionIds = [...new Set(linkedSessions.map((row) => row.id))];
    const legacySessionGoalIds = linkedSessions
      .map((row) => row.goalId)
      .filter((goalId): goalId is string => Boolean(goalId));

    const sourceDocumentIds = [...new Set(lessons
      .map((row) => row.sourceDocumentId)
      .filter((value): value is string => Boolean(value)))];
    const documents = sourceDocumentIds.length
      ? await db.document.findMany({
          where: { userId, id: { in: sourceDocumentIds } },
          select: { id: true, sourceRef: true, contentType: true },
        })
      : [];
    // A generated document is exclusive only when no surviving session or
    // workspace explicitly references it. Those references are user-created
    // continuity and must not silently start pointing at a trashed document.
    const [survivingSessions, workspaces] = sourceDocumentIds.length
      ? await Promise.all([
          db.experienceSession.findMany({
            where: { userId, ...(sessionIds.length ? { id: { notIn: sessionIds } } : {}) },
            select: { documentId: true, sourceReferences: true, activeContexts: true },
          }),
          db.academicWorkspace.findMany({
            where: { userId },
            select: { sources: true },
          }),
        ])
      : [[], []];
    const documentIds: string[] = [];
    let sharedDocumentsPreserved = 0;
    for (const document of documents) {
      const originatingLessonId = document.sourceRef?.startsWith('lesson:')
        ? document.sourceRef.slice('lesson:'.length)
        : null;
      const isGeneratedForDeletedLesson =
        document.contentType === 'LESSON_AI' &&
        Boolean(originatingLessonId && lessonIds.has(originatingLessonId));
      const otherReferences = await db.lesson.count({
        where: {
          userId,
          sourceDocumentId: document.id,
          id: { notIn: existingLessonIds },
        },
      });
      const referencedBySurvivingSession = survivingSessions.some((session) =>
        session.documentId === document.id ||
        jsonContainsDocumentReference(session.sourceReferences, document.id) ||
        contextContainsDocumentReference(session.activeContexts, document.id),
      );
      const referencedByWorkspace = workspaces.some((workspace) =>
        workspaceContainsDocumentReference(workspace.sources, document.id),
      );
      if (
        isGeneratedForDeletedLesson &&
        otherReferences === 0 &&
        !referencedBySurvivingSession &&
        !referencedByWorkspace
      ) {
        documentIds.push(document.id);
      } else {
        sharedDocumentsPreserved += 1;
      }
    }

    const homeworkRows = existingLessonIds.length
      ? await db.homework.findMany({
          where: { userId, lessonId: { in: existingLessonIds } },
          select: { id: true },
        })
      : [];
    const homeworkIds = homeworkRows.map((row) => row.id);
    const completionRows = sessionIds.length || existingLessonIds.length
      ? await db.learningCompletion.findMany({
          where: {
            userId,
            OR: [
              ...(existingLessonIds.length ? [{ lessonId: { in: existingLessonIds } }] : []),
              ...(sessionIds.length ? [{ experienceSessionId: { in: sessionIds } }] : []),
            ],
          },
          select: {
            id: true,
            cards: { select: { cardId: true } },
            reviewables: { select: { reviewableId: true } },
            goals: { select: { goalId: true } },
          },
        })
      : [];
    const completionIds = completionRows.map((row) => row.id);
    const completionCardIds = completionRows.flatMap((row) => row.cards.map((link) => link.cardId));
    const completionReviewableIds = completionRows.flatMap((row) => row.reviewables.map((link) => link.reviewableId));
    const canonicalGoalIds = completionRows.flatMap((row) => row.goals.map((link) => link.goalId));
    const sessionGoalIds = sessionIds.length
      ? (await db.learningGoalLink.findMany({
          where: { userId, experienceSessionId: { in: sessionIds } },
          select: { goalId: true },
        })).map((link) => link.goalId)
      : [];

    const reviewables = await db.reviewable.findMany({
      where: {
        userId,
        OR: [
          ...(existingLessonIds.length
            ? [
                { kind: 'lesson', refId: { in: existingLessonIds } },
                ...existingLessonIds.map((lessonId) => ({
                  kind: 'exercise',
                  refId: { startsWith: `${lessonId}:` },
                })),
              ]
            : []),
          ...(homeworkIds.length ? [{ kind: 'homework', refId: { in: homeworkIds } }] : []),
        ],
      },
      select: { id: true },
    });

    const [tutorMessages, exerciseAttempts, documentCards] = await Promise.all([
      tutorSessionIds.size
        ? db.tutorMessage.count({ where: { sessionId: { in: [...tutorSessionIds] } } })
        : 0,
      existingLessonIds.length
        ? db.exerciseAttempt.count({ where: { userId, lessonId: { in: existingLessonIds } } })
        : 0,
      documentIds.length
        ? db.card.findMany({
            where: { userId, sourceDocumentId: { in: documentIds } },
            select: { id: true },
          })
        : [],
    ]);
    const cardIds = [...new Set([...completionCardIds, ...documentCards.map((card) => card.id)])];
    const reviewableIds = [...new Set([
      ...reviewables.map((row) => row.id),
      ...completionReviewableIds,
    ])];
    const candidateGoalIds = [...new Set([
      ...canonicalGoalIds,
      ...sessionGoalIds,
      ...legacySessionGoalIds,
    ])];

    const recommendationRows = documentIds.length || existingLessonIds.length
      ? await db.recommendation.findMany({
          where: {
            userId,
            OR: [
              ...(documentIds.length ? [{ targetKind: 'document', targetId: { in: documentIds } }] : []),
              ...(existingLessonIds.length ? [{ targetKind: 'lesson', targetId: { in: existingLessonIds } }] : []),
              ...documentIds.map((documentId) => ({ dedupeKey: `document:${documentId}` })),
            ],
          },
          select: { id: true },
        })
      : [];

    const { updates: workspaceUpdates, removed: workspaceReferences } =
      await this.workspaceSourceUpdates(userId, documentIds, db);
    const detachedWorkspaceIds = sessionIds.length
      ? (await db.academicWorkspace.findMany({
          where: { userId, experienceSessionId: { in: sessionIds } },
          select: { id: true },
        })).map((row) => row.id)
      : [];
    const remainingSessionSourceUpdates = await this.remainingSessionSourceUpdates(
      userId,
      sessionIds,
      existingLessonIds,
      documentIds,
      db,
    );

    const counts: LearningDeletionCounts = {
      ...EMPTY_COUNTS(),
      sessions: sessionIds.length,
      lessons: existingLessonIds.length,
      tutorMessages,
      studySessions: studySessionIds.size,
      exerciseAttempts,
      homework: homeworkIds.length,
      reviewItems: reviewableIds.length,
      cards: cardIds.length,
      documentsDeleted: documentIds.length,
      workspaceReferences: workspaceReferences + detachedWorkspaceIds.length + remainingSessionSourceUpdates.length,
      recommendations: recommendationRows.length,
    };
    return {
      preview: {
        target: seed.target,
        id: seed.targetId,
        title: seed.title,
        counts,
        sharedDocumentsPreserved,
      },
      selectedSessionId: seed.selectedSessionId,
      selectedTutorSessionId: seed.selectedTutorSessionId,
      sessionIds,
      lessonIds: existingLessonIds,
      tutorSessionIds: [...tutorSessionIds],
      studySessionIds: [...studySessionIds],
      homeworkIds,
      documentIds,
      completionIds,
      cardIds,
      candidateGoalIds,
      reviewableIds,
      recommendationIds: recommendationRows.map((row) => row.id),
      workspaceUpdates,
      detachedWorkspaceIds,
      remainingSessionSourceUpdates,
    };
  }

  private async execute(userId: string, plan: SessionDeletionPlan): Promise<LearningDeletionResult> {
    let committedPlan: SessionDeletionPlan | null;
    try {
      // Commit a durable visibility barrier before touching Qdrant. If the
      // external purge succeeds but PostgreSQL later fails to commit, the
      // document remains hidden in `deleting` state instead of becoming an
      // active source whose vectors have disappeared. Retrying the same
      // deletion is safe because the target learning record still exists and
      // Qdrant document deletion is idempotent.
      await this.prisma.$transaction(async (tx) => {
        const lockKey = accountDataLockKey(userId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
        const stagedPlan = await this.rebuildPlanForExecution(userId, plan, tx);
        if (!stagedPlan?.documentIds.length) return;
        await tx.document.updateMany({
          where: { userId, id: { in: stagedPlan.documentIds } },
          data: {
            deletedAt: new Date(),
            status: 'processing',
            stage: 'deleting',
            error: null,
          },
        });
      }, { maxWait: 10_000, timeout: 120_000 });

      committedPlan = await this.prisma.$transaction(async (tx): Promise<SessionDeletionPlan | null> => {
        // The lock is deliberately held across the fresh dependency read,
        // PostgreSQL purge and idempotent Qdrant purge. All learning writers
        // use the same owner lock, so no child/reference can be inserted after
        // the final dependency snapshot and survive detached.
        const lockKey = accountDataLockKey(userId);
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;

        const freshPlan = await this.rebuildPlanForExecution(userId, plan, tx);
        if (!freshPlan) return null;

        if (freshPlan.documentIds.length) {
          await tx.document.updateMany({
            where: { userId, id: { in: freshPlan.documentIds } },
            data: {
              deletedAt: new Date(),
              status: 'processing',
              stage: 'deleting',
              error: null,
            },
          });
          await tx.documentChunk.deleteMany({ where: { documentId: { in: freshPlan.documentIds } } });
          await tx.studyResource.deleteMany({ where: { userId, documentId: { in: freshPlan.documentIds } } });
          await tx.conceptDocument.deleteMany({ where: { documentId: { in: freshPlan.documentIds } } });
          await tx.card.deleteMany({ where: { userId, sourceDocumentId: { in: freshPlan.documentIds } } });
          await tx.document.deleteMany({ where: { userId, id: { in: freshPlan.documentIds } } });
        }
        if (freshPlan.completionIds.length) {
          await tx.learningCompletion.deleteMany({ where: { userId, id: { in: freshPlan.completionIds } } });
        }
        if (freshPlan.cardIds.length) {
          await tx.card.deleteMany({
            where: {
              userId,
              id: { in: freshPlan.cardIds },
              completionLinks: { none: {} },
            },
          });
        }
        if (freshPlan.reviewableIds.length) {
          await tx.reviewable.deleteMany({ where: { userId, id: { in: freshPlan.reviewableIds } } });
        }
        if (freshPlan.recommendationIds.length) {
          await tx.recommendation.deleteMany({ where: { userId, id: { in: freshPlan.recommendationIds } } });
        }
        for (const update of freshPlan.workspaceUpdates) {
          await tx.academicWorkspace.updateMany({
            where: { id: update.id, userId },
            data: { sources: update.sources as unknown as Prisma.InputJsonValue },
          });
        }
        if (freshPlan.detachedWorkspaceIds.length) {
          await tx.academicWorkspace.updateMany({
            where: { userId, id: { in: freshPlan.detachedWorkspaceIds } },
            data: { experienceSessionId: null },
          });
        }
        for (const update of freshPlan.remainingSessionSourceUpdates) {
          await tx.experienceSession.updateMany({
            where: { id: update.id, userId },
            data: { sourceReferences: update.sourceReferences, version: { increment: 1 } },
          });
        }
        if (freshPlan.sessionIds.length) {
          await tx.experienceSession.deleteMany({ where: { userId, id: { in: freshPlan.sessionIds } } });
        }
        if (freshPlan.studySessionIds.length) {
          await tx.studySession.deleteMany({ where: { userId, id: { in: freshPlan.studySessionIds } } });
        }
        if (freshPlan.lessonIds.length) {
          await tx.lesson.deleteMany({ where: { userId, id: { in: freshPlan.lessonIds } } });
        }
        if (freshPlan.tutorSessionIds.length) {
          await tx.tutorSession.deleteMany({ where: { userId, id: { in: freshPlan.tutorSessionIds } } });
        }
        if (freshPlan.candidateGoalIds.length) {
          await tx.goal.deleteMany({
            where: {
              userId,
              id: { in: freshPlan.candidateGoalIds },
              experienceSessions: { none: {} },
              learningLinks: { none: {} },
              completionLinks: { none: {} },
            },
          });
        }

        // Purge the external index last. The separately committed tombstone
        // above makes both failure directions retryable: a Qdrant failure rolls
        // this SQL purge back, while a later SQL commit failure cannot expose an
        // active document without vectors.
        for (const documentId of freshPlan.documentIds) {
          await this.qdrant.deleteByDocument(DOCUMENT_CHUNKS_COLLECTION, documentId);
        }
        return freshPlan;
      }, { maxWait: 10_000, timeout: 120_000 });
    } catch (error) {
      await this.invalidateUserViews(userId, true);
      throw error;
    }

    const deleted = committedPlan !== null;
    await this.invalidateUserViews(userId, Boolean(committedPlan?.documentIds.length));
    return {
      deleted,
      alreadyDeleted: !deleted,
      preview: deleted ? committedPlan?.preview ?? plan.preview : null,
    };
  }

  private async rebuildPlanForExecution(
    userId: string,
    plan: SessionDeletionPlan,
    tx: Prisma.TransactionClient,
  ): Promise<SessionDeletionPlan | null> {
    if (plan.selectedSessionId) {
      const selected = await tx.experienceSession.findFirst({
        where: { id: plan.selectedSessionId, userId },
        select: {
          id: true,
          title: true,
          lessonId: true,
          tutorSessionId: true,
          studySessionId: true,
        },
      });
      if (!selected) return null;
      return this.buildPlan(userId, {
        target: 'experience-session',
        targetId: selected.id,
        title: selected.title,
        selectedSessionId: selected.id,
        selectedTutorSessionId: null,
        lessonIds: selected.lessonId ? [selected.lessonId] : [],
        tutorSessionIds: selected.tutorSessionId ? [selected.tutorSessionId] : [],
        studySessionIds: selected.studySessionId ? [selected.studySessionId] : [],
      }, tx);
    }
    if (plan.selectedTutorSessionId) {
      const selected = await tx.tutorSession.findFirst({
        where: { id: plan.selectedTutorSessionId, userId },
        select: { id: true, title: true },
      });
      if (!selected) return null;
      return this.buildPlan(userId, {
        target: 'experience-session',
        targetId: selected.id,
        title: selected.title,
        selectedSessionId: null,
        selectedTutorSessionId: selected.id,
        lessonIds: [],
        tutorSessionIds: [selected.id],
        studySessionIds: [],
      }, tx);
    }
    const selected = await tx.lesson.findFirst({
      where: { id: plan.preview.id, userId },
      select: { id: true, topic: true },
    });
    if (!selected) return null;
    return this.buildPlan(userId, {
      target: 'lesson',
      targetId: selected.id,
      title: selected.topic,
      selectedSessionId: null,
      selectedTutorSessionId: null,
      lessonIds: [selected.id],
      tutorSessionIds: [],
      studySessionIds: [],
    }, tx);
  }

  private async workspaceSourceUpdates(
    userId: string,
    deletedDocumentIds: readonly string[],
    db: LearningDataClient = this.prisma,
  ): Promise<{ updates: WorkspaceSourceUpdate[]; removed: number }> {
    if (!deletedDocumentIds.length) return { updates: [], removed: 0 };
    const deleted = new Set(deletedDocumentIds);
    const rows = await db.academicWorkspace.findMany({
      where: { userId },
      select: { id: true, sources: true },
    });
    const updates: WorkspaceSourceUpdate[] = [];
    let removed = 0;
    for (const row of rows) {
      const sources = readWorkspaceSources(row.sources);
      let changed = false;
      const next = sources.flatMap((source): WorkspaceSourceReference[] => {
        if (source.kind === 'document' && deleted.has(source.id)) {
          removed += 1;
          changed = true;
          return [];
        }
        if (source.kind !== 'research-source' || !source.citations?.length) return [source];
        const citations = source.citations.filter((citation) => {
          const remove = Boolean(citation.documentId && deleted.has(citation.documentId));
          if (remove) removed += 1;
          return !remove;
        });
        if (citations.length === source.citations.length) return [source];
        changed = true;
        // The saved synthesis can contain text from the removed document. Keep
        // remaining citations, but do not keep a mixed synthesis as hidden AI
        // context. If no citation survives, the research source is invalid.
        return citations.length ? [{ ...source, synthesis: undefined, citations }] : [];
      });
      if (changed) updates.push({ id: row.id, sources: next });
    }
    return { updates, removed };
  }

  private async remainingSessionSourceUpdates(
    userId: string,
    removedSessionIds: readonly string[],
    lessonIds: readonly string[],
    documentIds: readonly string[],
    db: LearningDataClient = this.prisma,
  ): Promise<Array<{ id: string; sourceReferences: Prisma.InputJsonValue }>> {
    if (!lessonIds.length && !documentIds.length) return [];
    const lessons = new Set(lessonIds);
    const documents = new Set(documentIds);
    const rows = await db.experienceSession.findMany({
      where: { userId, ...(removedSessionIds.length ? { id: { notIn: [...removedSessionIds] } } : {}) },
      select: { id: true, sourceReferences: true },
    });
    const updates: Array<{ id: string; sourceReferences: Prisma.InputJsonValue }> = [];
    for (const row of rows) {
      if (!Array.isArray(row.sourceReferences)) continue;
      const filtered = row.sourceReferences.filter((value) => {
        if (!isRecord(value) || typeof value.id !== 'string') return true;
        return !(
          (value.kind === 'lesson' && lessons.has(value.id)) ||
          (value.kind === 'document' && documents.has(value.id))
        );
      });
      if (filtered.length !== row.sourceReferences.length) {
        updates.push({ id: row.id, sourceReferences: filtered as Prisma.InputJsonValue });
      }
    }
    return updates;
  }

  private async invalidateUserViews(userId: string, research: boolean): Promise<void> {
    await Promise.all([
      this.cache.invalidate(`ai-mentor:${userId}`),
      this.cache.invalidate(`success:${userId}`),
      this.cache.invalidate(`learning-dna:${userId}`),
      this.cache.invalidate(`foresight:${userId}`),
      this.cache.invalidate(`insights-center:${userId}`),
      ...(research ? [this.cache.invalidatePrefix('research:web:')] : []),
    ]);
  }
}

function readWorkspaceSources(value: Prisma.JsonValue): WorkspaceSourceReference[] {
  if (!Array.isArray(value)) return [];
  const sources: WorkspaceSourceReference[] = [];
  for (const entry of value) {
    if (isRecord(entry) && typeof entry.kind === 'string' && typeof entry.id === 'string') {
      sources.push(entry as unknown as WorkspaceSourceReference);
    }
  }
  return sources;
}

function jsonContainsDocumentReference(value: Prisma.JsonValue, documentId: string): boolean {
  if (!Array.isArray(value)) return false;
  return value.some((entry) =>
    isRecord(entry) && entry.kind === 'document' && entry.id === documentId,
  );
}

function contextContainsDocumentReference(value: Prisma.JsonValue, documentId: string): boolean {
  if (!isRecord(value) || !Array.isArray(value.items)) return false;
  return value.items.some((entry) =>
    isRecord(entry) &&
    entry.kind === 'document' &&
    entry.referenceId === documentId,
  );
}

function workspaceContainsDocumentReference(value: Prisma.JsonValue, documentId: string): boolean {
  return readWorkspaceSources(value).some((source) => {
    if (source.kind === 'document' && source.id === documentId) return true;
    return source.kind === 'research-source' && Boolean(
      source.citations?.some((citation) => citation.documentId === documentId),
    );
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
