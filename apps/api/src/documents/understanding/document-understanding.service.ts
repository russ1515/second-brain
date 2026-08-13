import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Document } from '@prisma/client';
import type {
  CompareResponse,
  DocumentPrerequisites,
  KeyConcept,
  LearnerLevel,
  PrerequisiteConcept,
  UnderstandMode,
  UnderstandResponse,
} from '@second-brain/shared';
import { LlmService } from '../../llm/llm.service';
import { PrismaService } from '../../prisma/prisma.service';
import { MasteryService } from '../../concepts/mastery.service';

const MAX_CONTENT_CHARS = 8000;
/** Below this shorter cap per side so a two-document prompt stays reasonable. */
const MAX_COMPARE_CHARS = 5000;

/** Mode → the teacher's task. Kept separate from the twin-adaptation line so the
 *  two compose cleanly. */
const MODE_TASK: Record<UnderstandMode, string> = {
  summarize:
    'Write a clear, well-structured summary of the document, capturing its key points.',
  rephrase:
    'Rephrase the document in your own words — same meaning, clearer wording — without leaving anything important out.',
  simplify:
    'Explain the document in the simplest possible terms, using plain language and everyday analogies, as if to a curious beginner.',
  explain:
    'Teach the document: explain what it means, why it matters, and how the ideas connect, as a patient tutor would.',
};

/**
 * AI Document Understanding (Sprint 6.5) — the teacher doesn't just answer, it
 * works WITH a document: summarise, rephrase, simplify, explain, compare two
 * documents, and surface the important notions + prerequisites. Every generated
 * explanation is ADAPTED to the learner's Digital Twin (their level and what
 * they've already mastered vs. still find hard). Results are ephemeral —
 * generated and returned, never persisted.
 */
@Injectable()
export class DocumentUnderstandingService {
  private readonly logger = new Logger(DocumentUnderstandingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly mastery: MasteryService,
  ) {}

  async understand(
    userId: string,
    documentId: string,
    mode: UnderstandMode,
  ): Promise<UnderstandResponse> {
    const doc = await this.own(userId, documentId);
    const adaptation = await this.twinAdaptation(userId, documentId);

    const system = [
      'You are Second Brain, a patient AI teacher who understands study material.',
      MODE_TASK[mode],
      adaptation.instruction,
      'Respond in the SAME language as the document. Use clean markdown. Do not',
      'invent facts that are not in the document. Output only the result.',
    ].join(' ');

    const text = await this.generate(
      system,
      `Document titled "${doc.title}":\n\n${doc.content.slice(0, MAX_CONTENT_CHARS)}`,
    );
    return { mode, text, level: adaptation.level };
  }

  async compare(
    userId: string,
    documentId: string,
    otherDocumentId: string,
  ): Promise<CompareResponse> {
    if (documentId === otherDocumentId) {
      throw new NotFoundException('Choose a different second document to compare.');
    }
    const [a, b] = await Promise.all([
      this.own(userId, documentId),
      this.own(userId, otherDocumentId),
    ]);
    const adaptation = await this.twinAdaptation(userId, documentId);

    const system = [
      'You are Second Brain, an AI teacher comparing two study documents.',
      'Explain what the two documents have in common, how they differ, and which',
      'one to study first and why.',
      adaptation.instruction,
      'Respond in the language of the documents. Use clean markdown with short',
      'sections. Base everything only on the two documents.',
    ].join(' ');

    const text = await this.generate(
      system,
      `Document A — "${a.title}":\n${a.content.slice(0, MAX_COMPARE_CHARS)}\n\n` +
        `Document B — "${b.title}":\n${b.content.slice(0, MAX_COMPARE_CHARS)}`,
    );
    return { text, documentTitle: a.title, otherTitle: b.title, level: adaptation.level };
  }

