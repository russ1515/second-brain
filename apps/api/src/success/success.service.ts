import { Injectable } from '@nestjs/common';
import type {
  ConceptMastery,
  ConfidenceBand,
  ExamPrediction,
  ExamPriority,
  ExamView,
  SuccessForecast,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService } from '../concepts/mastery.service';
import { ExamsService } from '../goals/exams.service';
import { CacheService } from '../redis/cache.service';
import { LocalizationService } from '../localization/localization.service';

/** Exams don't reward preparation 1:1 — there's always some exam-day variance. */
const VARIANCE_DISCOUNT = 0.95;

/**
 * Academic Success Predictor (Sprint 9.6).
 *
 * Per upcoming exam, estimates preparation, success probability, and the model's
 * OWN confidence (driven by how much reviewed evidence backs the subject). A
 * separate, replaceable engine that COMPOSES the exams' derived preparation
 * (ExamsService) and the twin's per-concept evidence (MasteryService) — it adds
 * no new mastery arithmetic. The aim is preparation, not prophecy: every estimate
 * carries its factors and concrete advice, and is persisted for traceability.
 */
@Injectable()
export class SuccessPredictorService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
    private readonly exams: ExamsService,
    private readonly cache: CacheService,
    private readonly localization: LocalizationService,
  ) {}

  /** Cached 20s (Sprint 10.1); English forecast then localized per the learner's locale. */
  async forecast(userId: string, now = new Date()): Promise<SuccessForecast> {
    const view = await this.cache.wrap(`success:${userId}`, 20, () =>
      this.computeForecast(userId, now),
    );
    const texts: string[] = [];
    for (const e of view.exams) texts.push(e.advice, ...e.factors);
    const tr = await this.localization.localizeForUser(userId, texts);
    let i = 0;
    const exams = view.exams.map((e) => ({
      ...e,
      advice: tr[i++],
      factors: e.factors.map(() => tr[i++]),
    }));
    return { ...view, exams };
  }

  private async computeForecast(userId: string, now: Date): Promise<SuccessForecast> {
    const [views, rows, twin] = await Promise.all([
      this.exams.list(userId),
      this.prisma.exam.findMany({ where: { userId }, select: { id: true, conceptId: true } }),
      this.mastery.twin(userId).catch(() => null),
    ]);
    const conceptIdByExam = new Map(rows.map((r) => [r.id, r.conceptId]));

    const upcoming = views
      .filter((e) => e.daysUntil >= 0)
      .sort((a, b) => a.daysUntil - b.daysUntil);

    const exams = upcoming.map((e) =>
      this.predict(e, this.evidenceFor(e, conceptIdByExam.get(e.id) ?? null, twin)),
    );

    await this.record(userId, exams);

    return { exams, generatedAt: now.toISOString() };
  }

  // ── evidence lookup (reuses the twin, no re-derivation) ───────────────────

  private evidenceFor(
    exam: ExamView,
    conceptId: string | null,
    twin: Awaited<ReturnType<MasteryService['twin']>> | null,
  ): ConceptMastery | null {
    if (!twin) return null;
    const byId = conceptId ? twin.concepts.find((c) => c.conceptId === conceptId) : undefined;
    return (
      byId ??
      twin.concepts.find((c) => c.name.toLowerCase() === exam.subject.trim().toLowerCase()) ??
      null
    );
  }

  // ── the estimate (each figure explicable) ─────────────────────────────────

  private predict(exam: ExamView, evidence: ConceptMastery | null): ExamPrediction {
    const preparation = exam.preparation;
    const reviewed = evidence?.reviewedCount ?? 0;
    const cards = evidence?.cardCount ?? 0;

    const confidence = this.confidence(preparation, reviewed, cards);
    const successProbability = this.successProbability(preparation, exam.daysUntil);

    return {
      examId: exam.id,
      subject: exam.subject,
      date: exam.date,
      daysUntil: exam.daysUntil,
      priority: exam.priority as ExamPriority,
      preparation,
      successProbability,
      confidence,
      confidenceBand: band(confidence),
      factors: this.factors(exam, preparation, reviewed, cards, confidence, evidence !== null),
      advice: this.advice(exam, preparation, reviewed, evidence !== null),
    };
  }

  /** Success probability — current readiness discounted for exam-day variance,
   *  with a crunch penalty when little prep meets little time. */
  private successProbability(preparation: number | null, daysUntil: number): number | null {
    if (preparation === null) return null;
    let p = preparation * VARIANCE_DISCOUNT;
    if (preparation < 60 && daysUntil <= 1) p *= 0.9; // no time left to fix it
    return clamp(p, 5, 95);
  }

  /** Model confidence — how much reviewed evidence stands behind the estimate. */
  private confidence(preparation: number | null, reviewed: number, cards: number): number {
    if (preparation === null || cards === 0) return clamp(10, 0, 100); // nothing to see
    // Each reviewed card is real evidence; unreviewed cards count for little.
    return clamp(reviewed * 18 + (cards - reviewed) * 4 + 10, 10, 95);
  }

  private factors(
    exam: ExamView,
    preparation: number | null,
    reviewed: number,
    cards: number,
    confidence: number,
    hasConcept: boolean,
  ): string[] {
    const out: string[] = [];
    if (preparation !== null) {
      out.push(`Preparation ${preparation}% from mastery of "${exam.subject}".`);
    } else if (!hasConcept) {
      out.push(`No concept is linked to "${exam.subject}" yet, so preparation can't be measured.`);
    } else {
      out.push(`"${exam.subject}" is linked but has no reviewed cards yet — preparation can't be measured.`);
    }
    out.push(`${reviewed} reviewed card(s) of ${cards} — the evidence base for this estimate.`);
    out.push(`${exam.daysUntil} day(s) until the exam.`);
    out.push(`Model confidence ${confidence}% (${band(confidence)}).`);
    return out;
  }

  private advice(
    exam: ExamView,
    preparation: number | null,
    reviewed: number,
    hasConcept: boolean,
  ): string {
    if (preparation === null) {
      return hasConcept
        ? `Study a few cards on "${exam.subject}" — once they're reviewed I can measure and track your readiness.`
        : `Link "${exam.subject}" to its concepts (and study a few cards) so I can measure your readiness.`;
    }
    if (reviewed < 3) {
      return `Do a few review sessions on "${exam.subject}" — more reviews will both raise and sharpen this estimate.`;
    }
    if (preparation >= 80) {
      return `You're in great shape — keep "${exam.subject}" warm with light spaced reviews until the exam.`;
    }
    if (exam.daysUntil <= 3) {
      return `Time is short — focus your remaining sessions on the weakest parts of "${exam.subject}".`;
    }
    return `Steady daily review of "${exam.subject}" will lift your readiness well before the exam.`;
  }

  // ── persistence (traceability) ─────────────────────────────────────────────

  private async record(userId: string, exams: ExamPrediction[]): Promise<void> {
    await Promise.all(
      exams.map((e) =>
        this.prisma.successPrediction.upsert({
          where: { examId: e.examId },
          create: {
            userId,
            examId: e.examId,
            preparation: e.preparation,
            successProbability: e.successProbability,
            confidence: e.confidence,
            factors: e.factors as unknown as object,
          },
          update: {
            preparation: e.preparation,
            successProbability: e.successProbability,
            confidence: e.confidence,
            factors: e.factors as unknown as object,
          },
        }),
      ),
    );
  }
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

function band(confidence: number): ConfidenceBand {
  return confidence >= 67 ? 'high' : confidence >= 34 ? 'medium' : 'low';
}
