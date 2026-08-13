import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type {
  IntegrationConcept,
  IntegrationLink,
  KnowledgeIntegration,
} from '@second-brain/shared';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MasteryService } from '../../concepts/mastery.service';

/** How many existing concepts to offer the LLM as link candidates. */
const MAX_EXISTING = 40;

const LINK_PROMPT = [
  'You connect newly-learned concepts to a learner\'s existing knowledge for a',
  'knowledge graph. Return ONLY a JSON array of {"from","to","relation"} where',
  '"relation" is "prerequisite" (from must be understood before to) or "related".',
  'Each link MUST connect a NEW concept to an EXISTING one (in either direction).',
  'Use ONLY names from the two lists provided; do not invent names. Return [] if',
  'there are no meaningful connections. No markdown, no commentary.',
].join(' ');

interface RawLink {
  from: string;
  to: string;
  relation: string;
}

/**
 * Smart Knowledge Integration (Sprint 6.8). Two jobs:
 *  - `linkToExisting`: after a document's concepts are extracted, connect them to
 *    the concepts the learner already has from OTHER documents (cross-document
 *    edges), so the Knowledge Graph is one connected brain, not per-doc islands.
 *  - `report`: surface how a document was integrated — new vs known concepts,
 *    links to existing knowledge, prerequisites, dependents, and what the learner
 *    already masters vs still finds fragile (from ConceptMastery / the twin).
 */
@Injectable()
export class KnowledgeIntegrationService {
  private readonly logger = new Logger(KnowledgeIntegrationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly mastery: MasteryService,
  ) {}