  /**
   * The document's important notions + the prerequisites to review first, each
   * annotated with the learner's real mastery. Pure graph + twin data — no LLM,
   * so it is grounded and cheap.
   */
  async prerequisites(
    userId: string,
    documentId: string,
  ): Promise<DocumentPrerequisites> {
    await this.own(userId, documentId);

    const links = await this.prisma.conceptDocument.findMany({
      where: { documentId },
      select: { conceptId: true },
    });
    const conceptIds = links.map((l) => l.conceptId);
    const masteryById = await this.masteryByConcept(userId);

    const docConcepts = await this.prisma.concept.findMany({
      where: { id: { in: conceptIds } },
      select: { id: true, name: true },
    });
    const keyConcepts: KeyConcept[] = docConcepts.map((c) =>
      this.toKeyConcept(c.id, c.name, masteryById),
    );

    // Prerequisites = concepts pointing INTO the doc's concepts via a
    // prerequisite edge, that are NOT themselves part of the document.
    const edges = await this.prisma.conceptEdge.findMany({
      where: { relation: 'prerequisite', targetId: { in: conceptIds } },
      select: {
        source: { select: { id: true, name: true } },
        target: { select: { id: true, name: true } },
      },
    });
    const inDoc = new Set(conceptIds);
    const prerequisites: PrerequisiteConcept[] = edges
      .filter((e) => !inDoc.has(e.source.id))
      .map((e) => ({
        ...this.toKeyConcept(e.source.id, e.source.name, masteryById),
        forConcept: e.target.name,
      }));

    // Weakest prerequisites first — those are what to review before starting.
    prerequisites.sort((a, b) => (a.mastery ?? 0) - (b.mastery ?? 0));
    return { keyConcepts, prerequisites };
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async own(userId: string, id: string): Promise<Document> {
    const doc = await this.prisma.document.findUnique({ where: { id } });
    if (!doc || doc.userId !== userId) {
      throw new NotFoundException('Document not found.');
    }
    return doc;
  }

  /** Build the twin-adaptation instruction + the level, from the learner's
   *  overall mastery and their grasp of this document's own concepts. */
  private async twinAdaptation(
    userId: string,
    documentId: string,
  ): Promise<{ instruction: string; level: LearnerLevel }> {
    const twin = await this.mastery.twin(userId);
    const level = this.levelOf(twin.summary.averageMastery);

    const conceptIds = (
      await this.prisma.conceptDocument.findMany({
        where: { documentId },
        select: { conceptId: true },
      })
    ).map((l) => l.conceptId);
    const relevant = twin.concepts.filter(
      (c) => conceptIds.includes(c.conceptId) && c.mastery !== null,
    );
    const mastered = relevant.filter((c) => (c.mastery ?? 0) >= 0.8).map((c) => c.name);
    const weak = relevant.filter((c) => (c.mastery ?? 0) < 0.5).map((c) => c.name);

    const parts = [
      `Adapt your explanation to a learner at ${level} level.`,
    ];
    if (mastered.length > 0) {
      parts.push(
        `They have already mastered: ${mastered.join(', ')} — build on that, don't over-explain it.`,
      );
    }
    if (weak.length > 0) {
      parts.push(
        `They still find these hard: ${weak.join(', ')} — go slower and give extra help there.`,
      );
    }
    return { instruction: parts.join(' '), level };
  }

  private levelOf(averageMastery: number | null): LearnerLevel {
    if (averageMastery === null) return 'new';
    if (averageMastery < 0.5) return 'beginner';
    if (averageMastery < 0.8) return 'intermediate';
    return 'advanced';
  }

  private async masteryByConcept(
    userId: string,
  ): Promise<Map<string, { mastery: number | null; level: string }>> {
    const twin = await this.mastery.twin(userId);
    return new Map(
      twin.concepts.map((c) => [c.conceptId, { mastery: c.mastery, level: c.level }]),
    );
  }

  private toKeyConcept(
    id: string,
    name: string,
    masteryById: Map<string, { mastery: number | null; level: string }>,
  ): KeyConcept {
    const m = masteryById.get(id);
    return { id, name, mastery: m?.mastery ?? null, level: m?.level ?? 'unknown' };
  }

  private async generate(system: string, user: string): Promise<string> {
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        { temperature: 0.3 },
      );
      return result.text.trim();
    } catch (error) {
      this.logger.error(`Understanding LLM call failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The language model is temporarily unavailable. Please try again shortly.',
      );
    }
  }
}
