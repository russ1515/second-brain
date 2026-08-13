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

    const [profile, path, due] = await Promise.all([
      this.profile.profile(userId).catch(() => null),
      this.learningPath.next(userId).catch(() => ({ items: [] })),
      this.revision.due(userId).catch(() => []),
    ]);

    // Adaptive Path (already prerequisite-aware via the Knowledge Graph): the
    // most actionable concept to study today.
    const target = path.items.find((i) =>
      ['at_risk', 'ready', 'in_progress'].includes(i.status),
    );
    const subject = target?.name ?? null;
    const rhythm: WorkRhythm = profile?.workRhythm ?? 'regular';
    const focus: FocusWindow = profile?.focusWindow ?? 'morning';

    // Start time: the focus-window hour, or the current time on a live replan.
    const startMinutes = from
      ? from.getHours() * 60 + from.getMinutes()
      : WINDOW_START[focus] * 60;

    const specs = this.blockSpecs(due.length, rhythm, subject);

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
      date: this.dateKey(now),
      startsAt: this.hhmm(startMinutes),
      blocks,
      sources: this.sources(due.length, !!subject),
      live: from !== null,
    };
  }

  /** The ordered activities of the day, scaled to how hard the learner works. */
  private blockSpecs(dueCount: number, rhythm: WorkRhythm, subject: string | null): BlockSpec[] {
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
      specs.push({ kind: 'lesson', minutes: 20, route: '/tutor', needsSubject: true });
      specs.push({ kind: 'discussion', minutes: 15, route: '/tutor', needsSubject: true });
      // 4) Practical + 5) Quiz — only when the learner has the appetite for it.
      if (rhythm !== 'occasional') {
        specs.push({ kind: 'practical', minutes: 15, route: '/tutor', needsSubject: true });
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

  private sources(dueCount: number, hasSubject: boolean): PlanSource[] {
    const out: PlanSource[] = ['digitalTwin', 'learningMemory'];
    if (dueCount > 0) out.unshift('fsrs');
    if (hasSubject) out.push('adaptivePath', 'knowledgeGraph', 'conceptMastery');
    return out;
  }

  private hhmm(totalMinutes: number): string {
    const m = ((totalMinutes % 1440) + 1440) % 1440;
    const h = Math.floor(m / 60);
    const min = m % 60;
    return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  private dateKey(d: Date): string {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(
      d.getDate(),
    ).padStart(2, '0')}`;
  }

  private clamp(v: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, v));
  }
}
