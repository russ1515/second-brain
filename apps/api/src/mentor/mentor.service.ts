import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import type { Achievement, AchievementKind } from '@prisma/client';
import type {
  AchievementView,
  MentorBriefing,
  MentorOverview,
  MentorStats,
  StreakView,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { SessionService } from '../flashcards/session.service';
import { LearningPathService } from '../concepts/learning-path.service';
// Pure helpers; importing them creates no module dependency.
import { localDateString } from '../journey/local-time';
import { computeStreak, type Streak } from './streak';

/** Milestones worth celebrating, per kind. Crossing one awards it exactly once. */
const THRESHOLDS: Record<AchievementKind, number[]> = {
  streak_days: [3, 7, 14, 30, 100, 365],
  cards_reviewed: [10, 50, 100, 500, 1000, 5000],
  concepts_mastered: [1, 5, 10, 25, 50],
  lessons_completed: [1, 5, 10, 25, 100],
  exercises_correct: [1, 10, 50, 100, 500],
};

const LABELS: Record<AchievementKind, (n: number) => string> = {
  streak_days: (n) => `${n}-day streak`,
  cards_reviewed: (n) => `${n} cards reviewed`,
  concepts_mastered: (n) => `${n} concept${n === 1 ? '' : 's'} mastered`,
  lessons_completed: (n) => `${n} lesson${n === 1 ? '' : 's'} completed`,
  exercises_correct: (n) => `${n} exercise${n === 1 ? '' : 's'} answered correctly`,
};

const MENTOR_SYSTEM = [
  'You are a learning mentor — not a teacher and not a cheerleader.',
  'You are given a learner’s REAL numbers. Ground every sentence in them:',
  'reference the actual figures, never invent progress they have not made, and',
  'never claim they are doing well when the numbers say otherwise. If the streak',
  'is broken or retention is poor, say so plainly and kindly, then give them a',
  'way back. Respond with ONLY a JSON object (no markdown, no code fences):',
  '"encouragement" (1-2 sentences on where they actually stand) and',
  '"strategies" (array of 2-4 short, concrete actions tied to these numbers).',
].join(' ');

/**
 * The Mentor role (Educational Engine): "tracks motivation, encourages
 * consistency, celebrates wins, recommends strategies, keeps streaks."
 *
 * The streak is DERIVED from real activity (reviews, graded exercises, lessons)
 * rather than stored — there is no second source of truth to drift. Wins are
 * persisted only so they can be celebrated exactly once.
 */
@Injectable()
export class MentorService {
  private readonly logger = new Logger(MentorService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly sessions: SessionService,
    private readonly learningPath: LearningPathService,
  ) {}

  /** Streak + stats + wins. Awards any milestone crossed since the last look. */
  async overview(userId: string, now = new Date()): Promise<MentorOverview> {
    const [streak, stats] = await Promise.all([
      this.streak(userId, now),
      this.stats(userId),
    ]);
    const newlyEarned = await this.award(userId, streak, stats);
    const achievements = await this.prisma.achievement.findMany({
      where: { userId },
      orderBy: { achievedAt: 'desc' },
    });

    return {
      streak: this.toStreakView(streak),
      stats,
      achievements: achievements.map((a) => this.toAchievementView(a)),
      newlyEarned,
    };
  }

  /** Consecutive study days in the learner's own timezone. */
  async streak(userId: string, now = new Date()): Promise<Streak> {
    const timezone = await this.timezoneOf(userId);

    // Any of these count as "I studied today": reviewing, being examined, or
    // taking a lesson. Consistency is about showing up, not about one feature.
    const [reviews, attempts, lessons] = await Promise.all([
      this.prisma.reviewLog.findMany({
        where: { userId },
        select: { reviewedAt: true },
      }),
      this.prisma.exerciseAttempt.findMany({
        where: { userId },
        select: { createdAt: true },
      }),
      this.prisma.lesson.findMany({
        where: { userId },
        select: { createdAt: true },
      }),
    ]);

    const dates = [
      ...reviews.map((r) => r.reviewedAt),
      ...attempts.map((a) => a.createdAt),
      ...lessons.map((l) => l.createdAt),
    ].map((d) => localDateString(d, timezone));

    return computeStreak(dates, localDateString(now, timezone));
  }

  /** Grounded coaching. Best-effort about nothing: if the model is down, say so
   *  rather than inventing encouragement. */
  async briefing(userId: string, now = new Date()): Promise<MentorBriefing> {
    const [streak, stats] = await Promise.all([
      this.streak(userId, now),
      this.stats(userId),
    ]);

    const facts = [
      `Current streak: ${streak.current} day(s) (longest ever: ${streak.longest}).`,
      `Studied today: ${streak.studiedToday ? 'yes' : 'not yet'}.`,
      `Total active days: ${streak.totalActiveDays}.`,
      `Cards reviewed all-time: ${stats.cardsReviewed}.`,
      `Retention (share of reviews recalled): ${
        stats.retention === null ? 'no reviews yet' : `${Math.round(stats.retention * 100)}%`
      }.`,
      `Cards due right now: ${stats.dueNow}.`,
      `Concepts mastered: ${stats.conceptsMastered}. At risk: ${stats.atRiskConcepts}.`,
      `Lessons completed: ${stats.lessonsCompleted}. Exercises answered correctly: ${stats.exercisesCorrect}.`,
    ].join('\n');

    let text: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: MENTOR_SYSTEM },
          { role: 'user', content: `My numbers:\n${facts}` },
        ],
        { temperature: 0.4 },
      );
      text = result.text;
    } catch (error) {
      this.logger.error(`Mentor LLM call failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The mentor is temporarily unavailable. Please try again shortly.',
      );
    }
    return this.parseBriefing(text, streak);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async stats(userId: string): Promise<MentorStats> {
    const [review, cardsReviewed, path, lessons, correct] = await Promise.all([
      this.sessions.stats(userId),
      this.prisma.reviewLog.count({ where: { userId } }),
      this.learningPath.next(userId).catch(() => ({ items: [] })),
      this.prisma.lesson.count({ where: { userId } }),
      this.prisma.exerciseAttempt.count({ where: { userId, correct: true } }),
    ]);

    return {
      retention: review.retention,
      cardsReviewed,
      conceptsMastered: path.items.filter((i) => i.status === 'mastered').length,
      lessonsCompleted: lessons,
      exercisesCorrect: correct,
      atRiskConcepts: path.items.filter((i) => i.status === 'at_risk').length,
      dueNow: review.due,
    };
  }

  /** Award every threshold the learner has crossed but not yet been given. */
  private async award(
    userId: string,
    streak: Streak,
    stats: MentorStats,
  ): Promise<AchievementView[]> {
    const values: Record<AchievementKind, number> = {
      // Use the LONGEST streak: a 30-day run stays earned after a bad week.
      streak_days: streak.longest,
      cards_reviewed: stats.cardsReviewed,
      concepts_mastered: stats.conceptsMastered,
      lessons_completed: stats.lessonsCompleted,
      exercises_correct: stats.exercisesCorrect,
    };

    const earned: AchievementView[] = [];
    for (const [kind, thresholds] of Object.entries(THRESHOLDS) as [
      AchievementKind,
      number[],
    ][]) {
      for (const threshold of thresholds) {
        if (values[kind] < threshold) continue;
        try {
          const created = await this.prisma.achievement.create({
            data: { userId, kind, threshold },
          });
          earned.push(this.toAchievementView(created));
        } catch (error) {
          // Unique clash = already celebrated. That is the guarantee, not a bug.
          if ((error as { code?: string }).code !== 'P2002') throw error;
        }
      }
    }
    return earned;
  }

  private parseBriefing(raw: string, streak: Streak): MentorBriefing {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    let parsed: Record<string, unknown> = {};
    if (start !== -1 && end > start) {
      try {
        parsed = JSON.parse(raw.slice(start, end + 1));
      } catch {
        parsed = {};
      }
    }
    const encouragement =
      typeof parsed.encouragement === 'string' ? parsed.encouragement.trim() : '';
    const strategies = Array.isArray(parsed.strategies)
      ? parsed.strategies
          .filter((s): s is string => typeof s === 'string' && s.trim().length > 0)
          .map((s) => s.trim())
      : [];

    if (!encouragement && strategies.length === 0) {
      throw new ServiceUnavailableException(
        'The mentor did not return usable coaching. Please try again.',
      );
    }
    return {
      encouragement:
        encouragement ||
        `You are on a ${streak.current}-day streak. Keep the next session small and specific.`,
      strategies,
    };
  }

  private async timezoneOf(userId: string): Promise<string> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return profile?.timezone ?? 'UTC';
  }

  private toStreakView(streak: Streak): StreakView {
    return { ...streak };
  }

  private toAchievementView(achievement: Achievement): AchievementView {
    const kind = achievement.kind as AchievementKind;
    return {
      kind,
      threshold: achievement.threshold,
      label: LABELS[kind](achievement.threshold),
      achievedAt: achievement.achievedAt.toISOString(),
    };
  }
}
