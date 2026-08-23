import { BadRequestException, Injectable } from '@nestjs/common';
import type { CoachProfile } from '@prisma/client';
import type {
  CoachAccompaniment,
  CoachDifficulty,
  CoachMethod,
  CoachPace,
  CoachPlan,
  CoachSetting,
  UpdateCoachRequest,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../concepts/mastery.service';
import { MentorService } from '../mentor/mentor.service';
import { LocalizationService } from '../localization/localization.service';

const PACES: CoachPace[] = ['gentle', 'steady', 'intensive'];
const DIFFICULTIES: CoachDifficulty[] = ['beginner', 'intermediate', 'advanced'];
const METHODS: CoachMethod[] = ['practice', 'reading', 'socratic', 'mixed'];

const MIN_SESSION = 10;
const MAX_SESSION = 45;
const DEFAULT_SESSION = 20;
/** Below this exercise accuracy the learner needs consolidation, not new ground. */
const SHAKY_ACCURACY = 0.6;
const STRONG_MASTERY = 0.8;
const WEAK_MASTERY = 0.5;

/** The auto-derived guidance, before overrides, with a reason per dimension. */
interface Derived {
  pace: CoachPace;
  difficulty: CoachDifficulty;
  sessionMinutes: number;
  method: CoachMethod;
  reasons: Record<'pace' | 'difficulty' | 'sessionMinutes' | 'method', string>;
}

/**
 * Personalized Academic Coach (Sprint 9.2).
 *
 * A coach that becomes UNIQUE to each learner. It ADAPTS four dimensions of how
 * they study — pace, difficulty, session length, pedagogical method — from real
 * behaviour, and ACCOMPANIES their goals / motivation / discipline / habits /
 * progression. It is a separate, replaceable engine that COMPOSES the twin
 * (MasteryService), the mentor's streak (MentorService) and the learner's raw
 * study signals; it duplicates none of their logic.
 *
 * Every automatic value is RECORDED on the CoachProfile with its rationale
 * (traceability + explainability). A learner OVERRIDE is a user decision that is
 * kept distinct from — and takes precedence over — the coach's recommendation.
 */
@Injectable()
export class AcademicCoachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly mentor: MentorService,
    private readonly localization: LocalizationService,
  ) {}

  /** The learner's live, personalised plan (recomputed and re-recorded). */
  async plan(userId: string, now = new Date()): Promise<CoachPlan> {
    const [accompaniment, derived] = await this.observe(userId, now);
    const profile = await this.record(userId, derived);
    return this.localize(userId, this.toPlan(profile, derived, accompaniment));
  }

  /** Translate the plan's prose (headline + each dimension's reason) into the
   *  learner's Learning Locale; enum values/labels are localized by the UI. */
  private async localize(userId: string, plan: CoachPlan): Promise<CoachPlan> {
    const tr = await this.localization.localizeForUser(userId, [
      plan.headline,
      plan.pace.reason,
      plan.difficulty.reason,
      plan.sessionMinutes.reason,
      plan.method.reason,
    ]);
    return {
      ...plan,
      headline: tr[0],
      pace: { ...plan.pace, reason: tr[1] },
      difficulty: { ...plan.difficulty, reason: tr[2] },
      sessionMinutes: { ...plan.sessionMinutes, reason: tr[3] },
      method: { ...plan.method, reason: tr[4] },
    };
  }

  /**
   * Apply the learner's own overrides (a user decision). Omitted fields are left
   * as-is; `reset` hands every dimension back to the coach. Returns the fresh plan.
   */
  async update(userId: string, dto: UpdateCoachRequest, now = new Date()): Promise<CoachPlan> {
    const [accompaniment, derived] = await this.observe(userId, now);
    // Ensure a row exists (records the current auto guidance too).
    await this.record(userId, derived);

    const data: Record<string, unknown> = {};
    if (dto.reset) {
      data.paceOverride = null;
      data.difficultyOverride = null;
      data.sessionMinutesOverride = null;
      data.methodOverride = null;
    }
    if (dto.pace !== undefined) data.paceOverride = this.oneOf(dto.pace, PACES, 'pace');
    if (dto.difficulty !== undefined)
      data.difficultyOverride = this.oneOf(dto.difficulty, DIFFICULTIES, 'difficulty');
    if (dto.method !== undefined) data.methodOverride = this.oneOf(dto.method, METHODS, 'method');
    if (dto.sessionMinutes !== undefined) {
      if (!Number.isFinite(dto.sessionMinutes)) {
        throw new BadRequestException('sessionMinutes must be a number.');
      }
      data.sessionMinutesOverride = Math.min(
        MAX_SESSION,
        Math.max(MIN_SESSION, Math.round(dto.sessionMinutes)),
      );
    }

    const profile = await this.prisma.coachProfile.update({ where: { userId }, data });
    return this.localize(userId, this.toPlan(profile, derived, accompaniment));
  }

  // ── observation (all reused engines) ──────────────────────────────────────

  private async observe(
    userId: string,
    now: Date,
  ): Promise<[CoachAccompaniment, Derived]> {
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const [twin, streak, goals, doneGoals, sessionsLast7, sessions, attempts] =
      await Promise.all([
        this.mastery.twin(userId).catch(() => null),
        this.mentor.streak(userId, now),
        this.prisma.goal.count({ where: { userId } }),
        this.prisma.goal.count({ where: { userId, status: 'done' } }),
        this.prisma.studySession.count({
          where: { userId, status: 'done', completedAt: { gte: weekAgo } },
        }),
        this.prisma.studySession.findMany({
          where: { userId, status: 'done', completedAt: { not: null } },
          select: { startedAt: true, completedAt: true },
          orderBy: { completedAt: 'desc' },
          take: 30,
        }),
        this.prisma.exerciseAttempt.findMany({
          where: { userId },
          select: { correct: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

    const averageMastery = twin?.summary.averageMastery ?? null;
    const mastered = twin?.summary.strongConcepts ?? 0;
    const tracked = twin?.summary.trackedConcepts ?? 0;

    const attemptCount = attempts.length;
    const accuracy =
      attemptCount > 0 ? attempts.filter((a) => a.correct).length / attemptCount : null;

    const discipline: CoachAccompaniment['discipline'] =
      streak.current >= 5 ? 'strong' : streak.current >= 2 ? 'building' : 'irregular';

    const accompaniment: CoachAccompaniment = {
      streak: {
        current: streak.current,
        longest: streak.longest,
        studiedToday: streak.studiedToday,
      },
      discipline,
      sessionsLast7,
      goals: { total: goals, done: doneGoals },
      progression: {
        averageMastery: averageMastery === null ? null : Math.round(averageMastery * 100),
        mastered,
        tracked,
      },
    };

    const derived = this.derive({
      averageMastery,
      tracked,
      accuracy,
      attemptCount,
      currentStreak: streak.current,
      sessionDurations: sessions.map((s) =>
        s.completedAt ? (s.completedAt.getTime() - s.startedAt.getTime()) / 60_000 : 0,
      ),
    });

    return [accompaniment, derived];
  }

  // ── the adaptation rules (each one explicable) ────────────────────────────

  private derive(input: {
    averageMastery: number | null;
    tracked: number;
    accuracy: number | null;
    attemptCount: number;
    currentStreak: number;
    sessionDurations: number[];
  }): Derived {
    const { averageMastery, tracked, accuracy, attemptCount, currentStreak } = input;

    // Difficulty — pitched at the twin's mastery band (same bands as the twin).
    let difficulty: CoachDifficulty;
    let difficultyReason: string;
    if (averageMastery === null) {
      difficulty = 'beginner';
      difficultyReason = 'Nothing tracked yet — starting at beginner level.';
    } else if (averageMastery >= STRONG_MASTERY) {
      difficulty = 'advanced';
      difficultyReason = `Your average mastery is ${Math.round(averageMastery * 100)}% — you can handle advanced material.`;
    } else if (averageMastery >= WEAK_MASTERY) {
      difficulty = 'intermediate';
      difficultyReason = `Your average mastery is ${Math.round(averageMastery * 100)}% — intermediate is the right stretch.`;
    } else {
      difficulty = 'beginner';
      difficultyReason = `Your average mastery is ${Math.round(averageMastery * 100)}% — let's rebuild the basics first.`;
    }

    // Pace — consolidate when shaky, push when solid AND consistent.
    const shaky =
      (averageMastery !== null && averageMastery < WEAK_MASTERY) ||
      (accuracy !== null && attemptCount >= 3 && accuracy < WEAK_MASTERY);
    let pace: CoachPace;
    let paceReason: string;
    if (shaky) {
      pace = 'gentle';
      paceReason = "You're finding this hard right now, so I'll slow the pace and consolidate.";
    } else if (currentStreak >= 3 && averageMastery !== null && averageMastery >= 0.7) {
      pace = 'intensive';
      paceReason = `A ${currentStreak}-day streak and solid mastery — you can take on more.`;
    } else {
      pace = 'steady';
      paceReason = 'A steady pace fits where you are — consistent, not rushed.';
    }

    // Method — where the learner needs to spend effort.
    let method: CoachMethod;
    let methodReason: string;
    if (tracked === 0) {
      method = 'reading';
      methodReason = "You're just starting — read and absorb the material first.";
    } else if (accuracy !== null && attemptCount >= 3 && accuracy < SHAKY_ACCURACY) {
      method = 'practice';
      methodReason = `Your exercises are landing at ${Math.round(accuracy * 100)}% — more practice will fix that.`;
    } else if (averageMastery !== null && averageMastery >= STRONG_MASTERY) {
      method = 'socratic';
      methodReason = 'You know this well — I’ll question you to deepen it rather than re-explain.';
    } else {
      method = 'mixed';
      methodReason = 'A mix of explanation and practice suits your current level.';
    }

    // Session length — anchored to the learner's real median session.
    const durations = input.sessionDurations.filter((d) => d > 0.5 && d < 180);
    let sessionMinutes: number;
    let sessionReason: string;
    if (durations.length >= 3) {
      const median = this.median(durations);
      sessionMinutes = Math.min(MAX_SESSION, Math.max(MIN_SESSION, Math.round(median)));
      sessionReason = `Your sessions typically run about ${Math.round(median)} min — I’ll plan around that.`;
    } else {
      sessionMinutes = DEFAULT_SESSION;
      sessionReason = `Starting at ${DEFAULT_SESSION} min until I learn your rhythm.`;
    }

    return {
      pace,
      difficulty,
      sessionMinutes,
      method,
      reasons: {
        pace: paceReason,
        difficulty: difficultyReason,
        sessionMinutes: sessionReason,
        method: methodReason,
      },
    };
  }

  // ── persistence (traceability record) ─────────────────────────────────────

  private record(userId: string, d: Derived): Promise<CoachProfile> {
    const base = {
      pace: d.pace,
      difficulty: d.difficulty,
      sessionMinutes: d.sessionMinutes,
      method: d.method,
      rationale: d.reasons as unknown as object,
    };
    return this.prisma.coachProfile.upsert({
      where: { userId },
      create: { userId, ...base },
      update: base,
    });
  }

  // ── view assembly (override precedence + source labelling) ────────────────

  private toPlan(
    profile: CoachProfile,
    derived: Derived,
    accompaniment: CoachAccompaniment,
  ): CoachPlan {
    const pace = this.setting<CoachPace>(
      profile.paceOverride as CoachPace | null,
      derived.pace,
      derived.reasons.pace,
    );
    const difficulty = this.setting<CoachDifficulty>(
      profile.difficultyOverride as CoachDifficulty | null,
      derived.difficulty,
      derived.reasons.difficulty,
    );
    const sessionMinutes = this.setting<number>(
      profile.sessionMinutesOverride,
      derived.sessionMinutes,
      derived.reasons.sessionMinutes,
    );
    const method = this.setting<CoachMethod>(
      profile.methodOverride as CoachMethod | null,
      derived.method,
      derived.reasons.method,
    );

    return {
      headline: this.headline(pace.value, difficulty.value, method.value, accompaniment),
      pace,
      difficulty,
      sessionMinutes,
      method,
      accompaniment,
      updatedAt: profile.updatedAt.toISOString(),
    };
  }

  private setting<T>(override: T | null | undefined, auto: T, reason: string): CoachSetting<T> {
    if (override !== null && override !== undefined) {
      return { value: override, source: 'you', reason: 'You set this yourself.' };
    }
    return { value: auto, source: 'coach', reason };
  }

  private headline(
    pace: CoachPace,
    difficulty: CoachDifficulty,
    method: CoachMethod,
    a: CoachAccompaniment,
  ): string {
    const paceWord =
      pace === 'gentle' ? 'ease off' : pace === 'intensive' ? 'push forward' : 'keep a steady rhythm';
    const disc =
      a.discipline === 'strong'
        ? 'Your consistency is excellent.'
        : a.discipline === 'building'
          ? "You're building a real habit."
          : "Let's rebuild the habit, one short session at a time.";
    return `${disc} For now we'll ${paceWord} at ${difficulty} level, leaning on ${method}.`;
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  private median(values: number[]): number {
    const sorted = [...values].sort((x, y) => x - y);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  }

  private oneOf<T extends string>(value: T, allowed: T[], field: string): T {
    if (!allowed.includes(value)) {
      throw new BadRequestException(`Unsupported ${field}: ${value}`);
    }
    return value;
  }
}
