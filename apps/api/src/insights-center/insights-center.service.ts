import { Injectable } from '@nestjs/common';
import type {
  Insight,
  InsightCategory,
  InsightItem,
  InsightsCenter,
  LearningPathItem,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../concepts/mastery.service';
import { LearningPathService } from '../concepts/learning-path.service';
import { InsightsService } from '../concepts/insights.service';
import { MentorService } from '../mentor/mentor.service';
import { CacheService } from '../redis/cache.service';
import { LocalizationService } from '../localization/localization.service';

/**
 * AI Insights Center (Sprint 9.7).
 *
 * The learner's intelligence hub: strengths, weaknesses, progress, habits,
 * performance and areas to improve — each finding explained. A separate,
 * replaceable engine that COMPOSES strengths/weaknesses + the twin
 * (MasteryService), the 4.6 insights (InsightsService), the learning path
 * (LearningPathService), the streak (MentorService) and raw study signals. It
 * derives no new scores and is a read-only view (nothing to persist), like
 * Analytics — the AI always explains why, from real data only.
 */
@Injectable()
export class InsightsCenterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly learningPath: LearningPathService,
    private readonly insights: InsightsService,
    private readonly mentor: MentorService,
    private readonly cache: CacheService,
    private readonly localization: LocalizationService,
  ) {}

  /** Cached 20s (Sprint 10.1); the English aggregation is then localized into the
   *  learner's Learning Locale (Redis-cached per string). */
  async center(userId: string, now = new Date()): Promise<InsightsCenter> {
    const view = await this.cache.wrap(`insights-center:${userId}`, 20, () =>
      this.computeCenter(userId, now),
    );
    const texts: string[] = [];
    for (const c of view.categories) {
      texts.push(c.headline);
      for (const it of c.items) texts.push(it.title, it.detail);
    }
    const tr = await this.localization.localizeForUser(userId, texts);
    let i = 0;
    const categories = view.categories.map((c) => ({
      ...c,
      headline: tr[i++],
      items: c.items.map((it) => ({ title: tr[i++], detail: tr[i++] })),
    }));
    return { ...view, categories };
  }

  private async computeCenter(userId: string, now: Date): Promise<InsightsCenter> {
    const weekAgo = new Date(now.getTime() - 7 * 86_400_000);
    const [sw, twin, insights, streak, path, sessions, attempts, reviews, lessons] =
      await Promise.all([
        this.mastery.strengthsWeaknesses(userId).catch(() => ({ strengths: [], weaknesses: [] })),
        this.mastery.twin(userId).catch(() => null),
        this.insights.insights(userId).then((r) => r.insights).catch(() => [] as Insight[]),
        this.mentor.streak(userId, now),
        this.learningPath.next(userId).catch(() => ({ items: [] as LearningPathItem[] })),
        this.prisma.studySession.findMany({
          where: { userId, status: 'done' },
          select: { learningScoreBefore: true, learningScoreAfter: true, completedAt: true },
        }),
        this.prisma.exerciseAttempt.findMany({
          where: { userId },
          select: { correct: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        this.prisma.reviewLog.findMany({ where: { userId }, select: { rating: true } }),
        this.prisma.lesson.count({ where: { userId } }),
      ]);

    const findInsight = (kind: Insight['kind']) => insights.find((i) => i.kind === kind);
    const sessionsLast7 = sessions.filter((s) => s.completedAt && s.completedAt >= weekAgo).length;

    const categories: InsightCategory[] = [
      this.strengths(sw.strengths),
      this.weaknesses(sw.weaknesses),
      this.progress(twin, sessions, lessons),
      this.habits(streak, sessionsLast7, findInsight('focusWindow'), findInsight('rhythm'), findInsight('style')),
      this.performance(twin, attempts, reviews, findInsight('accuracy')),
      this.improvement(path.items, sw.weaknesses, attempts),
    ];

    return { categories, generatedAt: now.toISOString() };
  }

  // ── the six facets (each item explains itself) ────────────────────────────

  private strengths(strengths: { name: string; mastery: number; stars: number }[]): InsightCategory {
    const items: InsightItem[] = strengths.slice(0, 4).map((c) => ({
      title: c.name,
      detail: `Mastered at ${Math.round(c.mastery * 100)}% (${c.stars}★) — a reliable strength you can build on.`,
    }));
    return this.cat(
      'strengths',
      items.length ? `You have ${strengths.length} solid strength${strengths.length === 1 ? '' : 's'}.` : 'No clear strengths yet — they appear as you master concepts.',
      items,
    );
  }

  private weaknesses(weaknesses: { name: string; mastery: number }[]): InsightCategory {
    const items: InsightItem[] = weaknesses.slice(0, 4).map((c) => ({
      title: c.name,
      detail: `Only ${Math.round(c.mastery * 100)}% mastered — this is slipping and needs consolidation.`,
    }));
    return this.cat(
      'weaknesses',
      items.length ? `${weaknesses.length} concept${weaknesses.length === 1 ? '' : 's'} need attention.` : 'Nothing is slipping right now — well held.',
      items,
    );
  }

  private progress(
    twin: Awaited<ReturnType<MasteryService['twin']>> | null,
    sessions: { learningScoreBefore: number | null; learningScoreAfter: number | null }[],
    lessons: number,
  ): InsightCategory {
    const items: InsightItem[] = [];
    const mastered = twin?.summary.strongConcepts ?? 0;
    if (mastered > 0) {
      items.push({
        title: `${mastered} concept${mastered === 1 ? '' : 's'} mastered`,
        detail: 'These are now above the mastery threshold — durable, long-term knowledge.',
      });
    }
    const gains = sessions
      .filter((s) => s.learningScoreBefore !== null && s.learningScoreAfter !== null)
      .map((s) => (s.learningScoreAfter as number) - (s.learningScoreBefore as number));
    const positive = gains.filter((g) => g > 0);
    if (positive.length > 0) {
      const total = Math.round(positive.reduce((a, b) => a + b, 0) * 100);
      items.push({
        title: `Learning Score rose across ${positive.length} session${positive.length === 1 ? '' : 's'}`,
        detail: `Those sessions added about ${total} points of Learning Score in total.`,
      });
    }
    if (lessons > 0) {
      items.push({
        title: `${lessons} lesson${lessons === 1 ? '' : 's'} completed`,
        detail: 'Each completed lesson feeds new material into your long-term memory.',
      });
    }
    return this.cat(
      'progress',
      items.length ? 'You are moving forward — here is the evidence.' : 'Not much progress recorded yet — complete a session to start the trail.',
      items,
    );
  }

  private habits(
    streak: { current: number; longest: number },
    sessionsLast7: number,
    focus?: Insight,
    rhythm?: Insight,
    style?: Insight,
  ): InsightCategory {
    const items: InsightItem[] = [];
    items.push({
      title: `${streak.current}-day streak`,
      detail: `Your longest run is ${streak.longest} day${streak.longest === 1 ? '' : 's'} — consistency is what compounds.`,
    });
    items.push({
      title: `${sessionsLast7} session${sessionsLast7 === 1 ? '' : 's'} this week`,
      detail: sessionsLast7 >= 3 ? 'A steady weekly cadence — keep protecting the slot.' : 'A little light this week — a small daily slot would lift it.',
    });
    if (focus?.fromHour !== undefined && focus.toHour !== undefined) {
      items.push({
        title: `You focus best ${focus.fromHour}h–${focus.toHour}h`,
        detail: 'This is when your activity peaks — schedule the hard work here.',
      });
    }
    if (style?.style) {
      items.push({ title: `Your learning leans ${style.style}`, detail: 'The tutor adapts its explanations to this.' });
    } else if (rhythm?.count !== undefined) {
      items.push({ title: `${rhythm.count} study interactions logged`, detail: 'The rhythm behind your progress.' });
    }
    return this.cat('habits', 'How you study, seen from your own data.', items);
  }

  private performance(
    twin: Awaited<ReturnType<MasteryService['twin']>> | null,
    attempts: { correct: boolean }[],
    reviews: { rating: number }[],
    accuracyInsight?: Insight,
  ): InsightCategory {
    const items: InsightItem[] = [];
    const avg = twin?.summary.averageMastery ?? null;
    if (avg !== null) {
      items.push({
        title: `Average mastery ${Math.round(avg * 100)}%`,
        detail: 'The mean recall probability across every concept you are tracking.',
      });
    }
    if (attempts.length > 0) {
      const acc = Math.round((attempts.filter((a) => a.correct).length / attempts.length) * 100);
      items.push({
        title: `Exercise accuracy ${acc}%`,
        detail: `Across your last ${attempts.length} graded answer${attempts.length === 1 ? '' : 's'}.`,
      });
    } else if (accuracyInsight?.percent !== undefined) {
      items.push({ title: `Exercise accuracy ${accuracyInsight.percent}%`, detail: 'From your graded exercises so far.' });
    }
    if (reviews.length > 0) {
      const retention = Math.round((reviews.filter((r) => r.rating >= 2).length / reviews.length) * 100);
      items.push({
        title: `Memory retention ${retention}%`,
        detail: `The share of your ${reviews.length} review${reviews.length === 1 ? '' : 's'} you recalled successfully.`,
      });
    }
    return this.cat(
      'performance',
      items.length ? 'The hard numbers on how you are doing.' : 'No performance data yet — answer some exercises and reviews.',
      items,
    );
  }

  private improvement(
    items_: LearningPathItem[],
    weaknesses: { name: string }[],
    attempts: { correct: boolean }[],
  ): InsightCategory {
    const items: InsightItem[] = [];
    const atRisk = items_.filter((i) => i.status === 'at_risk');
    if (atRisk[0]) {
      items.push({
        title: `Revisit "${atRisk[0].name}"`,
        detail: 'It is flagged at risk — a review now stops the gap from widening.',
      });
    }
    const dueTotal = items_.reduce((n, i) => n + (i.dueCount ?? 0), 0);
    if (dueTotal >= 3) {
      items.push({
        title: `Clear ${dueTotal} due reviews`,
        detail: 'Overdue reviews are the fastest points to recover — memory is decaying on these.',
      });
    }
    if (weaknesses[0] && !atRisk.some((a) => a.name === weaknesses[0].name)) {
      items.push({
        title: `Strengthen "${weaknesses[0].name}"`,
        detail: 'Your weakest tracked concept — the highest-leverage place to improve.',
      });
    }
    if (attempts.length >= 3) {
      const acc = attempts.filter((a) => a.correct).length / attempts.length;
      if (acc < 0.6) {
        items.push({
          title: 'Shift to active recall',
          detail: `Your accuracy (${Math.round(acc * 100)}%) suggests re-reading isn't sticking — testing yourself will.`,
        });
      }
    }
    return this.cat(
      'improvement',
      items.length ? 'The highest-leverage things to work on next.' : 'Nothing urgent to fix — keep the momentum.',
      items,
    );
  }

  private cat(key: InsightCategory['key'], headline: string, items: InsightItem[]): InsightCategory {
    return { key, headline, items };
  }
}
