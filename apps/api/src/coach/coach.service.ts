import { Injectable } from '@nestjs/common';
import type {
  ConceptMastery,
  LearningPathItem,
  LearningScore,
  ProactiveBriefing,
  StudyRecommendation,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../concepts/mastery.service';
import { LearningPathService } from '../concepts/learning-path.service';
import { LocalizationService } from '../localization/localization.service';

/** A concept counts toward the score once it is mastered enough to be "solid". */
const STRONG = 0.8;
const MAX_RECOMMENDATIONS = 3;

/**
 * The proactive coach (sprint 2, task 8).
 *
 * The user opens the app and the teacher speaks first: a reasoned, time-boxed
 * plan of what to do today and WHY, plus a real Learning Score and an honest
 * projection of what the recommended review would do to it.
 *
 * Everything here is computed from real state (the twin's mastery, the learning
 * path, language vocabulary due). The projected gain is real arithmetic — the
 * score recomputed as if the recommended at-risk concepts were back to mastered —
 * not an invented percentage.
 */
@Injectable()
export class CoachService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly learningPath: LearningPathService,
    private readonly localization: LocalizationService,
  ) {}

  async today(userId: string): Promise<ProactiveBriefing> {
    const [twin, path, languages] = await Promise.all([
      this.mastery.twin(userId),
      this.learningPath.next(userId).catch(() => ({ items: [] as LearningPathItem[] })),
      this.prisma.languageProfile.findMany({ where: { userId } }),
    ]);

    const tracked = twin.concepts.filter(
      (c): c is ConceptMastery & { mastery: number } =>
        c.cardCount > 0 && c.mastery !== null,
    );
    const score = this.scoreOf(tracked);

    // At-risk concepts are what the learner is forgetting — the priority.
    const atRisk = path.items.filter((i) => i.status === 'at_risk');
    const recommendations = await this.recommend(userId, path.items, atRisk, languages);

    // Honest projection: if the recommended at-risk concepts were restored to
    // mastered, what would the score become?
    const recommendedConceptIds = new Set(
      recommendations
        .filter((r) => r.kind === 'review' && r.conceptId)
        .map((r) => r.conceptId as string),
    );
    const projected =
      tracked.length > 0 && recommendedConceptIds.size > 0
        ? this.scoreOf(
            tracked.map((c) =>
              recommendedConceptIds.has(c.conceptId)
                ? { ...c, mastery: Math.max(c.mastery, STRONG) }
                : c,
            ),
          )
        : null;

    const projectedScore = projected?.score ?? null;
    const projectedGain =
      score.score !== null && projectedScore !== null
        ? Math.max(0, Math.round(projectedScore - score.score))
        : null;

    const briefing: ProactiveBriefing = {
      score,
      projectedScore,
      projectedGain,
      recommendations,
      headline: this.headline(recommendations),
      why: this.why(atRisk, recommendations),
    };
    return this.localize(userId, briefing);
  }

  /** Translate the briefing's prose (headline, why, each recommendation reason)
   *  into the learner's Learning Locale. Concept/activity names are left as-is. */
  private async localize(userId: string, b: ProactiveBriefing): Promise<ProactiveBriefing> {
    const texts = [b.headline, b.why, ...b.recommendations.map((r) => r.reason)];
    const tr = await this.localization.localizeForUser(userId, texts);
    let i = 0;
    const headline = tr[i++];
    const why = tr[i++];
    const recommendations = b.recommendations.map((r) => ({ ...r, reason: tr[i++] }));
    return { ...b, headline, why, recommendations };
  }

  // ── internals ────────────────────────────────────────────────────────────

  private scoreOf(tracked: { mastery: number }[]): LearningScore {
    if (tracked.length === 0) return { score: null, band: 'new' };
    const mean = tracked.reduce((s, c) => s + c.mastery, 0) / tracked.length;
    const score = Math.round(mean * 100);
    const band =
      score >= 80 ? 'strong' : score >= 50 ? 'building' : 'weak';
    return { score, band };
  }

  private async recommend(
    userId: string,
    items: LearningPathItem[],
    atRisk: LearningPathItem[],
    languages: { id: string; language: string; vocabDeckId: string | null }[],
  ): Promise<StudyRecommendation[]> {
    const out: StudyRecommendation[] = [];

    // 1) Languages with vocabulary slipping — short, high-value.
    for (const lang of languages) {
      if (!lang.vocabDeckId) continue;
      const due = await this.prisma.card.count({
        where: { userId, deckId: lang.vocabDeckId, due: { lte: new Date() } },
      });
      if (due === 0) continue;
      out.push({
        kind: 'vocabulary',
        activity: lang.language,
        minutes: this.clamp(due, 10, 20),
        reason: `${due} ${lang.language} word${due === 1 ? '' : 's'} to review`,
        languageProfileId: lang.id,
      });
      if (out.length >= MAX_RECOMMENDATIONS) return out;
    }

    // 2) The concepts being forgotten (at-risk) — the core of the plan.
    for (const concept of atRisk) {
      out.push({
        kind: 'review',
        activity: concept.name,
        minutes: this.clamp((concept.dueCount || 5) * 2, 15, 25),
        reason: `you are gradually forgetting ${concept.name}`,
        conceptId: concept.conceptId,
      });
      if (out.length >= MAX_RECOMMENDATIONS) return out;
    }

    // 3) Nothing slipping — offer the next step forward.
    if (out.length === 0) {
      const next = items.find((i) => ['ready', 'in_progress'].includes(i.status));
      if (next) {
        out.push({
          kind: 'lesson',
          activity: next.name,
          minutes: 20,
          reason: `ready to move forward on ${next.name}`,
          conceptId: next.conceptId,
        });
      }
    }
    return out;
  }

  private headline(recs: StudyRecommendation[]): string {
    if (recs.length === 0) return 'Nothing is due — add a lesson or a language to get started.';
    const parts = recs.map((r) => `${r.minutes} min of ${r.activity}`);
    if (parts.length === 1) return `Today I suggest ${parts[0]}.`;
    const last = parts.pop();
    return `Today I suggest ${parts.join(', ')} then ${last}.`;
  }

  private why(atRisk: LearningPathItem[], recs: StudyRecommendation[]): string {
    if (atRisk.length > 0) {
      return `You are gradually forgetting ${atRisk[0].name}. Reviewing now catches it just before it slips.`;
    }
    if (recs.some((r) => r.kind === 'vocabulary')) {
      return 'Some vocabulary is due — a short review keeps it from fading.';
    }
    if (recs.some((r) => r.kind === 'lesson')) {
      return 'Your foundations are solid — this is the right moment to build on them.';
    }
    return 'You are up to date. Come back when something is due.';
  }

  private clamp(v: number, lo: number, hi: number): number {
    return Math.min(Math.max(Math.round(v), lo), hi);
  }
}
