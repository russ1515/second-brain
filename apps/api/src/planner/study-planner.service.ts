import { Injectable } from '@nestjs/common';
import type {
  DayPlan,
  FocusWindow,
  PlanBlock,
  PlanBlockKind,
  PlanSource,
  WorkRhythm,
} from '@second-brain/shared';
import { LearningPathService } from '../concepts/learning-path.service';
import { LearnerProfileService } from '../concepts/learner-profile.service';
import { RevisionEngineService } from '../revision/revision-engine.service';
import { LearnerPassportService } from '../onboarding/learner-passport.service';
import { PrismaService } from '../prisma/prisma.service';
import { localDate, localDateString, localMinuteOfDay } from '../journey/local-time';

/** Where each focus window puts the start of the study day (local hour). */
const WINDOW_START: Record<FocusWindow, number> = {
  morning: 8,
  afternoon: 14,
  evening: 19,
  night: 21,
};

/** A block template: its kind, minutes and the route the app launches. */
interface BlockSpec {
  kind: PlanBlockKind;
  minutes: number;
  route: string | null;
  /** Only include when there is a subject concept to work on. */
  needsSubject?: boolean;
}

interface RealTarget {
  subject: string;
  route: string;
  adaptivePath: boolean;
}

/**
 * AI Study Planner (task 5.2) — the conductor.
 *
 * It generates no content. It reads the decisions already made by the other
 * engines — what's due (FSRS), when the learner focuses and how hard they work
 * (Digital Twin), what to study next respecting prerequisites (Adaptive Path +
 * Knowledge Graph + ConceptMastery) — and assembles them into one time-blocked
 * day. Nothing is stored, so every call reflects the latest state: the plan is
 * alive and changes through the day (and `replan` rebuilds it from now).
 */
@Injectable()
export class StudyPlannerService {
  constructor(
    private readonly learningPath: LearningPathService,
    private readonly profile: LearnerProfileService,
    private readonly revision: RevisionEngineService,
    private readonly learnerPassport: LearnerPassportService,
    private readonly prisma: PrismaService,
  ) {}

  /** The plan for today, starting from the learner's focus window. */
  today(userId: string): Promise<DayPlan> {
    return this.build(userId, null);
  }

  /** A live replan: rebuild the rest of the day from the current moment. */
  replan(userId: string): Promise<DayPlan> {
    return this.build(userId, new Date());
  }

  // ── internals ─────────────────────────────────────────────────────────────

  private async build(userId: string, from: Date | null): Promise<DayPlan> {
    const now = from ?? new Date();

    const passport = await this.learnerPassport.planningSignals(userId).catch(() => ({
      timezone: 'UTC',
      subjects: [],
      academicGoals: [],
      languageProfiles: [],
    }));
    const timezone = passport.timezone;
    const dayStart = localDate(now, timezone);
    const horizon = new Date(dayStart.getTime() + 14 * 86_400_000);
    const [profile, path, due, exam, calendarEvent] = await Promise.all([
      this.profile.profile(userId).catch(() => null),
      this.learningPath.next(userId).catch(() => ({ items: [] })),
      this.revision.due(userId).catch(() => []),
      this.prisma.exam.findFirst({
        where: { userId, date: { gte: dayStart, lt: horizon } },
        orderBy: [{ date: 'asc' }, { priority: 'desc' }],
        select: { subject: true },
      }).catch(() => null),
      this.prisma.calendarEvent.findFirst({
        where: { userId, date: { gte: dayStart, lt: horizon } },
        orderBy: { date: 'asc' },
        select: { title: true },
      }).catch(() => null),
    ]);

    // Adaptive Path (already prerequisite-aware via the Knowledge Graph): the
    // most actionable concept to study today.
    const pathTarget = path.items.find((i) =>
      ['at_risk', 'ready', 'in_progress'].includes(i.status),
    );
    const commitment = this.cleanSubject(exam?.subject ?? calendarEvent?.title);
    const target = this.realTarget(
      pathTarget?.name ?? null,
      commitment,
      passport.subjects[0] ?? null,
      passport.languageProfiles,
    );
    const subject = target?.subject ?? null;
    const rhythm: WorkRhythm = profile?.workRhythm ?? 'regular';
    const focus: FocusWindow = profile?.focusWindow ?? 'morning';

    // Start time: the focus-window hour, or the current time on a live replan.
    const startMinutes = from
      ? localMinuteOfDay(from, timezone)
      : WINDOW_START[focus] * 60;

    const specs = this.blockSpecs(due.length, rhythm, subject, target?.route ?? '/tutor');

    const blocks: PlanBlock[] = [];
    let cursor = startMinutes;
    for (const spec of specs) {
      if (spec.needsSubject && !subject) continue;
      blocks.push({
        start: this.hhmm(cursor),
        minutes: spec.minutes,
        kind: spec.kind,
        subject: spec.kind === 'revision' ? this.revisionSubject(due.length) : subject,
        route: spec.route,
      });
      cursor += spec.minutes;
    }
    // Closing marker.
    blocks.push({ start: this.hhmm(cursor), minutes: 0, kind: 'end', subject: null, route: null });

    return {
      date: localDateString(now, timezone),
      startsAt: this.hhmm(startMinutes),
      blocks,
      sources: this.sources(due.length, Boolean(profile), target?.adaptivePath ?? false),
      live: from !== null,
    };
  }

