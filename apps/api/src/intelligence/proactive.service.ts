import { Injectable, NotFoundException } from '@nestjs/common';
import type { AiInitiative } from '@prisma/client';
import type {
  InitiativeKind,
  InitiativeStatus,
  InitiativeView,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LearningPathService } from '../concepts/learning-path.service';
import { LocalizationService } from '../localization/localization.service';

/** How long a dismissed/acted initiative stays quiet before it can resurface. */
const COOLDOWN_MS = 3 * 86_400_000;

interface Candidate {
  kind: InitiativeKind;
  dedupeKey: string;
  title: string;
  message: string;
  priority: number;
  reasons: string[];
}

/**
 * AI Proactive Engine (Sprint 9.1). The mentor stops waiting to be asked: it
 * reads the learner's real state (mastery, the prioritised learning path, review
 * load, recency) and RAISES initiatives — "you're ready for X", "let's slow down
 * on Y", "N reviews are due". Every initiative is persisted with the facts it was
 * based on (traceability) and its reasons (explainability). Pure heuristics over
 * existing engines — no logic is duplicated, and each rule is auditable.
 */
@Injectable()
export class ProactiveService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningPath: LearningPathService,
    private readonly localization: LocalizationService,
  ) {}

  /** Refresh initiatives from the current state, then return the active ones,
   *  localized into the learner's Learning Locale. */
  async list(userId: string): Promise<InitiativeView[]> {
    await this.generate(userId);
    const rows = await this.prisma.aiInitiative.findMany({
      where: { userId, status: 'active' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    const views = rows.map((r) => this.toView(r));
    const texts: string[] = [];
    for (const v of views) texts.push(v.title, v.message, ...v.reasons);
    const tr = await this.localization.localizeForUser(userId, texts);
    let i = 0;
    return views.map((v) => ({
      ...v,
      title: tr[i++],
      message: tr[i++],
      reasons: v.reasons.map(() => tr[i++]),
    }));
  }

  async respond(
    userId: string,
    id: string,
    status: 'acted' | 'dismissed',
  ): Promise<void> {
    const row = await this.prisma.aiInitiative.findUnique({ where: { id } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Initiative not found.');
    }
    await this.prisma.aiInitiative.update({
      where: { id },
      data: { status, respondedAt: new Date() },
    });
  }

  /** Analyse the learner and persist any new initiative (idempotent per key). */
  async generate(userId: string): Promise<void> {
    const [user, path] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { email: true, lastActiveAt: true, profile: { select: { displayName: true } } },
      }),
      this.learningPath.next(userId).catch(() => ({ items: [] })),
    ]);
    const name = user?.profile?.displayName?.trim() || user?.email?.split('@')[0] || 'there';

    const candidates: Candidate[] = [];

    // 1. Slowing down — a concept is slipping (highest priority: don't lose them).
    const atRisk = path.items.find((i) => i.status === 'at_risk');
    if (atRisk) {
      const pct = atRisk.mastery === null ? null : Math.round(atRisk.mastery * 100);
      candidates.push({
        kind: 'slow_down',
        dedupeKey: `slow_down:${atRisk.conceptId}`,
        title: `Let's slow down on ${atRisk.name}`,
        message: `${name}, "${atRisk.name}" has been tough lately. I'll slow the pace and we'll revisit the basics before moving on.`,
        priority: 90,
        reasons: [
          `"${atRisk.name}" is flagged at risk${pct !== null ? ` (mastery ${pct}%)` : ''}.`,
          'Consolidating now prevents the gap from widening.',
        ],
      });
    }

    // 2. Reviews due — protect memory before it decays.
    const due = path.items.reduce((n, i) => n + (i.dueCount ?? 0), 0);
    if (due >= 3) {
      candidates.push({
        kind: 'review_due',
        dedupeKey: 'review_due',
        title: `${due} reviews are due`,
        message: `${name}, you have ${due} items due for review. A short session now will lock them into long-term memory.`,
        priority: 60,
        reasons: [`${due} FSRS cards are at or past their review date.`],
      });
    }

    // 3. Ready to advance — foundation solid, next step unlocked.
    const ready = path.items.find((i) => i.status === 'ready');
    if (ready) {
      candidates.push({
        kind: 'advance',
        dedupeKey: `advance:${ready.conceptId}`,
        title: `Ready to start ${ready.name}`,
        message: `${name}, you've mastered what "${ready.name}" builds on — I think you're ready to start it.`,
        priority: 50,
        reasons: [
          `"${ready.name}" has no unmet prerequisites.`,
          'Its foundations are already mastered.',
        ],
      });
    }

    // 4. Comeback — a gentle re-entry after a break.
    const lastActive = user?.lastActiveAt?.getTime() ?? Date.now();
    const daysAway = (Date.now() - lastActive) / 86_400_000;
    if (daysAway >= 3) {
      candidates.push({
        kind: 'comeback',
        dedupeKey: 'comeback',
        title: 'Welcome back',
        message: `Good to see you again, ${name}. Let's ease back in with a short, gentle session.`,
        priority: 80,
        reasons: [`No activity for ${Math.floor(daysAway)} days.`],
      });
    }

    // Persist only genuinely new initiatives. An identical key is skipped while
    // one is still active (idempotent) AND for a cooldown after the learner has
    // acted on or dismissed it — a "not now" is respected, not re-raised at once.
    for (const c of candidates) {
      const last = await this.prisma.aiInitiative.findFirst({
        where: { userId, dedupeKey: c.dedupeKey },
        orderBy: { createdAt: 'desc' },
        select: { status: true, respondedAt: true },
      });
      if (last) {
        if (last.status === 'active') continue;
        const respondedAt = last.respondedAt?.getTime() ?? 0;
        if (Date.now() - respondedAt < COOLDOWN_MS) continue;
      }
      await this.prisma.aiInitiative.create({
        data: {
          userId,
          kind: c.kind,
          title: c.title,
          message: c.message,
          priority: c.priority,
          dedupeKey: c.dedupeKey,
          payload: { reasons: c.reasons } as unknown as object,
        },
      });
    }
  }

  private toView(row: AiInitiative): InitiativeView {
    const payload = (row.payload ?? {}) as { reasons?: string[] };
    return {
      id: row.id,
      kind: row.kind as InitiativeKind,
      title: row.title,
      message: row.message,
      priority: row.priority,
      status: row.status as InitiativeStatus,
      reasons: payload.reasons ?? [],
      createdAt: row.createdAt.toISOString(),
    };
  }
}
