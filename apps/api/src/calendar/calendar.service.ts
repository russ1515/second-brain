import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  CalendarDay,
  CalendarEntry,
  CalendarEntryKind,
  CalendarView,
  CreateCalendarEventRequest,
  ReviewableKind,
  UserEventKind,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';

const HORIZON_DAYS = 14;
const DAY_MS = 86_400_000;

/** Map a reviewable's kind to a calendar category (task 5.4's list). */
const REVIEWABLE_TO_ENTRY: Record<ReviewableKind, CalendarEntryKind> = {
  homework: 'homework',
  practical: 'practical',
  language: 'language',
  quiz: 'quiz',
  lesson: 'revision',
  exercise: 'revision',
  flashcard: 'revision',
  concept: 'revision',
  report: 'revision',
};

const USER_KINDS: UserEventKind[] = ['exam', 'objective', 'deadline'];

/**
 * Smart Calendar (task 5.4). Auto-generates the calendar by assembling every
 * dated commitment the engines already produced — FSRS reviewables (revisions,
 * homework, practicals, languages, quizzes), flashcards due, and today's AI
 * session — then overlays the learner's own events. AI entries are read-only;
 * only the learner's own can be edited. The AI keeps priority.
 */
@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  async view(userId: string): Promise<CalendarView> {
    const now = new Date();
    const start = this.startOfDay(now);
    const horizon = new Date(start.getTime() + HORIZON_DAYS * DAY_MS);

    const [reviewables, cardsDue, events] = await Promise.all([
      this.prisma.reviewable.findMany({
        where: { userId, due: { gte: start, lt: horizon } },
        select: { id: true, kind: true, title: true, due: true },
      }),
      this.prisma.card.groupBy({
        by: ['due'],
        where: { userId, due: { gte: start, lt: horizon } },
        _count: { _all: true },
      }),
      this.prisma.calendarEvent.findMany({
        where: { userId, date: { gte: start, lt: horizon } },
      }),
    ]);

    // Bucket every entry by its local day key.
    const byDay = new Map<string, CalendarEntry[]>();
    const add = (date: Date, entry: CalendarEntry) => {
      const key = this.dayKey(date);
      const list = byDay.get(key) ?? [];
      list.push(entry);
      byDay.set(key, list);
    };

    // AI — from the FSRS engine (priority, read-only).
    for (const r of reviewables) {
      add(r.due, {
        id: `rev-${r.id}`,
        kind: REVIEWABLE_TO_ENTRY[r.kind as ReviewableKind] ?? 'revision',
        title: r.title,
        source: 'ai',
        editable: false,
      });
    }
    // AI — flashcards due, one aggregate entry per day.
    const cardsByDay = new Map<string, number>();
    for (const row of cardsDue) {
      const key = this.dayKey(row.due);
      cardsByDay.set(key, (cardsByDay.get(key) ?? 0) + row._count._all);
    }
    for (const [key, count] of cardsByDay) {
      add(new Date(`${key}T12:00:00`), {
        id: `cards-${key}`,
        kind: 'revision',
        title: `${count} flashcard${count === 1 ? '' : 's'}`,
        source: 'ai',
        editable: false,
      });
    }
    // AI — today's study session.
    add(now, {
      id: 'ai-session-today',
      kind: 'aiSession',
      title: 'Daily study session',
      source: 'ai',
      editable: false,
    });

    // The learner's own events (editable).
    for (const e of events) {
      add(e.date, {
        id: e.id,
        kind: e.kind as CalendarEntryKind,
        title: e.title,
        source: 'user',
        editable: true,
      });
    }

    // Emit every day in the horizon (even empty ones) in order.
    const days: CalendarDay[] = [];
    for (let i = 0; i < HORIZON_DAYS; i++) {
      const date = new Date(start.getTime() + i * DAY_MS);
      const key = this.dayKey(date);
      days.push({
        date: key,
        today: i === 0,
        entries: (byDay.get(key) ?? []).sort((a, b) => this.rank(a) - this.rank(b)),
      });
    }
    return { days };
  }

  async createEvent(
    userId: string,
    dto: CreateCalendarEventRequest,
  ): Promise<CalendarEntry> {
    if (!USER_KINDS.includes(dto.kind)) {
      throw new BadRequestException('Unsupported event kind.');
    }
    const date = new Date(`${dto.date}T12:00:00`);
    if (Number.isNaN(date.getTime())) {
      throw new BadRequestException('Invalid date.');
    }
    const event = await this.prisma.calendarEvent.create({
      data: { userId, kind: dto.kind, title: dto.title.slice(0, 200), date },
    });
    return {
      id: event.id,
      kind: event.kind as CalendarEntryKind,
      title: event.title,
      source: 'user',
      editable: true,
    };
  }

  async deleteEvent(userId: string, id: string): Promise<void> {
    const event = await this.prisma.calendarEvent.findUnique({ where: { id } });
    if (!event || event.userId !== userId) {
      throw new NotFoundException('Event not found.');
    }
    await this.prisma.calendarEvent.delete({ where: { id } });
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** AI entries surface above the learner's within a day (AI has priority). */
  private rank(e: CalendarEntry): number {
    return e.source === 'ai' ? 0 : 1;
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private dayKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  }
}
