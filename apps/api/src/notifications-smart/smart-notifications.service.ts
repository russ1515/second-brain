import { Injectable } from '@nestjs/common';
import type {
  SmartNotification,
  SmartNotificationsView,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../concepts/mastery.service';
import { LearningPathService } from '../concepts/learning-path.service';
import { RevisionEngineService } from '../revision/revision-engine.service';

const STRONG = 0.8;
const EXAM_HORIZON_DAYS = 14;
const DAY_MS = 86_400_000;

/**
 * Smart Notifications (task 5.6). Notifications become pedagogical, never
 * generic: each is assembled from the engines and carries its justification.
 * A short review that would lift a concept's mastery by X% (from the twin), an
 * exam in N days whose plan is auto-reorganised (from the calendar + the live
 * planner), an unlocked next topic (from the learning path), or a coming recall
 * drop (from predictive revision). Read-only; it composes, never generates
 * content of its own.
 */
@Injectable()
export class SmartNotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly learningPath: LearningPathService,
    private readonly revision: RevisionEngineService,
  ) {}

  async notifications(userId: string): Promise<SmartNotificationsView> {
    const now = new Date();
    const [profile, twin, path, forecastView, exams] = await Promise.all([
      this.prisma.profile.findUnique({ where: { userId }, select: { displayName: true } }),
      this.mastery.twin(userId).catch(() => null),
      this.learningPath.next(userId).catch(() => ({ items: [] as any[] })),
      this.revision.forecasts(userId).catch(() => ({ threshold: 0, forecasts: [] })),
      this.prisma.calendarEvent.findMany({
        where: {
          userId,
          kind: 'exam',
          date: { gte: this.startOfDay(now), lt: new Date(now.getTime() + EXAM_HORIZON_DAYS * DAY_MS) },
        },
        orderBy: { date: 'asc' },
        take: 1,
      }),
    ]);

    const out: SmartNotification[] = [];

    // 1) Review — the weakest tracked concept and the mastery it would gain.
    const tracked = (twin?.concepts ?? []).filter(
      (c): c is typeof c & { mastery: number } => c.cardCount > 0 && c.mastery !== null,
    );
    const weakest = [...tracked]
      .filter((c) => c.mastery < STRONG)
      .sort((a, b) => a.mastery - b.mastery)[0];
    if (weakest && tracked.length > 0) {
      const gain = Math.max(1, Math.round(((STRONG - weakest.mastery) * 100) / tracked.length));
      out.push({
        kind: 'review',
        subject: weakest.name,
        minutes: this.clamp((weakest.dueCount || 3) * 3, 5, 20),
        percent: gain,
        route: '/revision-engine',
      });
    }

    // 2) Exam — the nearest one, whose plan the live planner keeps in step.
    if (exams[0]) {
      const days = Math.max(0, Math.ceil((exams[0].date.getTime() - now.getTime()) / DAY_MS));
      out.push({ kind: 'exam', subject: exams[0].title, days, route: '/calendar' });
    }

    // 3) Unlock — a topic whose prerequisites are now mastered ("great work…").
    const items = path.items as { name: string; status: string }[];
    const hasMastered = items.some((i) => i.status === 'mastered');
    const ready = items.find((i) => i.status === 'ready');
    if (hasMastered && ready) {
      out.push({ kind: 'unlock', nextSubject: ready.name, route: '/daily-session' });
    }

    // 4) Forecast — a recall drop coming; act before it's forgotten.
    const f = forecastView.forecasts[0];
    if (f) {
      out.push({
        kind: 'forecast',
        subject: f.title,
        days: f.daysUntil,
        percent: f.forgettingAt,
        route: '/predictions',
      });
    }

    return { greetingName: profile?.displayName ?? null, notifications: out };
  }

  private startOfDay(d: Date): Date {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}
