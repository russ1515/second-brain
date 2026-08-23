import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import type { DailyPlan, DailyPlanItem, Prisma } from '@prisma/client';
import type {
  DailyPlanItemView,
  DailyPlanView,
  PlanItemKind,
  PlanItemStatus,
  PlanSlot,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SessionService } from '../flashcards/session.service';
import { LearningPathService } from '../concepts/learning-path.service';
import { LocalizationService } from '../localization/localization.service';
import { localDate } from './local-time';

/** A plan item before it is persisted. */
interface DraftItem {
  slot: PlanSlot;
  kind: PlanItemKind;
  title: string;
  detail?: string;
  targetCount?: number;
  conceptId?: string;
  deckId?: string;
  languageProfileId?: string;
}

/** How many due cards a "quick revision before sleep" item covers. */
const QUICK_REVISION_CARDS = 10;

/**
 * Builds the learner's day from REAL state — FSRS due counts, the twin's
 * learning path, and language vocabulary — never from a hardcoded template.
 *
 * The four slots follow the Educational Engine spec: morning reviews yesterday,
 * afternoon brings a new lesson, evening drills exercises, night does a quick
 * revision before sleep.
 */
@Injectable()
export class DailyPlanService {
  private readonly logger = new Logger(DailyPlanService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sessions: SessionService,
    private readonly learningPath: LearningPathService,
    private readonly localization: LocalizationService,
  ) {}

  /** Today's plan, generated on first read. Idempotent: the unique key on
   *  (userId, date) means concurrent ticks cannot double-create it. */
  async today(userId: string, now = new Date()): Promise<DailyPlanView> {
    const timezone = await this.timezoneOf(userId);
    const date = localDate(now, timezone);

    const existing = await this.prisma.dailyPlan.findUnique({
      where: { userId_date: { userId, date } },
      include: { items: { orderBy: [{ slot: 'asc' }, { position: 'asc' }] } },
    });
    if (existing) {
      return this.localize(userId, this.toView(existing, existing.items, timezone));
    }
    return this.localize(userId, await this.generate(userId, timezone, date));
  }

  /** Translate each plan item's title + detail into the learner's Learning Locale
   *  (concept/deck names inside them are handled by the translator). */
  private async localize(userId: string, view: DailyPlanView): Promise<DailyPlanView> {
    if (view.items.length === 0) return view;
    const texts: string[] = [];
    for (const it of view.items) texts.push(it.title, it.detail ?? '');
    const tr = await this.localization.localizeForUser(userId, texts);
    let i = 0;
    const items = view.items.map((it) => ({ ...it, title: tr[i++], detail: tr[i++] || it.detail }));
    return { ...view, items };
  }

  /**
   * Re-plan the rest of the day against current state.
   *
   * "The schedule continuously adapts" — but adaptation must never rewrite
   * history: items the learner already did or skipped are preserved untouched,
   * and only `pending` ones are recomputed.
   */
  async refresh(userId: string, now = new Date()): Promise<DailyPlanView> {
    const timezone = await this.timezoneOf(userId);
    return this.localize(userId, await this.refreshForDay(userId, timezone, localDate(now, timezone)));
  }

  /** Ensure-and-adapt for an explicit local day. This is what the scheduler
   *  calls at each slot: merely ensuring the plan exists would leave work that
   *  appeared mid-day unplanned until tomorrow, which is not "continuously
   *  adapts". */
  async refreshForDay(
    userId: string,
    timezone: string,
    date: Date,
  ): Promise<DailyPlanView> {
    const plan = await this.prisma.dailyPlan.findUnique({
      where: { userId_date: { userId, date } },
      include: { items: true },
    });
    if (!plan) {
      return this.generate(userId, timezone, date);
    }

    const settled = plan.items.filter((i) => i.status !== 'pending');
    const drafts = await this.draft(userId);

    // Don't re-add work the learner has already settled in this slot+kind.
    const settledKeys = new Set(settled.map((i) => `${i.slot}:${i.kind}`));
    const fresh = drafts.filter((d) => !settledKeys.has(`${d.slot}:${d.kind}`));

    const items = await this.prisma.$transaction(async (tx) => {
      await tx.dailyPlanItem.deleteMany({
        where: { planId: plan.id, status: 'pending' },
      });
      await tx.dailyPlanItem.createMany({
        data: fresh.map((d, i) => this.toCreateData(plan.id, d, i)),
      });
      await tx.dailyPlan.update({
        where: { id: plan.id },
        data: { updatedAt: new Date() },
      });
      return tx.dailyPlanItem.findMany({
        where: { planId: plan.id },
        orderBy: [{ slot: 'asc' }, { position: 'asc' }],
      });
    });

    return this.toView(plan, items, timezone);
  }

  async completeItem(
    userId: string,
    itemId: string,
    status: 'done' | 'skipped',
  ): Promise<DailyPlanItemView> {
    const item = await this.prisma.dailyPlanItem.findUnique({
      where: { id: itemId },
      include: { plan: { select: { userId: true } } },
    });
    if (!item || item.plan.userId !== userId) {
      throw new NotFoundException('Plan item not found.');
    }
    const updated = await this.prisma.dailyPlanItem.update({
      where: { id: itemId },
      data: {
        status,
        completedAt: status === 'done' ? new Date() : null,
      },
    });
    return this.toItemView(updated);
  }

