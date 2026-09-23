import { Injectable } from '@nestjs/common';
import type { LearningMemory, LearningMemoryPage, MemoryEntry, MemorySummary } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';

const TIMELINE_LIMIT = 60;
const PAGE_LIMIT_MAX = 50;

const RATING_LABEL: Record<number, string> = {
  1: 'Again',
  2: 'Hard',
  3: 'Good',
  4: 'Easy',
};

/**
 * Unified, read-only pedagogical memory. Timeline reads are deliberately
 * bounded per source; a dense learner never loads their complete history just
 * to render the first screen.
 */
@Injectable()
export class MemoryService {
  constructor(private readonly prisma: PrismaService) {}

  async timeline(userId: string): Promise<LearningMemory> {
    const page = await this.page(userId, TIMELINE_LIMIT);
    return { summary: page.summary, entries: page.entries };
  }

  async page(userId: string, requestedLimit = 20, cursor?: string | null): Promise<LearningMemoryPage> {
    const limit = Math.min(Math.max(Math.trunc(requestedLimit) || 20, 1), PAGE_LIMIT_MAX);
    const before = cursor && Number.isFinite(Date.parse(cursor)) ? new Date(cursor) : null;
    const take = limit + 1;

    const [summary, lessons, attempts, reviews, sessions, homework, reports, documents, concepts, connections] = await Promise.all([
      this.summary(userId),
      this.prisma.lesson.findMany({
        where: { userId, ...(before ? { createdAt: { lt: before } } : {}) },
        orderBy: { createdAt: 'desc' }, take,
        select: { id: true, topic: true, createdAt: true },
      }),
      this.prisma.exerciseAttempt.findMany({
        where: { userId, ...(before ? { createdAt: { lt: before } } : {}) },
        orderBy: { createdAt: 'desc' }, take,
        select: { id: true, question: true, correct: true, createdAt: true },
      }),
      this.prisma.reviewLog.findMany({
        where: { userId, ...(before ? { reviewedAt: { lt: before } } : {}) },
        orderBy: { reviewedAt: 'desc' }, take,
        select: { id: true, rating: true, reviewedAt: true, card: { select: { front: true } } },
      }),
      this.prisma.tutorSession.findMany({
        where: { userId, ...(before ? { updatedAt: { lt: before } } : {}) },
        orderBy: { updatedAt: 'desc' }, take,
        select: { id: true, title: true, subject: true, updatedAt: true, _count: { select: { messages: true } } },
      }),
      this.prisma.homework.findMany({
        where: { userId, ...(before ? { createdAt: { lt: before } } : {}) },
        orderBy: { createdAt: 'desc' }, take,
        select: { id: true, focus: true, createdAt: true, lesson: { select: { topic: true } } },
      }),
      this.prisma.studySession.findMany({
        where: { userId, status: 'done', completedAt: { not: null, ...(before ? { lt: before } : {}) } },
        orderBy: { completedAt: 'desc' }, take,
        select: { id: true, subject: true, completedAt: true },
      }),
      this.prisma.document.findMany({
        where: { userId, deletedAt: null, lessons: { none: {} }, ...(before ? { createdAt: { lt: before } } : {}) },
        orderBy: { createdAt: 'desc' }, take,
        select: { id: true, title: true, source: true, createdAt: true },
      }),
      this.prisma.concept.findMany({
        where: { userId, ...(before ? { createdAt: { lt: before } } : {}) },
        orderBy: { createdAt: 'desc' }, take,
        select: { id: true, name: true, createdAt: true },
      }),
      this.prisma.conceptEdge.findMany({
        where: { userId, ...(before ? { createdAt: { lt: before } } : {}) },
        orderBy: { createdAt: 'desc' }, take,
        select: { id: true, relation: true, createdAt: true, source: { select: { name: true } }, target: { select: { name: true } } },
      }),
    ]);

    const entries: MemoryEntry[] = [
      ...lessons.map((row) => ({ id: `lesson-${row.id}`, kind: 'lesson' as const, title: row.topic, detail: 'Lesson studied', subject: row.topic, at: row.createdAt.toISOString() })),
      ...attempts.map((row) => ({ id: `attempt-${row.id}`, kind: row.correct ? 'success' as const : 'error' as const, title: row.question, detail: row.correct ? 'Answered correctly' : 'Mistake — corrected by the Examiner', subject: null, at: row.createdAt.toISOString() })),
      ...reviews.map((row) => ({ id: `review-${row.id}`, kind: 'revision' as const, title: row.card?.front ?? 'Flashcard', detail: `Reviewed · ${RATING_LABEL[row.rating] ?? 'rated'}`, subject: null, at: row.reviewedAt.toISOString() })),
      ...sessions.map((row) => ({ id: `tutor-${row.id}`, kind: 'conversation' as const, title: row.title ?? row.subject ?? 'Discussion', detail: `${row._count.messages} messages`, subject: row.subject, at: row.updatedAt.toISOString() })),
      ...homework.map((row) => ({ id: `homework-${row.id}`, kind: 'homework' as const, title: row.lesson?.topic ?? 'Homework', detail: row.focus.slice(0, 140), subject: row.lesson?.topic ?? null, at: row.createdAt.toISOString() })),
      ...reports.filter((row) => row.completedAt).map((row) => ({ id: `report-${row.id}`, kind: 'report' as const, title: row.subject, detail: 'Study session completed', subject: row.subject, at: row.completedAt!.toISOString() })),
      ...documents.map((row) => ({ id: `doc-${row.id}`, kind: 'document' as const, title: row.title, detail: `Document studied (${row.source})`, subject: null, at: row.createdAt.toISOString() })),
      ...concepts.map((row) => ({ id: `concept-${row.id}`, kind: 'concept' as const, title: row.name, detail: 'Concept added', subject: null, at: row.createdAt.toISOString() })),
      ...connections.map((row) => ({ id: `connection-${row.id}`, kind: 'connection' as const, title: `${row.source.name} → ${row.target.name}`, detail: row.relation, subject: null, at: row.createdAt.toISOString() })),
    ].sort((a, b) => b.at.localeCompare(a.at));

    const pageEntries = entries.slice(0, limit);
    return {
      summary,
      entries: pageEntries,
      nextCursor: entries.length > limit && pageEntries.length > 0 ? pageEntries[pageEntries.length - 1]!.at : null,
    };
  }

  private async summary(userId: string): Promise<MemorySummary> {
    const [lessons, exercises, errors, revisions, conversations, homework, reports, documents, concepts, connections] = await Promise.all([
      this.prisma.lesson.count({ where: { userId } }),
      this.prisma.exerciseAttempt.count({ where: { userId } }),
      this.prisma.exerciseAttempt.count({ where: { userId, correct: false } }),
      this.prisma.reviewLog.count({ where: { userId } }),
      this.prisma.tutorSession.count({ where: { userId } }),
      this.prisma.homework.count({ where: { userId } }),
      this.prisma.studySession.count({ where: { userId, status: 'done', completedAt: { not: null } } }),
      this.prisma.document.count({ where: { userId, deletedAt: null, lessons: { none: {} } } }),
      this.prisma.concept.count({ where: { userId } }),
      this.prisma.conceptEdge.count({ where: { userId } }),
    ]);
    const successes = exercises - errors;
    return {
      lessons, exercises, errors, successes, revisions, conversations, homework, reports, documents, concepts, connections,
      total: lessons + exercises + revisions + conversations + homework + reports + documents + concepts + connections,
    };
  }
}
