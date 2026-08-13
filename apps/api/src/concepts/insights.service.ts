import { Injectable } from '@nestjs/common';
import type { Insight, LearnerInsights } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from './mastery.service';
import { LearnerProfileService } from './learner-profile.service';

const MIN_ATTEMPTS = 4; // before an accuracy claim
const MIN_FOCUS = 4; // before a focus-window claim

/**
 * AI Insights (task 4.6): turns the learner's real data into plain-language
 * observations that explain the AI's recommendations. Each insight is emitted
 * ONLY when the evidence supports it and carries the actual numbers — nothing
 * fabricated. Composed from the Digital Twin, ConceptMastery and FSRS state.
 */
@Injectable()
export class InsightsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly profile: LearnerProfileService,
  ) {}

  async insights(userId: string): Promise<LearnerInsights> {
    const [details, profile, concepts, attempts, hours] = await Promise.all([
      this.mastery.masteryDetails(userId),
      this.profile.profile(userId),
      this.prisma.concept.findMany({
        where: { userId },
        select: {
          name: true,
          cards: { select: { card: { select: { stability: true, reps: true } } } },
        },
      }),
      this.prisma.exerciseAttempt.findMany({
        where: { userId },
        select: { correct: true },
      }),
      this.activityHours(userId),
    ]);

    const insights: Insight[] = [];

    // 1) A strength — where they're doing well.
    const strong = details.find((d) => d.level === 'strong' && d.mastery !== null);
    if (strong) {
      insights.push({
        kind: 'strength',
        concept: strong.name,
        percent: Math.round((strong.mastery as number) * 100),
      });
    }

    // 2) Forgetting — the concept whose memory fades fastest (lowest FSRS
    //    stability among reviewed cards). Stability ≈ days until recall decays.
    const forgetting = this.fastestForgotten(concepts);
    if (forgetting) {
      insights.push({ kind: 'forgetting', concept: forgetting.name, days: forgetting.days });
    }

    // 3) At risk right now — overdue and not yet strong.
    const atRisk = details.find(
      (d) => d.mastery !== null && d.dueCount > 0 && d.level !== 'strong',
    );
    if (atRisk) {
      insights.push({ kind: 'atRisk', concept: atRisk.name });
    }

    // 4) Focus window — when they're most active.
    if (hours.total >= MIN_FOCUS && profile.focusWindow) {
      insights.push({
        kind: 'focusWindow',
        window: profile.focusWindow,
        fromHour: hours.from,
        toHour: hours.to,
      });
    }

    // 5) Accuracy — how often exercises land.
    if (attempts.length >= MIN_ATTEMPTS) {
      const pct = Math.round(
        (attempts.filter((a) => a.correct).length / attempts.length) * 100,
      );
      insights.push({ kind: 'accuracy', percent: pct });
    }

    // 6) Rhythm — how regularly they've worked.
    if (profile.workRhythm && profile.interactions > 0) {
      insights.push({
        kind: 'rhythm',
        rhythm: profile.workRhythm,
        count: profile.interactions,
      });
    }

    // 7) Style — how they engage best.
    if (profile.learningStyle) {
      insights.push({ kind: 'style', style: profile.learningStyle });
    }

    return { insights };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** The reviewed concept with the shortest FSRS stability (forgotten fastest). */
  private fastestForgotten(
    concepts: { name: string; cards: { card: { stability: number; reps: number } }[] }[],
  ): { name: string; days: number } | null {
    let best: { name: string; days: number } | null = null;
    for (const c of concepts) {
      const reviewed = c.cards
        .map((cc) => cc.card)
        .filter((card) => card.reps > 0 && card.stability > 0);
      if (reviewed.length === 0) continue;
      const avg =
        reviewed.reduce((s, card) => s + card.stability, 0) / reviewed.length;
      const days = Math.round(avg);
      if (days >= 1 && (best === null || days < best.days)) {
        best = { name: c.name, days };
      }
    }
    return best;
  }

  /** Peak 2-hour activity window from the learner's interaction timestamps. */
  private async activityHours(
    userId: string,
  ): Promise<{ from: number; to: number; total: number }> {
    const [lessons, attempts, messages, sessions] = await Promise.all([
      this.prisma.lesson.findMany({ where: { userId }, select: { createdAt: true } }),
      this.prisma.exerciseAttempt.findMany({ where: { userId }, select: { createdAt: true } }),
      this.prisma.tutorMessage.findMany({
        where: { session: { userId }, role: 'user' },
        select: { createdAt: true },
      }),
      this.prisma.studySession.findMany({ where: { userId }, select: { startedAt: true } }),
    ]);
    const times = [
      ...lessons.map((l) => l.createdAt),
      ...attempts.map((a) => a.createdAt),
      ...messages.map((m) => m.createdAt),
      ...sessions.map((s) => s.startedAt),
    ];
    const hist = new Array(24).fill(0);
    for (const t of times) hist[t.getHours()]++;
    // Densest 2-hour span.
    let bestFrom = 0;
    let bestSum = -1;
    for (let h = 0; h < 24; h++) {
      const sum = hist[h] + hist[(h + 1) % 24];
      if (sum > bestSum) {
        bestSum = sum;
        bestFrom = h;
      }
    }
    return { from: bestFrom, to: (bestFrom + 2) % 24, total: times.length };
  }
}