  /** Connect a document's concepts to existing knowledge. Never throws. */
  async linkToExisting(userId: string, documentId: string): Promise<number> {
    try {
      const docConcepts = await this.docConcepts(documentId);
      if (docConcepts.length === 0) return 0;
      const docIds = new Set(docConcepts.map((c) => c.id));

      const existing = await this.prisma.concept.findMany({
        where: { userId, id: { notIn: [...docIds] } },
        orderBy: { updatedAt: 'desc' },
        take: MAX_EXISTING,
        select: { id: true, name: true },
      });
      if (existing.length === 0) return 0;

      const raw = await this.llm.generate(
        [
          { role: 'system', content: LINK_PROMPT },
          {
            role: 'user',
            content:
              `NEW concepts: ${docConcepts.map((c) => c.name).join(', ')}\n\n` +
              `EXISTING concepts: ${existing.map((c) => c.name).join(', ')}`,
          },
        ],
        { temperature: 0.2 },
      );

      const idByName = new Map<string, string>();
      for (const c of [...docConcepts, ...existing]) {
        idByName.set(this.norm(c.name), c.id);
      }

      let created = 0;
      for (const link of this.parseLinks(raw.text)) {
        const sourceId = idByName.get(this.norm(link.from));
        const targetId = idByName.get(this.norm(link.to));
        if (!sourceId || !targetId || sourceId === targetId) continue;
        // Must be a cross-link (one endpoint in the doc, one outside).
        if (docIds.has(sourceId) === docIds.has(targetId)) continue;
        const relation = link.relation === 'prerequisite' ? 'prerequisite' : 'related';
        const ok = await this.prisma.conceptEdge
          .create({ data: { userId, sourceId, targetId, relation } })
          .then(() => true)
          .catch((e) => {
            if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') {
              return false;
            }
            throw e;
          });
        if (ok) created++;
      }
      if (created > 0) {
        this.logger.log(`Integrated document ${documentId}: +${created} cross-link(s).`);
      }
      return created;
    } catch (error) {
      this.logger.warn(
        `Cross-document linking skipped for ${documentId}: ${(error as Error).message}`,
      );
      return 0;
    }
  }

  /** Build the integration report for a document. */
  async report(userId: string, documentId: string): Promise<KnowledgeIntegration> {
    const doc = await this.prisma.document.findUnique({ where: { id: documentId } });
    if (!doc || doc.userId !== userId) {
      throw new NotFoundException('Document not found.');
    }

    const docConcepts = await this.docConcepts(documentId);
    const docIds = new Set(docConcepts.map((c) => c.id));
    const masteryById = await this.masteryByConcept(userId);
    const nameById = new Map<string, string>();

    // documentCount per concept → new (this doc only) vs known (also elsewhere).
    const counts = await this.prisma.conceptDocument.groupBy({
      by: ['conceptId'],
      where: { conceptId: { in: [...docIds] } },
      _count: { _all: true },
    });
    const docCountById = new Map(counts.map((c) => [c.conceptId, c._count._all]));

    const asConcept = (id: string, name: string): IntegrationConcept => {
      nameById.set(id, name);
      const m = masteryById.get(id);
      return { id, name, mastery: m?.mastery ?? null, level: m?.level ?? 'unknown' };
    };

    const newConcepts: IntegrationConcept[] = [];
    const knownConcepts: IntegrationConcept[] = [];
    const mastered: IntegrationConcept[] = [];
    const fragile: IntegrationConcept[] = [];
    for (const c of docConcepts) {
      const ic = asConcept(c.id, c.name);
      ((docCountById.get(c.id) ?? 1) > 1 ? knownConcepts : newConcepts).push(ic);
      const m = masteryById.get(c.id);
      if (m && m.mastery !== null && m.mastery >= 0.8) mastered.push(ic);
      if (m && m.mastery !== null && m.reviewed && m.mastery < 0.5) fragile.push(ic);
    }

    // Edges touching the doc's concepts, resolving the neighbour's name.
    const edges = await this.prisma.conceptEdge.findMany({
      where: {
        userId,
        OR: [{ sourceId: { in: [...docIds] } }, { targetId: { in: [...docIds] } }],
      },
      select: {
        relation: true,
        source: { select: { id: true, name: true } },
        target: { select: { id: true, name: true } },
      },
    });

    const linksToExisting: IntegrationLink[] = [];
    const prerequisites: IntegrationConcept[] = [];
    const dependents: IntegrationConcept[] = [];
    const seenPrereq = new Set<string>();
    const seenDep = new Set<string>();
    for (const e of edges) {
      const srcInDoc = docIds.has(e.source.id);
      const tgtInDoc = docIds.has(e.target.id);
      if (srcInDoc === tgtInDoc) continue; // only cross-links to existing knowledge
      const external = srcInDoc ? e.target : e.source;
      linksToExisting.push({
        concept: srcInDoc ? e.source.name : e.target.name,
        relatedTo: external.name,
        relation: e.relation,
      });
      if (e.relation === 'prerequisite') {
        // prereq → docConcept : the external source is a prerequisite to review.
        if (tgtInDoc && !seenPrereq.has(e.source.id)) {
          seenPrereq.add(e.source.id);
          prerequisites.push(asConcept(e.source.id, e.source.name));
        }
        // docConcept → external : the external target depends on this doc.
        if (srcInDoc && !seenDep.has(e.target.id)) {
          seenDep.add(e.target.id);
          dependents.push(asConcept(e.target.id, e.target.name));
        }
      }
    }

    const chunks = await this.prisma.documentChunk.count({ where: { documentId } });

    return {
      newConcepts,
      knownConcepts,
      linksToExisting,
      prerequisites,
      dependents,
      mastered,
      fragile,
      summary: { concepts: docConcepts.length, chunks, edges: edges.length },
    };
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async docConcepts(
    documentId: string,
  ): Promise<{ id: string; name: string }[]> {
    const links = await this.prisma.conceptDocument.findMany({
      where: { documentId },
      select: { concept: { select: { id: true, name: true } } },
    });
    return links.map((l) => l.concept);
  }

  private async masteryByConcept(
    userId: string,
  ): Promise<Map<string, { mastery: number | null; level: string; reviewed: boolean }>> {
    const twin = await this.mastery.twin(userId);
    return new Map(
      twin.concepts.map((c) => [
        c.conceptId,
        { mastery: c.mastery, level: c.level, reviewed: c.reviewedCount > 0 },
      ]),
    );
  }

  private parseLinks(raw: string): RawLink[] {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end <= start) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x): x is RawLink =>
          !!x &&
          typeof (x as RawLink).from === 'string' &&
          typeof (x as RawLink).to === 'string',
      )
      .map((x) => ({ from: x.from, to: x.to, relation: String(x.relation ?? 'related') }));
  }

  private norm(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }
}
