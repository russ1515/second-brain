import { Injectable } from '@nestjs/common';
import type {
  LearningPathItem,
  LearningPredictionView,
  PredictionKind,
  RiskLevel,
  RiskPrediction,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../concepts/mastery.service';
import { LearningPathService } from '../concepts/learning-path.service';
import { MentorService } from '../mentor/mentor.service';
import { RevisionEngineService } from '../revision/revision-engine.service';
import { CacheService } from '../redis/cache.service';
import { LocalizationService } from '../localization/localization.service';

/** Forecasts crossing their forgetting threshold within this many days count. */
const FORGETTING_HORIZON_DAYS = 7;

/** The signals every risk is derived from — gathered once, reused by all rules. */
interface Signals {
  daysSinceActive: number;
  streakCurrent: number;
  streakLongest: number;
  studiedToday: boolean;
  sessionsLast7: number;
  dueTotal: number;
  forecastSoon: number;
  atRisk: number;
  blocked: number;
  goalsPending: number;
  averageMastery: number | null;
}

/**
 * Learning Prediction Engine (Sprint 9.3).
 *
 * A separate, replaceable engine that anticipates the risks on a learner's
 * trajectory — dropout, future difficulty, overload, motivation loss, probable
 * forgetting — each as a probability with a probable cause, a recommended action
 * and the signals behind it. It COMPOSES existing engines (the twin's mastery
 * and learning path, the mentor's streak, the FSRS forecast and review queue)
 * and duplicates none of their logic. Every prediction is PERSISTED for
 * traceability; the recommended action is a recommendation, never applied
 * silently — the distinction between the AI's advice and the learner's decision
 * is kept intact.
 */
@Injectable()
export class PredictionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly learningPath: LearningPathService,
    private readonly mentor: MentorService,
    private readonly revision: RevisionEngineService,
    private readonly cache: CacheService,
    private readonly localization: LocalizationService,
  ) {}

  /** Cached 20s (Sprint 10.1); English forecast then localized per the learner's locale. */
  async forecast(userId: string, now = new Date()): Promise<LearningPredictionView> {
    const view = await this.cache.wrap(`foresight:${userId}`, 20, () =>
      this.computeForecast(userId, now),
    );
    const texts: string[] = [];
    for (const p of view.predictions) texts.push(p.cause, p.action, ...p.reasons);
    const tr = await this.localization.localizeForUser(userId, texts);
    let i = 0;
    const predictions = view.predictions.map((p) => ({
      ...p,
      cause: tr[i++],
      action: tr[i++],
      reasons: p.reasons.map(() => tr[i++]),
    }));
    const topRisk = predictions.find((p) => p.level !== 'low') ?? null;
    return { ...view, predictions, topRisk };
  }

  private async computeForecast(userId: string, now: Date): Promise<LearningPredictionView> {
    const signals = await this.gather(userId, now);
    const predictions = [
      this.dropout(signals),
      this.overload(signals),
      this.difficulty(signals),
      this.motivation(signals),
      this.forgetting(signals),
    ].sort((a, b) => b.probability - a.probability);

    await this.record(userId, predictions, signals);

    return {
      predictions,
      topRisk: predictions.find((p) => p.level !== 'low') ?? null,
      generatedAt: now.toISOString(),
    };
  }

  // ── signal gathering (all reused engines / raw reads) ─────────────────────

  private async gather(userId: string, now: Date): Promise<Signals> {
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const [twin, path, streak, forecasts, queue, goalsPending, sessionsLast7, lastActive] =
      await Promise.all([
        this.mastery.twin(userId).catch(() => null),
        this.learningPath
          .next(userId)
          .catch(() => ({ items: [] as LearningPathItem[] })),
        this.mentor.streak(userId, now),
        this.revision.forecasts(userId).catch(() => ({ forecasts: [] as { daysUntil: number }[] })),
        this.revision.queue(userId).catch(() => [] as unknown[]),
        this.prisma.goal.count({ where: { userId, status: 'pending' } }),
        this.prisma.studySession.count({
          where: { userId, status: 'done', completedAt: { gte: weekAgo } },
        }),
        this.lastActivityAt(userId),
      ]);

    const daysSinceActive =
      lastActive === null ? 999 : Math.floor((now.getTime() - lastActive.getTime()) / 86_400_000);

    return {
      daysSinceActive,
      streakCurrent: streak.current,
      streakLongest: streak.longest,
      studiedToday: streak.studiedToday,
      sessionsLast7,
      dueTotal: queue.length,
      forecastSoon: forecasts.forecasts.filter((f) => f.daysUntil <= FORGETTING_HORIZON_DAYS).length,
      atRisk: path.items.filter((i) => i.status === 'at_risk').length,
      blocked: path.items.filter((i) => i.status === 'blocked').length,
      goalsPending,
      averageMastery: twin?.summary.averageMastery ?? null,
    };
  }

  /** Most recent genuine STUDY moment (not just opening the app). */
  private async lastActivityAt(userId: string): Promise<Date | null> {
    const [review, attempt, lesson] = await Promise.all([
      this.prisma.reviewLog.findFirst({
        where: { userId },
        orderBy: { reviewedAt: 'desc' },
        select: { reviewedAt: true },
      }),
      this.prisma.exerciseAttempt.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
      this.prisma.lesson.findFirst({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true },
      }),
    ]);
    const times = [review?.reviewedAt, attempt?.createdAt, lesson?.createdAt]
      .filter((d): d is Date => d != null)
      .map((d) => d.getTime());
    return times.length ? new Date(Math.max(...times)) : null;
  }

  // ── the risk rules (each explicable, each records its signals) ─────────────

  /** Overload — the "surcharge" that fuels fatigue and dropout. */
  private overload(s: Signals): RiskPrediction {
    let p = s.dueTotal * 4 + s.forecastSoon * 3;
    if (s.sessionsLast7 >= 5) p -= 20; // keeping up relieves the pile
    p = clamp(p);
    return this.build('overload', p, {
      cause:
        s.dueTotal > 0
          ? `${s.dueTotal} reviews are due${s.forecastSoon ? ` and ${s.forecastSoon} more about to slip` : ''}.`
          : 'Your review load is light right now.',
      action:
        p >= 34
          ? "I'll trim today's plan and spread the reviews over several days."
          : 'No change needed — the load is manageable.',
      reasons: [
        `${s.dueTotal} items due for review.`,
        `${s.forecastSoon} items forecast to slip within ${FORGETTING_HORIZON_DAYS} days.`,
        `${s.sessionsLast7} study session(s) in the last 7 days.`,
      ],
    });
  }

  /** Dropout — inactivity compounded by overload (fatigue + surcharge). */
  private dropout(s: Signals): RiskPrediction {
    const inactivity =
      s.daysSinceActive >= 7 ? 85 : s.daysSinceActive >= 5 ? 70 : s.daysSinceActive >= 3 ? 55 : s.daysSinceActive >= 2 ? 30 : 10;
    const overloadPressure = Math.min(20, this.overloadScore(s) * 0.2);
    const resilience = Math.min(20, s.streakCurrent * 3);
    const p = clamp(inactivity + overloadPressure - resilience);

    const overloaded = this.overloadScore(s) >= 50;
    const causeParts: string[] = [];
    if (s.daysSinceActive >= 3) causeParts.push('several days without studying');
    if (overloaded) causeParts.push('fatigue from an overloaded plan');
    const cause = causeParts.length
      ? `${capitalize(causeParts.join(' + '))}.`
      : "You're engaged and showing up regularly.";

    return this.build('dropout', p, {
      cause,
      action:
        p >= 34
          ? overloaded
            ? 'Automatically lighten the plan and offer one short, easy win to return to.'
            : 'Nudge with a short, low-effort session to rebuild the habit.'
          : 'Keep the current rhythm — nothing to change.',
      reasons: [
        `${s.daysSinceActive === 999 ? 'never' : s.daysSinceActive} day(s) since the last study activity.`,
        `Current streak ${s.streakCurrent}, longest ${s.streakLongest}.`,
        `Overload pressure ${Math.round(this.overloadScore(s))}/100.`,
      ],
    });
  }

  /** Future difficulty — concepts already slipping or blocked ahead. */
  private difficulty(s: Signals): RiskPrediction {
    const masteryPenalty =
      s.averageMastery !== null && s.averageMastery < 0.5 ? 25 : 0;
    const p = clamp(s.atRisk * 20 + s.blocked * 10 + masteryPenalty);
    return this.build('difficulty', p, {
      cause:
        s.atRisk + s.blocked > 0
          ? `${s.atRisk} concept(s) at risk and ${s.blocked} blocked further along your path.`
          : 'The road ahead looks clear.',
      action:
        p >= 34
          ? 'Consolidate the shaky concepts before opening new ground.'
          : 'Continue — no roadblocks ahead.',
      reasons: [
        `${s.atRisk} at-risk concept(s).`,
        `${s.blocked} blocked concept(s) with unmet prerequisites.`,
        `Average mastery ${s.averageMastery === null ? 'n/a' : `${Math.round(s.averageMastery * 100)}%`}.`,
      ],
    });
  }

  /** Motivation loss — a habit falling away, goals stalling. */
  private motivation(s: Signals): RiskPrediction {
    let p = 0;
    if (!s.studiedToday) p += 15;
    if (s.streakCurrent === 0) p += 25;
    if (s.streakLongest >= 5 && s.streakCurrent <= 1) p += 25; // fell off a real streak
    if (s.goalsPending >= 3) p += 15;
    if (s.sessionsLast7 <= 1) p += 20;
    p = clamp(p);
    return this.build('motivation', p, {
      cause:
        s.streakLongest >= 5 && s.streakCurrent <= 1
          ? `You had a ${s.streakLongest}-day streak and it has broken.`
          : s.sessionsLast7 <= 1
            ? 'Very little activity this week.'
            : "You're staying engaged.",
      action:
        p >= 34
          ? 'Celebrate a recent win and set one tiny, achievable goal to restart momentum.'
          : 'Momentum is fine — keep going.',
      reasons: [
        `Studied today: ${s.studiedToday ? 'yes' : 'no'}.`,
        `Streak current ${s.streakCurrent} / longest ${s.streakLongest}.`,
        `${s.goalsPending} pending goal(s); ${s.sessionsLast7} session(s) this week.`,
      ],
    });
  }

  /** Probable forgetting — reuses the FSRS forecast directly. */
  private forgetting(s: Signals): RiskPrediction {
    const p = clamp(s.forecastSoon * 15);
    return this.build('forgetting', p, {
      cause:
        s.forecastSoon > 0
          ? `${s.forecastSoon} item(s) will pass your forgetting threshold within ${FORGETTING_HORIZON_DAYS} days.`
          : 'Nothing is about to be forgotten.',
      action:
        p >= 34
          ? 'Review these ahead of time, before recall drops.'
          : 'Your memory is holding — no early review needed.',
      reasons: [
        `${s.forecastSoon} forecast forgetting event(s) within ${FORGETTING_HORIZON_DAYS} days.`,
      ],
    });
  }

  /** Overload as a raw 0..100 score (shared by dropout without re-persisting). */
  private overloadScore(s: Signals): number {
    let p = s.dueTotal * 4 + s.forecastSoon * 3;
    if (s.sessionsLast7 >= 5) p -= 20;
    return clamp(p);
  }

  // ── assembly + persistence ─────────────────────────────────────────────────

  private build(
    kind: PredictionKind,
    probability: number,
    parts: { cause: string; action: string; reasons: string[] },
  ): RiskPrediction {
    return { kind, probability, level: levelOf(probability), ...parts };
  }

  private async record(
    userId: string,
    predictions: RiskPrediction[],
    signals: Signals,
  ): Promise<void> {
    await Promise.all(
      predictions.map((p) =>
        this.prisma.learningPrediction.upsert({
          where: { userId_kind: { userId, kind: p.kind } },
          create: {
            userId,
            kind: p.kind,
            probability: p.probability,
            level: p.level,
            cause: p.cause,
            action: p.action,
            signals: signals as unknown as object,
          },
          update: {
            probability: p.probability,
            level: p.level,
            cause: p.cause,
            action: p.action,
            signals: signals as unknown as object,
          },
        }),
      ),
    );
  }
}

function clamp(v: number): number {
  return Math.min(100, Math.max(0, Math.round(v)));
}

function levelOf(p: number): RiskLevel {
  return p >= 67 ? 'high' : p >= 34 ? 'moderate' : 'low';
}

function capitalize(s: string): string {
  return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}
