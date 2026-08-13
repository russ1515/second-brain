import { Injectable, NotFoundException } from '@nestjs/common';
import type { Recommendation } from '@prisma/client';
import type {
  LearningPathItem,
  RecommendationFeed,
  RecommendationTarget,
  ResourceKind,
  ResourceRecommendation,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LearningPathService } from '../concepts/learning-path.service';
import { RevisionEngineService } from '../revision/revision-engine.service';

/** A dismissed recommendation stays quiet this long before it can resurface. */
const COOLDOWN_MS = 3 * 86_400_000;

interface Candidate {
  kind: ResourceKind;
  dedupeKey: string;
  title: string;
  reason: string;
  priority: number;
  target: RecommendationTarget | null;
}

/**
 * Recommendation Engine (Sprint 9.4).
 *
 * Proposes a personalized, multi-type feed of resources — lessons, exercises,
 * readings, reviews, practicals, documents — each derived from the learner's
 * real state and each explaining itself. A separate, replaceable engine that
 * COMPOSES the learning path (twin), the FSRS review queue and the library; it
 * duplicates no ranking logic. Every recommendation is PERSISTED (traceability),
 * and its status keeps the AI's automatic suggestion distinct from the learner's
 * accept / dismiss decision.
 */
@Injectable()
export class RecommendationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly learningPath: LearningPathService,
    private readonly revision: RevisionEngineService,
  ) {}

  /** Refresh the feed from current state, then return what's still on offer. */
  async feed(userId: string): Promise<RecommendationFeed> {
    await this.generate(userId);
    const rows = await this.prisma.recommendation.findMany({
      where: { userId, status: 'suggested' },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    });
    return { recommendations: rows.map((r) => this.toView(r)) };
  }

  async respond(
    userId: string,
    id: string,
    status: 'accepted' | 'dismissed',
  ): Promise<void> {
    const row = await this.prisma.recommendation.findUnique({ where: { id } });
    if (!row || row.userId !== userId) {
      throw new NotFoundException('Recommendation not found.');
    }
    await this.prisma.recommendation.update({
      where: { id },
      data: { status, respondedAt: new Date() },
    });
  }

  /** Build candidates from real state and persist the genuinely new ones. */
  async generate(userId: string): Promise<void> {
    const candidates = await this.buildCandidates(userId);
    for (const c of candidates) {
      const last = await this.prisma.recommendation.findFirst({
        where: { userId, dedupeKey: c.dedupeKey },
        orderBy: { createdAt: 'desc' },
        select: { status: true, respondedAt: true },
      });
      if (last) {
        // Still on offer, or acted on recently — don't re-raise it yet.
        if (last.status === 'suggested') continue;
        const respondedAt = last.respondedAt?.getTime() ?? 0;
        if (Date.now() - respondedAt < COOLDOWN_MS) continue;
      }
      await this.prisma.recommendation.create({
        data: {
          userId,
          kind: c.kind,
          title: c.title,
          reason: c.reason,
          priority: c.priority,
          dedupeKey: c.dedupeKey,
          targetKind: c.target?.kind ?? null,
          targetId: c.target?.id ?? null,
        },
      });
    }
  }

  // ── the personalized candidate set (composes existing engines) ────────────

  private async buildCandidates(userId: string): Promise<Candidate[]> {
    const [{ items }, dueTotal, linkedDocs, orphanDocs] = await Promise.all([
      this.learningPath.next(userId).catch(() => ({ items: [] as LearningPathItem[] })),
      this.revision.queue(userId).then((q) => q.length).catch(() => 0),
      this.focusDocuments(userId),
      this.orphanDocuments(userId),
    ]);

    const out: Candidate[] = [];

    // Exercises — the concepts actively slipping need practice (highest value).
    for (const c of items.filter((i) => i.status === 'at_risk').slice(0, 2)) {
      out.push({
        kind: 'exercise',
        dedupeKey: `exercise:${c.conceptId}`,
        title: `Practice: ${c.name}`,
        reason: `You're gradually forgetting "${c.name}" — targeted exercises will pull it back.`,
        priority: 70,
        target: { kind: 'concept', id: c.conceptId },
      });
    }

    // Reviews — protect memory before it decays.
    if (dueTotal >= 1) {
      out.push({
        kind: 'review',
        dedupeKey: 'review',
        title: `Review ${dueTotal} item${dueTotal === 1 ? '' : 's'}`,
        reason: `${dueTotal} item${dueTotal === 1 ? ' is' : 's are'} due — a short review locks them in.`,
        priority: 60,
        target: { kind: 'route', id: '/revision' },
      });
    }

    // New lessons — foundations solid, next step unlocked.
    for (const c of items.filter((i) => i.status === 'ready').slice(0, 2)) {
      out.push({
        kind: 'lesson',
        dedupeKey: `lesson:${c.conceptId}`,
        title: `New lesson: ${c.name}`,
        reason: `You've mastered what "${c.name}" builds on — you're ready to start it.`,
        priority: 50,
        target: { kind: 'concept', id: c.conceptId },
      });
    }

    // Readings — a document that reinforces what the learner is working on.
    const reading = linkedDocs[0];
    if (reading) {
      out.push({
        kind: 'reading',
        dedupeKey: `reading:${reading.documentId}`,
        title: `Read: ${reading.title}`,
        reason: `This supports "${reading.conceptName}", which is on your path right now.`,
        priority: 40,
        target: { kind: 'document', id: reading.documentId },
      });
    }

    // Practicals — apply something already mastered so it sticks for good.
    const mastered = items.find((i) => i.status === 'mastered');
    if (mastered) {
      out.push({
        kind: 'practical',
        dedupeKey: `practical:${mastered.conceptId}`,
        title: `Try a practical on ${mastered.name}`,
        reason: `You've mastered "${mastered.name}" — applying it in practice makes it permanent.`,
        priority: 30,
        target: { kind: 'concept', id: mastered.conceptId },
      });
    }

    // Documents — a library file not yet connected to the learner's knowledge.
    const orphan = orphanDocs[0];
    if (orphan) {
      out.push({
        kind: 'document',
        dedupeKey: `document:${orphan.id}`,
        title: `Connect: ${orphan.title}`,
        reason: `"${orphan.title}" isn't linked to any concept yet — extracting it grows your Digital Twin.`,
        priority: 20,
        target: { kind: 'document', id: orphan.id },
      });
    }

    return out;
  }

  /** Documents linked to concepts currently on the learner's active path. */
  private async focusDocuments(
    userId: string,
  ): Promise<{ documentId: string; title: string; conceptName: string }[]> {
    const { items } = await this.learningPath
      .next(userId)
      .catch(() => ({ items: [] as LearningPathItem[] }));
    const focusIds = items
      .filter((i) => ['at_risk', 'in_progress', 'ready'].includes(i.status))
      .map((i) => i.conceptId);
    if (focusIds.length === 0) return [];

    const links = await this.prisma.conceptDocument.findMany({
      where: { conceptId: { in: focusIds }, document: { userId, deletedAt: null } },
      select: {
        documentId: true,
        document: { select: { title: true } },
        concept: { select: { name: true } },
      },
      take: 5,
    });
    return links.map((l) => ({
      documentId: l.documentId,
      title: l.document.title,
      conceptName: l.concept.name,
    }));
  }

  /** Library documents not yet linked to any concept. */
  private orphanDocuments(userId: string): Promise<{ id: string; title: string }[]> {
    return this.prisma.document.findMany({
      where: { userId, deletedAt: null, status: 'ready', concepts: { none: {} } },
      select: { id: true, title: true },
      orderBy: { createdAt: 'desc' },
      take: 3,
    });
  }

  private toView(row: Recommendation): ResourceRecommendation {
    return {
      id: row.id,
      kind: row.kind as ResourceKind,
      title: row.title,
      reason: row.reason,
      status: row.status,
      target:
        row.targetKind && row.targetId
          ? { kind: row.targetKind as RecommendationTarget['kind'], id: row.targetId }
          : null,
      createdAt: row.createdAt.toISOString(),
    };
  }
}
