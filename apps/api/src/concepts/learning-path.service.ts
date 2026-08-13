import { Injectable } from '@nestjs/common';
import { NotFoundException } from '@nestjs/common';
import type {
  AdaptivePath,
  AdaptivePathStep,
  ConceptMastery,
  ConceptRef,
  LearningPath,
  LearningPathItem,
  LearningStatus,
  TwinGraph,
  TwinGraphNode,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MasteryService, STRONG_MASTERY } from './mastery.service';

/** Priority order for the study plan (lower = study sooner). */
const STATUS_PRIORITY: Record<LearningStatus, number> = {
  at_risk: 0,
  in_progress: 1,
  ready: 2,
  blocked: 3,
  mastered: 4,
};

/** Turns the concept graph + mastery into an actionable, prerequisite-aware plan. */
@Injectable()
export class LearningPathService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mastery: MasteryService,
  ) {}

  /** Prioritised list of what to study next. */
  async next(userId: string): Promise<LearningPath> {
    const { items } = await this.analyze(userId);
    items.sort(
      (a, b) =>
        STATUS_PRIORITY[a.status] - STATUS_PRIORITY[b.status] ||
        this.masteryRank(a.mastery) - this.masteryRank(b.mastery) ||
        a.name.localeCompare(b.name),
    );
    return { items };
  }

  /** The knowledge graph annotated with each concept's mastery + status. */
  async graph(userId: string): Promise<TwinGraph> {
    const { items } = await this.analyze(userId);
    const edges = await this.prisma.conceptEdge.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
    return {
      nodes: items.map((i) => ({
        id: i.conceptId,
        name: i.name,
        mastery: i.mastery,
        level: i.level,
        status: i.status,
      })),
      edges: edges.map((e) => ({
        id: e.id,
        sourceId: e.sourceId,
        targetId: e.targetId,
        relation: e.relation,
      })),
    };
  }

  /**
   * Adaptive Learning Path (task 5.7) — the ⭐ engine. Given a GOAL concept the
   * learner wants to reach, it walks the Knowledge Graph of prerequisites,
   * checks each one's mastery (ConceptMastery / Digital Twin / FSRS), and orders
   * the journey: consolidate the weak prerequisites FIRST (dependency order),
   * the goal last. The system decides the order — "before Genetics, consolidate
   * DNA and Mitosis".
   */
  async pathTo(userId: string, targetId: string): Promise<AdaptivePath> {
    const graph = await this.graph(userId);
    const byId = new Map<string, TwinGraphNode>(graph.nodes.map((n) => [n.id, n]));
    const target = byId.get(targetId);
    if (!target) {
      throw new NotFoundException('Concept not found.');
    }

    // Prerequisites-of map: a prerequisite edge (source → target) means source
    // must be learned before target.
    const prereqsOf = new Map<string, string[]>();
    for (const e of graph.edges) {
      if (e.relation !== 'prerequisite') continue;
      const list = prereqsOf.get(e.targetId) ?? [];
      list.push(e.sourceId);
      prereqsOf.set(e.targetId, list);
    }

    // Post-order DFS from the goal: prerequisites emerge before their dependents,
    // the goal last. A visited set dedupes shared prerequisites and breaks cycles.
    const ordered: string[] = [];
    const visited = new Set<string>();
    const walk = (id: string) => {
      if (visited.has(id)) return;
      visited.add(id);
      for (const p of prereqsOf.get(id) ?? []) walk(p);
      ordered.push(id);
    };
    walk(targetId);

    const steps: AdaptivePathStep[] = ordered.map((id) => {
      const node = byId.get(id)!;
      const isTarget = id === targetId;
      const solid = node.level === 'strong' || node.status === 'mastered';
      return {
        conceptId: id,
        name: node.name,
        mastery: node.mastery === null ? null : Math.round(node.mastery * 100),
        action: isTarget ? 'target' : solid ? 'ready' : 'consolidate',
      };
    });

    const consolidateFirst = steps
      .filter((s) => s.action === 'consolidate')
      .map((s) => s.name);

    return {
      target: { conceptId: targetId, name: target.name },
      steps,
      consolidateFirst,
      readyForTarget: consolidateFirst.length === 0,
    };
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** Compute mastery + prerequisite-aware status for every concept. */
  private async analyze(userId: string): Promise<{ items: LearningPathItem[] }> {
    const now = new Date();
    const concepts = await this.prisma.concept.findMany({
      where: { userId },
      include: {
        cards: { include: { card: true } },
        // Incoming prerequisite edges: source concepts are this one's prerequisites.
        incomingEdges: {
          where: { relation: 'prerequisite' },
          include: { source: { select: { id: true, name: true } } },
        },
      },
    });

    const masteryById = new Map<string, ConceptMastery>(
      concepts.map((c) => [c.id, this.mastery.computeMastery(c, now)]),
    );

    const items = concepts.map((concept) => {
      const m = masteryById.get(concept.id)!;
      const blockedBy: ConceptRef[] = concept.incomingEdges
        .map((e) => e.source)
        .filter((prereq) => !this.isMastered(masteryById.get(prereq.id)));

      return {
        conceptId: concept.id,
        name: concept.name,
        status: this.classify(m, blockedBy.length > 0),
        mastery: m.mastery,
        level: m.level,
        dueCount: m.dueCount,
        blockedBy,
      };
    });

    return { items };
  }

  private classify(m: ConceptMastery, hasUnmetPrereqs: boolean): LearningStatus {
    if (this.isMastered(m)) {
      return 'mastered';
    }
    if (m.reviewedCount > 0) {
      // Already being learned: needs review if decayed or has due cards.
      return m.dueCount > 0 || (m.mastery ?? 0) < 0.5 ? 'at_risk' : 'in_progress';
    }
    // Not started yet.
    return hasUnmetPrereqs ? 'blocked' : 'ready';
  }

  private isMastered(m: ConceptMastery | undefined): boolean {
    return m?.mastery != null && m.mastery >= STRONG_MASTERY;
  }

  private masteryRank(mastery: number | null): number {
    return mastery ?? Number.POSITIVE_INFINITY;
  }
}
