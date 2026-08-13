import { Injectable } from '@nestjs/common';
import type { ConceptMastery, KnowledgeGap } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService, STRONG_MASTERY } from './mastery.service';

/**
 * Knowledge-gap detection (Educational Engine spec).
 *
 * "Mistakes are never isolated; each triggers root-cause analysis via the
 * Knowledge Graph (fails Genetics → weak DNA detected → revisit DNA → DNA
 * exercises → only then resume Genetics). Repair gaps, don't hide them."
 *
 * So this does not stop at the first weak prerequisite: it walks the whole
 * prerequisite chain upwards and blames the ROOT — the weakest concept that has
 * no weak prerequisite of its own. Fixing Genetics is pointless if DNA is broken;
 * fixing DNA is pointless if the molecule basics under it are broken too.
 */
@Injectable()
export class RootCauseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
  ) {}

  /**
   * The prerequisite most likely responsible for failing `conceptId`, or null
   * when every prerequisite is solid (the mistake is about this concept itself).
   */
  async findFor(userId: string, conceptId: string): Promise<KnowledgeGap | null> {
    const now = new Date();
    const concepts = await this.prisma.concept.findMany({
      where: { userId },
      include: {
        cards: { include: { card: true } },
        // Incoming prerequisite edges: each source is a prerequisite of this concept.
        incomingEdges: {
          where: { relation: 'prerequisite' },
          include: { source: { select: { id: true } } },
        },
      },
    });

    const byId = new Map(concepts.map((c) => [c.id, c]));
    if (!byId.has(conceptId)) return null;

    const masteryById = new Map<string, ConceptMastery>(
      concepts.map((c) => [c.id, this.mastery.computeMastery(c, now)]),
    );
    const prereqIds = (id: string): string[] =>
      (byId.get(id)?.incomingEdges ?? []).map((e) => e.source.id);

    // Walk up the prerequisite chain. `visited` also breaks cycles, which the
    // schema permits (it only blocks self-edges).
    const visited = new Set<string>([conceptId]);
    const queue = [...prereqIds(conceptId)];
    const weak: string[] = [];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (visited.has(current)) continue;
      visited.add(current);
      if (!this.isSolid(masteryById.get(current))) {
        weak.push(current);
        // Only keep climbing through a weak link: a solid prerequisite cannot
        // be the reason something above it broke.
        queue.push(...prereqIds(current));
      }
    }

    if (weak.length === 0) return null;

    // The root is a weak concept with no weak prerequisite of its own.
    const weakSet = new Set(weak);
    const roots = weak.filter(
      (id) => !prereqIds(id).some((p) => weakSet.has(p)),
    );
    const candidates = roots.length > 0 ? roots : weak;

    // Among the roots, blame the weakest; untracked concepts (no cards, mastery
    // null) sort as the weakest of all — never studied is the deepest gap.
    candidates.sort(
      (a, b) => this.rank(masteryById.get(a)) - this.rank(masteryById.get(b)),
    );
    const blamed = masteryById.get(candidates[0])!;

    return {
      conceptId: blamed.conceptId,
      name: blamed.name,
      mastery: blamed.mastery,
      reason: this.reason(blamed, candidates[0] !== conceptId),
    };
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** Solid = mastered. An untracked concept (no cards) is NOT solid: we have no
   *  evidence the learner knows it. */
  private isSolid(m: ConceptMastery | undefined): boolean {
    return m?.mastery != null && m.mastery >= STRONG_MASTERY;
  }

  private rank(m: ConceptMastery | undefined): number {
    // null mastery (never studied) is the weakest possible.
    return m?.mastery ?? -1;
  }

  private reason(m: ConceptMastery, isPrerequisite: boolean): string {
    const where = isPrerequisite ? 'This prerequisite' : 'This concept';
    if (m.mastery === null) {
      return `${where} has never been studied — that is the gap under this mistake.`;
    }
    return (
      `${where} sits at ${Math.round(m.mastery * 100)}% mastery (${m.level}). ` +
      `Repair it before pushing further up.`
    );
  }
}