  async timezoneOf(userId: string): Promise<string> {
    const profile = await this.prisma.profile.findUnique({
      where: { userId },
      select: { timezone: true },
    });
    return profile?.timezone ?? 'UTC';
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async generate(
    userId: string,
    timezone: string,
    date: Date,
  ): Promise<DailyPlanView> {
    const drafts = await this.draft(userId);

    // Two ticks can race here; the unique key decides the winner and the loser
    // simply reads what the winner wrote.
    try {
      const plan = await this.prisma.dailyPlan.create({
        data: {
          userId,
          date,
          timezone,
          items: {
            create: drafts.map((d, i) => this.toCreateData(null, d, i)),
          },
        },
        include: { items: { orderBy: [{ slot: 'asc' }, { position: 'asc' }] } },
      });
      return this.toView(plan, plan.items, timezone);
    } catch (error) {
      if ((error as { code?: string }).code === 'P2002') {
        const plan = await this.prisma.dailyPlan.findUnique({
          where: { userId_date: { userId, date } },
          include: { items: { orderBy: [{ slot: 'asc' }, { position: 'asc' }] } },
        });
        if (plan) return this.toView(plan, plan.items, timezone);
      }
      throw error;
    }
  }

  /** Assemble the day from the learner's actual state. */
  private async draft(userId: string): Promise<DraftItem[]> {
    const [stats, path, languages] = await Promise.all([
      this.sessions.stats(userId),
      this.learningPath.next(userId).catch(() => ({ items: [] })),
      this.prisma.languageProfile.findMany({ where: { userId } }),
    ]);

    const items: DraftItem[] = [];

    // ── morning: review what is due (yesterday's work coming back) ──
    if (stats.due > 0) {
      items.push({
        slot: 'morning',
        kind: 'review',
        title: `Review ${stats.due} due card${stats.due === 1 ? '' : 's'}`,
        detail: 'Yesterday’s material is coming back — clear the queue first.',
        targetCount: stats.due,
      });
    }

    // ── afternoon: the twin's most actionable concept becomes today's lesson ──
    const actionable = path.items.find((i) =>
      ['at_risk', 'in_progress', 'ready'].includes(i.status),
    );
    if (actionable) {
      items.push({
        slot: 'afternoon',
        kind: 'lesson',
        title: `New lesson: ${actionable.name}`,
        detail:
          actionable.status === 'ready'
            ? 'Prerequisites are mastered — this is the right next step.'
            : `Your grasp here is ${actionable.level}; today builds it up.`,
        conceptId: actionable.conceptId,
      });
    }

    // ── evening: drill the concepts the twin says are slipping ──
    const atRisk = path.items.filter((i) => i.status === 'at_risk').slice(0, 3);
    for (const concept of atRisk) {
      items.push({
        slot: 'evening',
        kind: 'exercises',
        title: `Exercises: ${concept.name}`,
        detail: 'Flagged as at risk — practice beats re-reading.',
        targetCount: concept.dueCount || undefined,
        conceptId: concept.conceptId,
      });
    }

    // ── vocabulary: one item per language with words waiting ──
    for (const language of languages) {
      if (!language.vocabDeckId) continue;
      const due = await this.prisma.card.count({
        where: { userId, deckId: language.vocabDeckId, due: { lte: new Date() } },
      });
      if (due === 0) continue;
      items.push({
        slot: 'evening',
        kind: 'vocabulary',
        title: `${language.language}: ${due} word${due === 1 ? '' : 's'} to review`,
        detail: `Keep ${language.language} vocabulary from slipping.`,
        targetCount: due,
        deckId: language.vocabDeckId,
        languageProfileId: language.id,
      });
    }

    // ── night: a short revision before sleep ──
    if (stats.due > 0 || stats.learning > 0) {
      const target = Math.min(QUICK_REVISION_CARDS, stats.due + stats.learning);
      items.push({
        slot: 'night',
        kind: 'quick_revision',
        title: `Quick revision — ${target} card${target === 1 ? '' : 's'}`,
        detail: 'A short pass before sleep locks the day in.',
        targetCount: target,
      });
    }

    return items;
  }

  private toCreateData(
    planId: string | null,
    draft: DraftItem,
    position: number,
  ): Prisma.DailyPlanItemUncheckedCreateInput {
    return {
      ...(planId ? { planId } : {}),
      slot: draft.slot,
      kind: draft.kind,
      title: draft.title,
      detail: draft.detail ?? null,
      targetCount: draft.targetCount ?? null,
      conceptId: draft.conceptId ?? null,
      deckId: draft.deckId ?? null,
      languageProfileId: draft.languageProfileId ?? null,
      position,
    } as Prisma.DailyPlanItemUncheckedCreateInput;
  }

  private toView(
    plan: DailyPlan,
    items: DailyPlanItem[],
    timezone: string,
  ): DailyPlanView {
    return {
      id: plan.id,
      date: plan.date.toISOString().slice(0, 10),
      timezone: plan.timezone || timezone,
      items: items.map((i) => this.toItemView(i)),
      generatedAt: plan.generatedAt.toISOString(),
      updatedAt: plan.updatedAt.toISOString(),
    };
  }

  private toItemView(item: DailyPlanItem): DailyPlanItemView {
    return {
      id: item.id,
      slot: item.slot as PlanSlot,
      kind: item.kind as PlanItemKind,
      title: item.title,
      detail: item.detail,
      status: item.status as PlanItemStatus,
      position: item.position,
      targetCount: item.targetCount,
      conceptId: item.conceptId,
      deckId: item.deckId,
      languageProfileId: item.languageProfileId,
      completedAt: item.completedAt?.toISOString() ?? null,
    };
  }

  /** Exposed for the scheduler: what is still outstanding in a slot. */
  itemsForSlot(plan: DailyPlanView, slot: PlanSlot): DailyPlanItemView[] {
    return plan.items.filter((i) => i.slot === slot && i.status === 'pending');
  }
}
