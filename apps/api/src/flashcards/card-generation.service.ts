import {
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { GenerateCardsResponse } from '@second-brain/shared';
import { LlmService } from '../llm/llm.service';
import { PrismaService } from '../prisma/prisma.service';
import { toCardView } from './card.mapper';

const DEFAULT_COUNT = 10;
const MAX_COUNT = 50;
/** Cap the material sent to the model so a huge document doesn't blow the context. */
const MAX_CONTENT_CHARS = 8000;
const MAX_FIELD_CHARS = 2000;

const SYSTEM_PROMPT = [
  'You are a study assistant that writes high-quality flashcards.',
  'From the source material, create question/answer flashcards that test',
  'understanding of the key facts and concepts. Each card must be self-contained.',
  'Respond with ONLY a JSON array of objects, each with string fields "front"',
  '(the question or prompt) and "back" (the concise answer). No markdown, no code',
  'fences, no commentary.',
].join(' ');

interface RawCard {
  front: string;
  back: string;
}

/** Generates flashcards from an ingested document using the LLM seam. */
@Injectable()
export class CardGenerationService {
  private readonly logger = new Logger(CardGenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
  ) {}

  async generateFromDocument(
    userId: string,
    documentId: string,
    options: { deckId?: string; count?: number } = {},
  ): Promise<GenerateCardsResponse> {
    const document = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!document || document.userId !== userId) {
      throw new NotFoundException('Document not found.');
    }
    if (!document.content.trim()) {
      throw new UnprocessableEntityException('Document has no text to learn from.');
    }

    const count = this.clampCount(options.count);
    const deckId = await this.resolveDeck(userId, options.deckId, document.title);

    const pairs = await this.generatePairs(document.content, document.title, count);
    if (pairs.length === 0) {
      throw new UnprocessableEntityException(
        'The model did not return any usable flashcards. Try again.',
      );
    }

    const created = await this.prisma.$transaction(
      pairs.slice(0, count).map((pair) =>
        this.prisma.card.create({
          data: {
            deckId,
            userId,
            front: pair.front.slice(0, MAX_FIELD_CHARS),
            back: pair.back.slice(0, MAX_FIELD_CHARS),
            sourceDocumentId: documentId,
          },
        }),
      ),
    );

    return {
      deckId,
      cards: created.map(toCardView),
      created: created.length,
    };
  }

  // ── internals ────────────────────────────────────────────────────────────

  private clampCount(count?: number): number {
    if (count === undefined) {
      return DEFAULT_COUNT;
    }
    return Math.min(Math.max(Math.trunc(count), 1), MAX_COUNT);
  }

  /** Use the given deck (must be owned) or create one named after the document. */
  private async resolveDeck(
    userId: string,
    deckId: string | undefined,
    documentTitle: string,
  ): Promise<string> {
    if (deckId) {
      const deck = await this.prisma.deck.findUnique({ where: { id: deckId } });
      if (!deck || deck.userId !== userId) {
        throw new NotFoundException('Deck not found.');
      }
      return deck.id;
    }
    const deck = await this.prisma.deck.create({
      data: {
        userId,
        name: documentTitle.slice(0, 200),
        description: 'Generated from a document.',
      },
    });
    return deck.id;
  }

  private async generatePairs(
    content: string,
    title: string,
    count: number,
  ): Promise<RawCard[]> {
    const material = content.slice(0, MAX_CONTENT_CHARS);
    let text: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: SYSTEM_PROMPT },
          {
            role: 'user',
            content:
              `Create up to ${count} flashcards from this material` +
              ` (titled "${title}"):\n\n${material}`,
          },
        ],
        { temperature: 0.3 },
      );
      text = result.text;
    } catch (error) {
      this.logger.error(`LLM generation failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The language model is temporarily unavailable. Please try again shortly.',
      );
    }
    return this.parseCards(text);
  }

  /** Parse the model output into card pairs, tolerating code fences / stray prose. */
  private parseCards(raw: string): RawCard[] {
    const start = raw.indexOf('[');
    const end = raw.lastIndexOf(']');
    if (start === -1 || end <= start) {
      return [];
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return [];
    }
    if (!Array.isArray(parsed)) {
      return [];
    }
    return parsed
      .filter(
        (item): item is RawCard =>
          !!item &&
          typeof (item as RawCard).front === 'string' &&
          typeof (item as RawCard).back === 'string' &&
          (item as RawCard).front.trim().length > 0 &&
          (item as RawCard).back.trim().length > 0,
      )
      .map((item) => ({ front: item.front.trim(), back: item.back.trim() }));
  }
}