  /** The ordered activities of the day, scaled to how hard the learner works. */
  private blockSpecs(
    dueCount: number,
    rhythm: WorkRhythm,
    subject: string | null,
    subjectRoute: string,
  ): BlockSpec[] {
    const specs: BlockSpec[] = [];

    // 1) Revision of what's due (FSRS) — sized to the queue.
    if (dueCount > 0) {
      specs.push({
        kind: 'revision',
        minutes: this.clamp(dueCount * 3, 10, 30),
        route: '/revision-engine',
      });
    }

    if (subject) {
      // 2) Lesson → 3) Discussion, always when there's something to learn.
      specs.push({ kind: 'lesson', minutes: 20, route: subjectRoute, needsSubject: true });
      specs.push({ kind: 'discussion', minutes: 15, route: subjectRoute, needsSubject: true });
      // 4) Practical + 5) Quiz — only when the learner has the appetite for it.
      if (rhythm !== 'occasional') {
        specs.push({ kind: 'practical', minutes: 15, route: subjectRoute, needsSubject: true });
        specs.push({ kind: 'quiz', minutes: 10, route: '/revision-engine', needsSubject: true });
      }
      // 6) Summary to close the learning loop.
      specs.push({ kind: 'summary', minutes: 5, route: null, needsSubject: true });
    }

    return specs;
  }

  private revisionSubject(dueCount: number): string {
    return `${dueCount}`;
  }

  private sources(dueCount: number, hasProfile: boolean, hasAdaptiveTarget: boolean): PlanSource[] {
    const out: PlanSource[] = [];
    if (dueCount > 0) out.push('fsrs', 'learningMemory');
    if (hasProfile) out.push('digitalTwin');
    if (hasAdaptiveTarget) out.push('adaptivePath', 'knowledgeGraph', 'conceptMastery');
    return out;
  }

  /** Prefer a real dated commitment, then the prerequisite-aware path, a
   * declared Passport subject, and finally an existing language profile. No
   * topic, deadline or language is fabricated. */
  private realTarget(
    adaptiveName: string | null,
    commitment: string | null,
    declaredSubject: string | null,
    languages: Array<{ id: string; language: string; goal: string | null }>,
  ): RealTarget | null {
    if (commitment) {
      const sameAdaptiveTarget = adaptiveName
        && this.normalized(commitment).includes(this.normalized(adaptiveName));
      return {
        subject: sameAdaptiveTarget ? adaptiveName : commitment,
        route: '/tutor',
        adaptivePath: Boolean(sameAdaptiveTarget),
      };
    }
    if (adaptiveName) return { subject: adaptiveName, route: '/tutor', adaptivePath: true };
    const passportSubject = this.cleanSubject(declaredSubject);
    if (passportSubject) return { subject: passportSubject, route: '/tutor', adaptivePath: false };
    const language = languages[0];
    if (!language) return null;
    const goal = this.cleanSubject(language.goal);
    return {
      subject: goal ? `${language.language} — ${goal}` : language.language,
      route: `/languages/${language.id}`,
      adaptivePath: false,
    };
  }

  private normalized(value: string): string {
    return value.normalize('NFKD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  }

  private cleanSubject(value: string | null | undefined): string | null {
    if (!value) return null;
    const cleaned = value.replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
    return cleaned ? cleaned.slice(0, 200) : null;
  }

  private hhmm(totalMinutes: number): string {
    const m = ((totalMinutes % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}
