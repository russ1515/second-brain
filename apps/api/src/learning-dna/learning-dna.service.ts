import { Injectable } from '@nestjs/common';
import type {
  DnaConfidenceBand,
  DnaTrait,
  DnaTraitKey,
  ExplanationDepth,
  FocusWindow,
  LearnerProfile,
  LearningDna,
  LearningStyle,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LearnerProfileService } from '../concepts/learner-profile.service';
import { CacheService } from '../redis/cache.service';
import { LocalizationService } from '../localization/localization.service';

/**
 * Learning DNA Engine (Sprint 9 ⭐, transversal).
 *
 * Consolidates the deep, STABLE profile of how the learner learns best —
 * distinct from the Digital Twin's current-state mastery. It COMPOSES the
 * behavioural profile (LearnerProfileService: style, focus window, explanation
 * depth) and the raw memory/practice signals (reviews, exercises), turning them
 * into five traits, each with a confidence that GROWS PROGRESSIVELY as evidence
 * accumulates. The result is PERSISTED as one shared profile so every other
 * engine can read the same DNA — no behavioural logic is recomputed elsewhere.
 */
@Injectable()
export class LearningDnaService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learnerProfile: LearnerProfileService,
    private readonly cache: CacheService,
    private readonly localization: LocalizationService,
  ) {}

  /** Cached 30s (Sprint 10.1); English DNA then localized per the learner's locale. */
  async dna(userId: string, now = new Date()): Promise<LearningDna> {
    const view = await this.cache.wrap(`learning-dna:${userId}`, 30, () =>
      this.computeDna(userId, now),
    );
    const texts: string[] = [];
    for (const t of view.traits) texts.push(t.label, t.summary);
    const tr = await this.localization.localizeForUser(userId, texts);
    let i = 0;
    const traits = view.traits.map((t) => ({ ...t, label: tr[i++], summary: tr[i++] }));
    return { ...view, traits };
  }

  /** Build (or refresh), persist and return the learner's Learning DNA. */
  private async computeDna(userId: string, now: Date): Promise<LearningDna> {
    const [profile, reviews, attempts, lessons] = await Promise.all([
      this.learnerProfile.profile(userId),
      this.prisma.reviewLog.findMany({ where: { userId }, select: { rating: true } }),
      this.prisma.exerciseAttempt.count({ where: { userId } }),
      this.prisma.lesson.count({ where: { userId } }),
    ]);

    const retention =
      reviews.length > 0 ? reviews.filter((r) => r.rating >= 2).length / reviews.length : null;

    const traits: DnaTrait[] = [
      this.memory(retention, reviews.length),
      this.peakTime(profile.focusWindow, profile.interactions),
      this.modality(profile.learningStyle, profile.interactions),
      this.explanation(profile.explanationDepth, lessons),
      this.retentionFormat(profile, retention, reviews.length, attempts),
    ];

    const maturity = Math.round(
      traits.reduce((sum, t) => sum + t.confidence, 0) / traits.length,
    );

    await this.prisma.learningDna.upsert({
      where: { userId },
      create: { userId, traits: traits as unknown as object, maturity, interactions: profile.interactions },
      update: { traits: traits as unknown as object, maturity, interactions: profile.interactions },
    });

    return { traits, maturity, interactions: profile.interactions, updatedAt: now.toISOString() };
  }

  // ── the five traits (confidence grows with evidence) ──────────────────────

  private memory(retention: number | null, reviews: number): DnaTrait {
    if (retention === null) {
      return this.trait('memory', 'Still learning', 'Do some spaced reviews and I’ll learn how your memory holds.', 0, reviews);
    }
    const pct = Math.round(retention * 100);
    const label = retention >= 0.8 ? 'Strong spaced recall' : retention >= 0.6 ? 'Steady spaced recall' : 'Needs frequent review';
    const summary =
      retention >= 0.8
        ? `You retain ${pct}% of what you review — spaced repetition works very well for you.`
        : retention >= 0.6
          ? `You retain ${pct}% across reviews — spacing helps, with the occasional refresher.`
          : `You retain ${pct}% so far — shorter, more frequent reviews will suit your memory better.`;
    return this.trait('memory', label, summary, this.confidence(reviews, 8), reviews);
  }

  private peakTime(focus: FocusWindow | null, interactions: number): DnaTrait {
    if (!focus) {
      return this.trait('peakTime', 'Still learning', 'As you study at different times, I’ll spot when you perform best.', 0, interactions);
    }
    const label = { morning: 'Mornings', afternoon: 'Afternoons', evening: 'Evenings', night: 'Late nights' }[focus];
    return this.trait('peakTime', label, `Your activity peaks in the ${focus} — that’s when to schedule the hard work.`, this.confidence(interactions, 3), interactions);
  }

  private modality(style: LearningStyle | null, interactions: number): DnaTrait {
    if (!style) {
      return this.trait('modality', 'Still learning', 'I’ll learn whether practice, reading or dialogue suits you as you use them.', 0, interactions);
    }
    const map: Record<LearningStyle, { label: string; how: string }> = {
      handsOn: { label: 'Hands-on practice', how: 'you learn fastest by doing — exercises and practice over passive reading' },
      reading: { label: 'Reading', how: 'you absorb best by reading and working through written material' },
      voice: { label: 'Dialogue', how: 'you learn best in conversation — talking it through with the tutor' },
    };
    const m = map[style];
    return this.trait('modality', m.label, `Your dominant modality: ${m.how}.`, this.confidence(interactions, 3), interactions);
  }

  private explanation(depth: ExplanationDepth | null, lessons: number): DnaTrait {
    if (!depth) {
      return this.trait('explanation', 'Still learning', 'As you take lessons, I’ll learn how deep your explanations should go.', 0, lessons);
    }
    const map: Record<ExplanationDepth, string> = {
      simple: 'Clear, simple explanations land best — concrete over abstract.',
      balanced: 'A balance of intuition and rigour suits you.',
      deep: 'You engage with deep, thorough explanations — detail helps rather than hinders.',
    };
    const label = { simple: 'Simple & concrete', balanced: 'Balanced', deep: 'Deep & thorough' }[depth];
    return this.trait('explanation', label, map[depth], this.confidence(lessons, 6), lessons);
  }

  private retentionFormat(
    profile: LearnerProfile,
    retention: number | null,
    reviews: number,
    attempts: number,
  ): DnaTrait {
    const evidence = reviews + attempts;
    if (evidence < 3) {
      return this.trait('retentionFormat', 'Still learning', 'I’ll learn which formats stick best for you as you use more of them.', 0, evidence);
    }
    // Prefer the format with the strongest signal so far.
    let label: string;
    let summary: string;
    if (retention !== null && retention >= 0.7 && reviews >= attempts) {
      label = 'Flashcards & spaced review';
      summary = `Spaced flashcards give you the best retention (${Math.round(retention * 100)}%) — lean on them.`;
    } else if (attempts >= 3 && profile.learningStyle === 'handsOn') {
      label = 'Active practice';
      summary = 'Practising and being tested retains better for you than re-reading.';
    } else {
      label = 'Lessons + review';
      summary = 'A written lesson followed by spaced review is your most reliable format so far.';
    }
    return this.trait('retentionFormat', label, summary, this.confidence(evidence, 5), evidence);
  }

  // ── helpers ───────────────────────────────────────────────────────────────

  /** Confidence grows with evidence and saturates — the DNA firms up over time. */
  private confidence(evidence: number, perPoint: number): number {
    return Math.min(95, Math.max(0, Math.round(evidence * perPoint)));
  }

  private trait(
    key: DnaTraitKey,
    label: string,
    summary: string,
    confidence: number,
    evidence: number,
  ): DnaTrait {
    return { key, label, summary, confidence, band: band(confidence), evidence };
  }
}

function band(confidence: number): DnaConfidenceBand {
  return confidence >= 67 ? 'established' : confidence >= 34 ? 'forming' : 'emerging';
}
