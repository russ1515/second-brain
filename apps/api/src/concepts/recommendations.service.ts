import { Injectable } from '@nestjs/common';
import type {
  ProactivePlan,
  ProactiveRecommendation,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from './mastery.service';

const MAX_REVIEWS = 2;
const STRONG = 0.8;
const WEAK = 0.5;

/**
 * Proactive Recommendations (task 4.7): the mentor layer. It doesn't just report
 * state — it decides what the learner should DO next: revise a slipping concept
 * for N minutes, consolidate before adding new material, or level up something
 * mastered. Each recommendation is grounded in the Digital Twin and carries an
 * action the app can launch, so the AI acts rather than merely analysing.
 */
@Injectable()
export class RecommendationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
  ) {}

  async plan(userId: string): Promise<ProactivePlan> {
    const details = await this.mastery.masteryDetails(userId);
    const tracked = details.filter((d) => d.mastery !== null) as (typeof details[number] & {
      mastery: number;
    })[];

    const recommendations: ProactiveRecommendation[] = [];

    // 1) Timed revisions — concepts that are due, most urgent first.
    const due = tracked
      .filter((d) => d.dueCount > 0)
      .sort((a, b) => a.mastery - b.mastery)
      .slice(0, MAX_REVIEWS);
    for (const d of due) {
      recommendations.push({
        kind: 'review',
        subject: d.name,
        conceptId: d.conceptId,
        minutes: clamp(d.dueCount * 3, 10, 25),
      });
    }

    const weak = tracked.filter(
      (d) => d.mastery < WEAK || (d.dueCount > 0 && d.mastery < STRONG),
    );
    const strong = tracked.filter((d) => d.mastery >= STRONG);

    // 2) Strategic stance: consolidate weak spots before anything new; or, if
    //    everything is solid, green-light moving forward.
    if (weak.length > 0) {
      const weakest = [...weak].sort((a, b) => a.mastery - b.mastery)[0];
      recommendations.push({
        kind: 'consolidate',
        subject: weakest.name,
        conceptId: weakest.conceptId,
      });
    } else if (strong.length > 0 && due.length === 0) {
      recommendations.push({ kind: 'advance' });
    }

    // 3) Level up — a mastered concept the learner has actually reviewed (not a
    //    brand-new estimate), and isn't also flagged weak.
    const readyToLevelUp = strong.find(
      (d) => d.confidence !== 'low' && !weak.some((w) => w.conceptId === d.conceptId),
    );
    if (readyToLevelUp) {
      recommendations.push({
        kind: 'levelUp',
        subject: readyToLevelUp.name,
        conceptId: readyToLevelUp.conceptId,
      });
    }

    // 4) Level up a language whose vocabulary is solid (reviewed, none due).
    const language = await this.solidLanguage(userId);
    if (language) {
      recommendations.push({ kind: 'levelUp', subject: language });
    }

    return { recommendations };
  }

  // ── internals ─────────────────────────────────────────────────────────────

  /** A language whose vocabulary deck is well-reviewed and nothing's due. */
  private async solidLanguage(userId: string): Promise<string | null> {
    const profiles = await this.prisma.languageProfile.findMany({
      where: { userId, vocabDeckId: { not: null } },
      select: { language: true, vocabDeckId: true },
    });
    const now = new Date();
    for (const p of profiles) {
      if (!p.vocabDeckId) continue;
      const cards = await this.prisma.card.findMany({
        where: { userId, deckId: p.vocabDeckId },
        select: { reps: true, due: true },
      });
      if (cards.length < 3) continue;
      const reviewed = cards.filter((c) => c.reps > 0).length;
      const due = cards.filter((c) => c.due.getTime() <= now.getTime()).length;
      if (due === 0 && reviewed / cards.length >= 0.6) return p.language;
    }
    return null;
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}
