import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { ExtractConceptsResponse } from '@second-brain/shared';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { ConceptService } from './concept.service';

const DEFAULT_MAX = 12;
const HARD_MAX = 30;
const MAX_CONTENT_CHARS = 8000;

const SYSTEM_PROMPT = [
  'You extract the key learnable concepts from study material for a knowledge graph.',
  'Return ONLY a JSON array of objects, each with: "name" (a short concept title,',
  '2-5 words), "description" (one sentence), and "prerequisites" (an array of the',
  'names of OTHER concepts in this same list that a learner should understand first;',
  'use [] if none). Only reference names that appear in your array. No markdown, no',
  'code fences, no commentary.',
].join(' ');

interface RawConcept {
  name: string;
  description?: string;
  prerequisites?: string[];
}

/** Extracts concepts (+ prerequisite edges) from a document via the LLM seam. */
@Injectable()
export class ConceptExtractionService {
  private readonly logger = new Logger(ConceptExtractionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly concepts: ConceptService,
  ) {}

  async extractFromDocument(
    userId: string,
    documentId: string,
    options: { maxConcepts?: number } = {},
  ): Promise<ExtractConceptsResponse> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document || document.userId !== userId) {
      throw new NotFoundException('Document not found.');
    }
    if (!document.content.trim()) {
      throw new UnprocessableEntityException('Document has no text to learn from.');
    }

    const max = Math.min(Math.max(options.maxConcepts ?? DEFAULT_MAX, 1), HARD_MAX);
    const raw = await this.callLlm(document.content, document.title, max);
    const parsed = this.parseConcepts(raw).slice(0, max);
    if (parsed.length === 0) {
      throw new UnprocessableEntityException(
        'The model did not return any usable concepts. Try again.',
      );
    }

    // 1) Upsert concepts + link them to the document. Build a normalized-name → id map.
    const idByName = new Map<string, string>();
    let createdConcepts = 0;
    for (const item of parsed) {
      const normalizedName = this.normalize(item.name);
      if (!normalizedName || idByName.has(normalizedName)) {
        continue;
      }
      let concept = await this.prisma.concept.findUnique({
        where: { userId_normalizedName: { userId, normalizedName } },
      });
      if (!concept) {
        concept = await this.prisma.concept.create({
          data: {
            userId,
            name: item.name.trim().slice(0, 200),
            normalizedName,
            description: item.description?.trim()?.slice(0, 2000) || null,
          },
        });
        createdConcepts++;
      }
      idByName.set(normalizedName, concept.id);
      await this.prisma.conceptDocument
        .create({ data: { conceptId: concept.id, documentId } })
        .catch((error) => {
          if (!this.isUnique(error)) throw error; // already linked → ok
        });
    }

    // 2) Create prerequisite edges (prereq → concept) within the extracted set.
    let createdEdges = 0;
    for (const item of parsed) {
      const targetId = idByName.get(this.normalize(item.name));
      if (!targetId) continue;
      for (const prereq of item.prerequisites ?? []) {
        const sourceId = idByName.get(this.normalize(prereq));
        if (!sourceId || sourceId === targetId) continue;
        const created = await this.prisma.conceptEdge
          .create({
            data: { userId, sourceId, targetId, relation: 'prerequisite' },
          })
          .then(() => true)
          .catch((error) => {
            if (this.isUnique(error)) return false; // edge already exists
            throw error;
          });
        if (created) createdEdges++;
      }
    }

    return {
      documentId,
      concepts: await this.concepts.listForDocument(userId, documentId),
      createdConcepts,
      createdEdges,
    };
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async callLlm(
    content: string,
    title: string,
    max: number,
  ): Promise<string> {
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content:
              `Extract up to ${max} key concepts from this material` +
              ` (titled "${title}"):\n\n${content.slice(0, MAX_CONTENT_CHARS)}`,
          },
        ],
        { temperature: 0.2 },
      );
      return result.text;
    } catch (error) {
      this.logger.error(`LLM extraction failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The language model is temporarily unavailable. Please try again shortly.',
      );
    }
  }

  private parseConcepts(raw: string): RawConcept[] {
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
        (item): item is RawConcept =>
          !!item &&
          typeof (item as RawConcept).name === 'string' &&
          (item as RawConcept).name.trim().length > 0,
      )
      .map((item) => ({
        name: item.name,
        description:
          typeof item.description === 'string' ? item.description : undefined,
        prerequisites: Array.isArray(item.prerequisites)
          ? item.prerequisites.filter((p): p is string => typeof p === 'string')
          : [],
      }));
  }

  private normalize(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private isUnique(error: unknown): boolean {
    return (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    );
  }
}
