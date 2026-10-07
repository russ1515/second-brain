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

interface SessionDeletionPlan {
  preview: LearningDeletionPreview;
  selectedSessionId: string | null;
  sessionIds: string[];
  lessonIds: string[];
  tutorSessionIds: string[];
  studySessionIds: string[];
  homeworkIds: string[];
  documentIds: string[];
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
  documentsMovedToTrash: 0,
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
    if (!selected) return { deleted: false, alreadyDeleted: true, preview: null };
    return this.execute(userId, await this.planSession(userId, id));
  }

  async deleteLesson(userId: string, id: string): Promise<LearningDeletionResult> {
    const selected = await this.prisma.lesson.findFirst({
      where: { id, userId },
      select: { id: true },
    });
    if (!selected) return { deleted: false, alreadyDeleted: true, preview: null };
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
      reversibleDocuments: false,
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
      lessonIds: string[];
      tutorSessionIds: string[];
      studySessionIds: string[];
    },
  ): Promise<SessionDeletionPlan> {
    const lessonIds = new Set(seed.lessonIds);
    if (seed.tutorSessionIds.length) {
      const generated = await this.prisma.lesson.findMany({
        where: { userId, tutorSessionId: { in: seed.tutorSessionIds } },
        select: { id: true },
      });
      for (const row of generated) lessonIds.add(row.id);
    }

    // Study sessions derived from a lesson are exclusive activities. A study
    // session selected on its own does not delete its referenced lesson.
    const derivedStudy = lessonIds.size
      ? await this.prisma.studySession.findMany({
          where: { userId, lessonId: { in: [...lessonIds] } },
          select: { id: true },
        })
      : [];
    const studySessionIds = new Set([
      ...seed.studySessionIds,
      ...derivedStudy.map((row) => row.id),
    ]);

    const lessons = lessonIds.size
      ? await this.prisma.lesson.findMany({
          where: { userId, id: { in: [...lessonIds] } },
          select: { id: true, sourceDocumentId: true },
        })
      : [];
    const existingLessonIds = lessons.map((row) => row.id);

    const sessionWhere: Prisma.ExperienceSessionWhereInput[] = [];
    if (seed.selectedSessionId) sessionWhere.push({ id: seed.selectedSessionId });
    if (existingLessonIds.length) sessionWhere.push({ lessonId: { in: existingLessonIds } });
    if (seed.tutorSessionIds.length) sessionWhere.push({ tutorSessionId: { in: seed.tutorSessionIds } });
    if (studySessionIds.size) sessionWhere.push({ studySessionId: { in: [...studySessionIds] } });
    const linkedSessions = sessionWhere.length
      ? await this.prisma.experienceSession.findMany({
          where: { userId, OR: sessionWhere },
          select: { id: true },
        })
      : [];
    const sessionIds = [...new Set(linkedSessions.map((row) => row.id))];

    const sourceDocumentIds = [...new Set(lessons
      .map((row) => row.sourceDocumentId)
      .filter((value): value is string => Boolean(value)))];
    const documents = sourceDocumentIds.length
      ? await this.prisma.document.findMany({
          where: { userId, id: { in: sourceDocumentIds } },
          select: { id: true, sourceRef: true, contentType: true },
        })
      : [];
    // A generated document is exclusive only when no surviving session or
    // workspace explicitly references it. Those references are user-created
    // continuity and must not silently start pointing at a trashed document.
    const [survivingSessions, workspaces] = sourceDocumentIds.length
      ? await Promise.all([
          this.prisma.experienceSession.findMany({
            where: { userId, ...(sessionIds.length ? { id: { notIn: sessionIds } } : {}) },
            select: { documentId: true, sourceReferences: true },
          }),
          this.prisma.academicWorkspace.findMany({
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
      const otherReferences = await this.prisma.lesson.count({
        where: {
          userId,
          sourceDocumentId: document.id,
          id: { notIn: existingLessonIds },
        },
      });
      const referencedBySurvivingSession = survivingSessions.some((session) =>
        session.documentId === document.id ||
        jsonContainsDocumentReference(session.sourceReferences, document.id),
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
      ? await this.prisma.homework.findMany({
          where: { userId, lessonId: { in: existingLessonIds } },
          select: { id: true },
        })
      : [];
    const homeworkIds = homeworkRows.map((row) => row.id);
    const reviewables = await this.prisma.reviewable.findMany({
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

    const [tutorMessages, exerciseAttempts, cards] = await Promise.all([
      seed.tutorSessionIds.length
        ? this.prisma.tutorMessage.count({ where: { sessionId: { in: seed.tutorSessionIds } } })
        : 0,
      existingLessonIds.length
        ? this.prisma.exerciseAttempt.count({ where: { userId, lessonId: { in: existingLessonIds } } })
        : 0,
      documentIds.length
        ? this.prisma.card.count({ where: { userId, sourceDocumentId: { in: documentIds } } })
        : 0,
    ]);

    const recommendationRows = documentIds.length || existingLessonIds.length
      ? await this.prisma.recommendation.findMany({
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
      await this.workspaceSourceUpdates(userId, documentIds);
    const detachedWorkspaceIds = sessionIds.length
      ? (await this.prisma.academicWorkspace.findMany({
          where: { userId, experienceSessionId: { in: sessionIds } },
          select: { id: true },
        })).map((row) => row.id)
      : [];
    const remainingSessionSourceUpdates = await this.remainingSessionSourceUpdates(
      userId,
      sessionIds,
      existingLessonIds,
      documentIds,
    );

    const counts: LearningDeletionCounts = {
      ...EMPTY_COUNTS(),
      sessions: sessionIds.length,
      lessons: existingLessonIds.length,
      tutorMessages,
      studySessions: studySessionIds.size,
      exerciseAttempts,
      homework: homeworkIds.length,
      reviewItems: reviewables.length,
      cards,
      documentsMovedToTrash: documentIds.length,
      workspaceReferences: workspaceReferences + detachedWorkspaceIds.length + remainingSessionSourceUpdates.length,
      recommendations: recommendationRows.length,
    };
    return {
      preview: {
        target: seed.target,
        id: seed.targetId,
        title: seed.title,
        counts,
        reversibleDocuments: documentIds.length > 0,
        sharedDocumentsPreserved,
      },
      selectedSessionId: seed.selectedSessionId,
      sessionIds,
      lessonIds: existingLessonIds,
      tutorSessionIds: seed.tutorSessionIds,
      studySessionIds: [...studySessionIds],
      homeworkIds,
      documentIds,
      reviewableIds: reviewables.map((row) => row.id),
      recommendationIds: recommendationRows.map((row) => row.id),
      workspaceUpdates,
      detachedWorkspaceIds,
      remainingSessionSourceUpdates,
    };
  }

  private async execute(userId: string, plan: SessionDeletionPlan): Promise<LearningDeletionResult> {
    // Remove vectors first. This operation is idempotent and no database row is
    // hidden until every external index accepted the deletion.
    for (const documentId of plan.documentIds) {
      await this.qdrant.deleteByDocument(DOCUMENT_CHUNKS_COLLECTION, documentId);
    }

    let deleted = false;
    await this.prisma.$transaction(async (tx) => {
      const lockKey = accountDataLockKey(userId);
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${lockKey}, 0))`;
      if (plan.selectedSessionId) {
        const selected = await tx.experienceSession.findFirst({
          where: { id: plan.selectedSessionId, userId },
          select: { id: true },
        });
        if (!selected) return;
      } else {
        const selected = await tx.lesson.findFirst({
          where: { id: plan.preview.id, userId },
          select: { id: true },
        });
        if (!selected) return;
      }

      const now = new Date();
      if (plan.documentIds.length) {
        // Visibility barrier: active Library/RAG/Professor queries all require
        // deletedAt=null. Restore remains explicit through the existing Trash.
        await tx.document.updateMany({
          where: { userId, id: { in: plan.documentIds } },
          data: { deletedAt: now },
        });
        await tx.documentChunk.deleteMany({ where: { documentId: { in: plan.documentIds } } });
        await tx.studyResource.deleteMany({ where: { userId, documentId: { in: plan.documentIds } } });
        await tx.conceptDocument.deleteMany({ where: { documentId: { in: plan.documentIds } } });
        await tx.card.deleteMany({ where: { userId, sourceDocumentId: { in: plan.documentIds } } });
      }
      if (plan.reviewableIds.length) {
        await tx.reviewable.deleteMany({ where: { userId, id: { in: plan.reviewableIds } } });
      }
      if (plan.recommendationIds.length) {
        await tx.recommendation.deleteMany({ where: { userId, id: { in: plan.recommendationIds } } });
      }
      for (const update of plan.workspaceUpdates) {
        await tx.academicWorkspace.updateMany({
          where: { id: update.id, userId },
          data: { sources: update.sources as unknown as Prisma.InputJsonValue },
        });
      }
      if (plan.detachedWorkspaceIds.length) {
        await tx.academicWorkspace.updateMany({
          where: { userId, id: { in: plan.detachedWorkspaceIds } },
          data: { experienceSessionId: null },
        });
      }
      for (const update of plan.remainingSessionSourceUpdates) {
        await tx.experienceSession.updateMany({
          where: { id: update.id, userId },
          data: { sourceReferences: update.sourceReferences, version: { increment: 1 } },
        });
      }
      if (plan.sessionIds.length) {
        await tx.experienceSession.deleteMany({ where: { userId, id: { in: plan.sessionIds } } });
      }
      if (plan.studySessionIds.length) {
        await tx.studySession.deleteMany({ where: { userId, id: { in: plan.studySessionIds } } });
      }
      if (plan.lessonIds.length) {
        // Attempts and Homework are relational children with Cascade; shared
        // concepts, collections and imported documents are SetNull/preserved.
        await tx.lesson.deleteMany({ where: { userId, id: { in: plan.lessonIds } } });
      }
      if (plan.tutorSessionIds.length) {
        await tx.tutorSession.deleteMany({ where: { userId, id: { in: plan.tutorSessionIds } } });
      }
      deleted = true;
    });

    if (deleted) await this.invalidateUserViews(userId, plan.documentIds.length > 0);
    return {
      deleted,
      alreadyDeleted: !deleted,
      preview: deleted ? plan.preview : null,
    };
  }

  private async workspaceSourceUpdates(
    userId: string,
    deletedDocumentIds: readonly string[],
  ): Promise<{ updates: WorkspaceSourceUpdate[]; removed: number }> {
    if (!deletedDocumentIds.length) return { updates: [], removed: 0 };
    const deleted = new Set(deletedDocumentIds);
    const rows = await this.prisma.academicWorkspace.findMany({
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
  ): Promise<Array<{ id: string; sourceReferences: Prisma.InputJsonValue }>> {
    if (!lessonIds.length && !documentIds.length) return [];
    const lessons = new Set(lessonIds);
    const documents = new Set(documentIds);
    const rows = await this.prisma.experienceSession.findMany({
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
