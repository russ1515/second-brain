import { Injectable } from '@nestjs/common';
import type { AnalyticsOverview, FeatureUsage } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { CacheService } from '../redis/cache.service';

/** Analytics & BI (Sprint 8.6). Platform-wide indicators computed from existing
 *  data + the `lastActiveAt` activity signal. Admin-only (served through the
 *  admin gate). At scale these would be precomputed/rolled up; here they are read
 *  live but cached for 60s (Sprint 10.1) so a dashboard refresh doesn't re-run
 *  the whole aggregation. */
@Injectable()
export class AnalyticsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Cached 60s — the aggregation is expensive and platform-wide (not per-user). */
  overview(): Promise<AnalyticsOverview> {
    return this.cache.wrap('analytics:overview', 60, () => this.computeOverview());
  }

  private async computeOverview(): Promise<AnalyticsOverview> {
    const now = Date.now();
    const since = (days: number) => new Date(now - days * 86_400_000);
    const period = new Date().toISOString().slice(0, 7);

    const [
      dau, wau, mau, totalUsers, newUsers7d, olderUsers, retainedOlder,
      masteryAgg, lessonsCompleted, invoiceAgg, freePlan, doneSessions, counters,
    ] = await Promise.all([
      this.prisma.user.count({ where: { lastActiveAt: { gte: since(1) } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: since(7) } } }),
      this.prisma.user.count({ where: { lastActiveAt: { gte: since(30) } } }),
      this.prisma.user.count(),
      this.prisma.user.count({ where: { createdAt: { gte: since(7) } } }),
      this.prisma.user.count({ where: { createdAt: { lte: since(7) } } }),
      this.prisma.user.count({
        where: { createdAt: { lte: since(7) }, lastActiveAt: { gte: since(7) } },
      }),
      this.prisma.studySession.aggregate({ _avg: { masteryAfter: true } }),
      this.prisma.lesson.count(),
      this.prisma.invoice.aggregate({ _sum: { amount: true }, where: { status: 'paid' } }),
      this.prisma.plan.findUnique({ where: { slug: 'free' }, select: { id: true } }),
      this.prisma.studySession.findMany({
        where: { completedAt: { not: null } },
        select: { startedAt: true, completedAt: true },
        take: 10_000,
      }),
      this.prisma.usageCounter.findMany({
        where: { period, metric: { in: ['ai_questions', 'voice_minutes'] } },
        select: { metric: true, used: true },
      }),
    ]);

    const paidUsers = freePlan
      ? await this.prisma.subscription.count({
          where: { planId: { not: freePlan.id }, status: 'active' },
        })
      : 0;

    const studyMinutes = Math.round(
      doneSessions.reduce(
        (sum, s) =>
          sum + (s.completedAt ? (s.completedAt.getTime() - s.startedAt.getTime()) / 60_000 : 0),
        0,
      ),
    );

    let aiQuestions = 0;
    let voiceMinutes = 0;
    for (const c of counters) {
      if (c.metric === 'ai_questions') aiQuestions += c.used;
      else voiceMinutes += c.used;
    }

    return {
      activeUsers: { dau, wau, mau },
      stickiness: mau > 0 ? round2(dau / mau) : 0,
      retention7d: olderUsers > 0 ? round2(retainedOlder / olderUsers) : 0,
      totalUsers,
      newUsers7d,
      studyMinutes,
      avgMastery: masteryAgg._avg.masteryAfter ?? null,
      lessonsCompleted,
      conversionRate: totalUsers > 0 ? round2(paidUsers / totalUsers) : 0,
      paidUsers,
      revenue: invoiceAgg._sum.amount ?? 0,
      aiUsage: { aiQuestions, voiceMinutes },
      topFeatures: await this.topFeatures(),
    };
  }

  /** Rank the most-used features by how much data each holds. */
  private async topFeatures(): Promise<FeatureUsage[]> {
    const [tutor, lessons, assessments, writing, reading, documents, languages] =
      await Promise.all([
        this.prisma.tutorMessage.count(),
        this.prisma.lesson.count(),
        this.prisma.assessment.count(),
        this.prisma.writingSubmission.count(),
        this.prisma.readingExercise.count(),
        this.prisma.document.count({ where: { deletedAt: null } }),
        this.prisma.languageProfile.count(),
      ]);
    return [
      { feature: 'tutor', count: tutor },
      { feature: 'lessons', count: lessons },
      { feature: 'assessments', count: assessments },
      { feature: 'writing', count: writing },
      { feature: 'reading', count: reading },
      { feature: 'documents', count: documents },
      { feature: 'languages', count: languages },
    ]
      .filter((f) => f.count > 0)
      .sort((a, b) => b.count - a.count);
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
