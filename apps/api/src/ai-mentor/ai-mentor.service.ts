import { Injectable } from '@nestjs/common';
import type {
  ExamView,
  MentorDimension,
  MentorDimensionKey,
  MentorGuidance,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../concepts/mastery.service';
import { MentorService } from '../mentor/mentor.service';
import { ExamsService } from '../goals/exams.service';
import { CacheService } from '../redis/cache.service';
import { LocalizationService } from '../localization/localization.service';

/** Enough recent activity to judge method by (below this, it's too early). */
const MEANINGFUL_EFFORT = 6;
const WEAK_MASTERY = 0.5;
const STRONG_OUTLOOK = 0.7;
const SHAKY_ACCURACY = 0.6;

/** The signals every dimension is judged from — gathered once, reused by all. */
interface Signals {
  averageMastery: number | null;
  strong: number;
  weak: number;
  tracked: number;
  streakCurrent: number;
  streakLongest: number;
  studiedToday: boolean;
  sessionsLast7: number;
  effort14: number;
  accuracy: number | null;
  attemptCount: number;
  goalsPending: number;
  nearestExam: ExamView | null;
}

/**
 * AI Mentor (Sprint 9.5).
 *
 * A separate, replaceable engine that steps back from tutoring and assesses the
 * learner strategically: academic success outlook, exam readiness, organization,
 * work METHOD (the signature insight — high effort that isn't converting into
 * mastery is "working hard, but not the right way"), and confidence. It COMPOSES
 * the twin (MasteryService), the mentor's streak (MentorService) and the exams
 * (ExamsService) plus raw effort/accuracy reads — no logic is duplicated. The
 * assessment is PERSISTED for traceability; every judgement carries its signals.
 */
@Injectable()
export class AiMentorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly mentor: MentorService,
    private readonly exams: ExamsService,
    private readonly cache: CacheService,
    private readonly localization: LocalizationService,
  ) {}

  /** Cached 20s (Sprint 10.1) — advisory assessment, staleness-tolerant. The
   *  English analysis is cached; it's then localized into the learner's Learning
   *  Locale (Redis-cached per string, so it's cheap after the first time). */
  async guidance(userId: string, now = new Date()): Promise<MentorGuidance> {
    const view = await this.cache.wrap(`ai-mentor:${userId}`, 20, () =>
      this.computeGuidance(userId, now),
    );
    return this.localize(userId, view);
  }

  /** Translate every prose field of the guidance into the learner's language. */
  private async localize(userId: string, view: MentorGuidance): Promise<MentorGuidance> {
    const texts = [view.headline, ...view.dimensions.flatMap((d) => [d.insight, ...d.reasons])];
    const tr = await this.localization.localizeForUser(userId, texts);
    let i = 0;
    const headline = tr[i++];
    const dimensions = view.dimensions.map((d) => {
      const insight = tr[i++];
      const reasons = d.reasons.map(() => tr[i++]);
      return { ...d, insight, reasons };
    });
    return { ...view, headline, dimensions };
  }

  /** Compute, record and return the mentor's strategic guidance. */
  private async computeGuidance(userId: string, now: Date): Promise<MentorGuidance> {
    const s = await this.gather(userId, now);
    const dimensions: MentorDimension[] = [
      this.method(s),
      this.success(s),
      this.exams_(s),
      this.organization(s),
      this.confidence(s),
    ];
    const focus = this.pickFocus(dimensions);
    const headline = this.headline(dimensions, focus);

    await this.record(userId, headline, focus, dimensions);

    return { headline, focus, dimensions, generatedAt: now.toISOString() };
  }

  // ── signal gathering (all reused engines / raw reads) ─────────────────────

  private async gather(userId: string, now: Date): Promise<Signals> {
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const fortnightAgo = new Date(now.getTime() - 14 * 86_400_000);
    const [twin, streak, exams, goalsPending, sessionsLast7, effort14, attempts] =
      await Promise.all([
        this.mastery.twin(userId).catch(() => null),
        this.mentor.streak(userId, now),
        this.exams.list(userId).catch(() => [] as ExamView[]),
        this.prisma.goal.count({ where: { userId, status: 'pending' } }),
        this.prisma.studySession.count({
          where: { userId, status: 'done', completedAt: { gte: weekAgo } },
        }),
        this.effortSince(userId, fortnightAgo),
        this.prisma.exerciseAttempt.findMany({
          where: { userId },
          select: { correct: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
      ]);

    const attemptCount = attempts.length;
    const upcoming = exams
      .filter((e) => e.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    return {
      averageMastery: twin?.summary.averageMastery ?? null,
      strong: twin?.summary.strongConcepts ?? 0,
      weak: twin?.summary.weakConcepts ?? 0,
      tracked: twin?.summary.trackedConcepts ?? 0,
      streakCurrent: streak.current,
      streakLongest: streak.longest,
      studiedToday: streak.studiedToday,
      sessionsLast7,
      effort14,
      accuracy: attemptCount > 0 ? attempts.filter((a) => a.correct).length / attemptCount : null,
      attemptCount,
      goalsPending,
      nearestExam: upcoming[0] ?? null,
    };
  }

  /** Volume of genuine study effort over a window (sessions + reviews + lessons + attempts). */
  private async effortSince(userId: string, since: Date): Promise<number> {
    const [sessions, reviews, lessons, attempts] = await Promise.all([
      this.prisma.studySession.count({ where: { userId, startedAt: { gte: since } } }),
      this.prisma.reviewLog.count({ where: { userId, reviewedAt: { gte: since } } }),
      this.prisma.lesson.count({ where: { userId, createdAt: { gte: since } } }),
      this.prisma.exerciseAttempt.count({ where: { userId, createdAt: { gte: since } } }),
    ]);
    return sessions + reviews + lessons + attempts;
  }

  // ── the five mentorship dimensions (each explicable) ──────────────────────

  /** Work method — the signature: effort that isn't converting into mastery. */
  private method(s: Signals): MentorDimension {
    const highEffort = s.effort14 >= MEANINGFUL_EFFORT;
    const lowEffectiveness =
      (s.averageMastery !== null && s.averageMastery < WEAK_MASTERY) ||
      (s.accuracy !== null && s.attemptCount >= 3 && s.accuracy < SHAKY_ACCURACY);

    let rating: MentorDimension['rating'];
    let insight: string;
    if (s.effort14 < 2) {
      rating = 'building';
      insight =
        "There isn't enough activity yet to judge your method — let's establish a regular study rhythm first.";
    } else if (highEffort && lowEffectiveness) {
      rating = 'concern';
      insight =
        "I think you're working a lot, but not in the most effective way — the effort isn't converting into mastery. The fix isn't studying more, it's studying differently: shorter active-recall sessions on your weak spots instead of re-reading.";
    } else if (!lowEffectiveness && (s.averageMastery ?? 0) >= WEAK_MASTERY) {
      rating = 'good';
      insight = 'Your method is working — the effort you put in is turning into real mastery.';
    } else {
      rating = 'building';
      insight = 'Your approach is roughly on track; keep favouring active recall over passive review.';
    }

    return this.dim('method', rating, insight, [
      `Effort (14d): ${s.effort14} study actions.`,
      `Average mastery ${s.averageMastery === null ? 'n/a' : `${Math.round(s.averageMastery * 100)}%`}.`,
      `Exercise accuracy ${s.accuracy === null ? 'n/a' : `${Math.round(s.accuracy * 100)}%`} over ${s.attemptCount} attempt(s).`,
    ]);
  }

  /** Academic / university success outlook. */
  private success(s: Signals): MentorDimension {
    let rating: MentorDimension['rating'];
    let insight: string;
    if (s.tracked === 0) {
      rating = 'building';
      insight = "It's too early to call your trajectory — let's get some concepts tracked first.";
    } else if ((s.averageMastery ?? 0) >= STRONG_OUTLOOK) {
      rating = 'good';
      insight = "You're on track for strong results — keep the momentum and stretch into harder material.";
    } else if ((s.averageMastery ?? 0) >= WEAK_MASTERY) {
      rating = 'building';
      insight = 'A solid foundation is forming — consolidate the middling concepts to lift your outcomes.';
    } else {
      rating = 'concern';
      insight = 'Your current grasp is fragile — we should shore up the fundamentals before pushing ahead.';
    }
    return this.dim('success', rating, insight, [
      `${s.strong} strong / ${s.weak} weak of ${s.tracked} tracked concept(s).`,
      `Average mastery ${s.averageMastery === null ? 'n/a' : `${Math.round(s.averageMastery * 100)}%`}.`,
    ]);
  }

  /** Exam preparation. */
  private exams_(s: Signals): MentorDimension {
    const e = s.nearestExam;
    if (!e) {
      return this.dim('exams', 'good', 'No exams on the horizon — steady, unhurried progress is the goal.', [
        'No upcoming exams scheduled.',
      ]);
    }
    let rating: MentorDimension['rating'];
    let insight: string;
    if (e.preparation === null) {
      rating = 'building';
      insight = `Link "${e.subject}" to its concepts so I can track your readiness for the exam in ${e.daysUntil} day(s).`;
    } else if (e.preparation >= 70) {
      rating = 'good';
      insight = `You're well prepared for "${e.subject}" (${e.preparation}%) — keep it warm with light review.`;
    } else if (e.preparation >= 40) {
      rating = 'building';
      insight = `"${e.subject}" is at ${e.preparation}% with ${e.daysUntil} day(s) to go — steady daily prep will get you there.`;
    } else {
      rating = 'concern';
      insight = `"${e.subject}" is only ${e.preparation}% ready and the exam is in ${e.daysUntil} day(s) — this needs priority now.`;
    }
    return this.dim('exams', rating, insight, [
      `Nearest exam "${e.subject}" in ${e.daysUntil} day(s).`,
      `Preparation ${e.preparation === null ? 'untracked' : `${e.preparation}%`}.`,
    ]);
  }

  /** Organization — consistency and rhythm. */
  private organization(s: Signals): MentorDimension {
    let rating: MentorDimension['rating'];
    let insight: string;
    if (s.streakCurrent >= 5) {
      rating = 'good';
      insight = 'You show up consistently — that regularity is doing a lot of the work for you.';
    } else if (s.streakCurrent >= 2) {
      rating = 'building';
      insight = "You're forming a rhythm — protect a fixed daily slot so it becomes automatic.";
    } else {
      rating = 'concern';
      insight = 'Your study rhythm is irregular — one small, fixed daily session beats occasional long ones.';
    }
    const reasons = [
      `Current streak ${s.streakCurrent} day(s), longest ${s.streakLongest}.`,
      `${s.sessionsLast7} session(s) this week.`,
    ];
    if (s.goalsPending >= 3) reasons.push(`${s.goalsPending} goals still pending.`);
    return this.dim('organization', rating, insight, reasons);
  }

  /** Confidence — succeeding more than struggling? */
  private confidence(s: Signals): MentorDimension {
    const winning = s.strong > s.weak && (s.accuracy === null || s.attemptCount < 3 || s.accuracy >= STRONG_OUTLOOK);
    const struggling = s.weak > s.strong || (s.accuracy !== null && s.attemptCount >= 3 && s.accuracy < WEAK_MASTERY);
    let rating: MentorDimension['rating'];
    let insight: string;
    if (winning) {
      rating = 'good';
      insight = "You're succeeding more than you're struggling — trust that, and take on a harder challenge.";
    } else if (struggling) {
      rating = 'concern';
      insight = `Recent struggles can dent confidence — remember you've already mastered ${s.strong} concept(s); we build from there, not from zero.`;
    } else {
      rating = 'building';
      insight = 'Your confidence should track your progress — small, visible wins are the fastest way to grow it.';
    }
    return this.dim('confidence', rating, insight, [
      `${s.strong} mastered vs ${s.weak} weak concept(s).`,
      `Recent accuracy ${s.accuracy === null ? 'n/a' : `${Math.round(s.accuracy * 100)}%`}.`,
    ]);
  }

  // ── synthesis + persistence ────────────────────────────────────────────────

  /** The one dimension to prioritise: worst first, method-led on ties. */
  private pickFocus(dims: MentorDimension[]): MentorDimensionKey | null {
    const order: MentorDimensionKey[] = ['method', 'exams', 'success', 'confidence', 'organization'];
    const byKey = (k: MentorDimensionKey) => dims.find((d) => d.key === k)!;
    for (const k of order) if (byKey(k).rating === 'concern') return k;
    for (const k of order) if (byKey(k).rating === 'building') return k;
    return null;
  }

  private headline(dims: MentorDimension[], focus: MentorDimensionKey | null): string {
    if (focus === null) {
      return "You're in a good place across the board — let's keep the momentum and aim higher.";
    }
    return dims.find((d) => d.key === focus)!.insight;
  }

  private record(
    userId: string,
    headline: string,
    focus: MentorDimensionKey | null,
    dimensions: MentorDimension[],
  ): Promise<unknown> {
    const data = { headline, focus, dimensions: dimensions as unknown as object };
    return this.prisma.mentorGuidance.upsert({
      where: { userId },
      create: { userId, ...data },
      update: data,
    });
  }

  private dim(
    key: MentorDimensionKey,
    rating: MentorDimension['rating'],
    insight: string,
    reasons: string[],
  ): MentorDimension {
    return { key, rating, insight, reasons };
  }
}
