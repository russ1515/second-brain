import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { LanguageProfile } from '@prisma/client';
import type {
  ExtractVocabularyResponse,
  VocabularyItem,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { toCardView } from '../flashcards/card.mapper';
import { LanguageService } from './language.service';
import { modeSpec } from './language-modes';
import type { ExtractVocabularyDto } from './dto/extract-vocabulary.dto';

const DEFAULT_COUNT = 12;
const MAX_COUNT = 40;
const MAX_SOURCE_CHARS = 8000;
const MAX_FIELD_CHARS = 2000;

/** Mines vocabulary out of material and turns it into ordinary FSRS cards in the
 *  language's vocabulary deck. No new spaced-repetition machinery: the cards are
 *  Cards, so the Phase 3 review queue picks them up untouched. */
@Injectable()
export class VocabularyService {
  private readonly logger = new Logger(VocabularyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly languages: LanguageService,
  ) {}

  async extract(
    userId: string,
    profileId: string,
    dto: ExtractVocabularyDto,
  ): Promise<ExtractVocabularyResponse> {
    const profile = await this.languages.requireOwned(userId, profileId);
    const source = await this.resolveSource(userId, dto);
    const count = this.clampCount(dto.count);
    const deckId = await this.languages.ensureVocabDeck(profile);

    const items = await this.mine(profile, source, count);
    if (items.length === 0) {
      throw new UnprocessableEntityException(
        'The teacher did not return any usable vocabulary. Try again.',
      );
    }

    // Don't re-teach words already in the deck — extraction must be idempotent
    // enough to run repeatedly over overlapping material.
    const existing = await this.prisma.card.findMany({
      where: { userId, deckId },
      select: { front: true },
    });
    const known = new Set(existing.map((c) => this.normalizeTerm(c.front)));

    const fresh: VocabularyItem[] = [];
    for (const item of items.slice(0, count)) {
      const key = this.normalizeTerm(item.term);
      if (known.has(key)) continue;
      known.add(key); // also dedups within this batch
      fresh.push(item);
    }

    const created = await this.prisma.$transaction(
      fresh.map((item) =>
        this.prisma.card.create({
          data: {
            deckId,
            userId,
            front: item.term.slice(0, MAX_FIELD_CHARS),
            back: this.formatBack(item).slice(0, MAX_FIELD_CHARS),
          },
        }),
      ),
    );

    return {
      deckId,
      cards: created.map(toCardView),
      created: created.length,
      skipped: items.slice(0, count).length - created.length,
    };
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async resolveSource(
    userId: string,
    dto: ExtractVocabularyDto,
  ): Promise<string> {
    if (dto.text?.trim()) {
      return dto.text.trim().slice(0, MAX_SOURCE_CHARS);
    }
    if (dto.documentId) {
      const doc = await this.prisma.document.findUnique({
        where: { id: dto.documentId },
      });
      if (!doc || doc.userId !== userId) {
        throw new NotFoundException('Document not found.');
      }
      if (!doc.content.trim()) {
        throw new UnprocessableEntityException(
          'That document has no text to mine.',
        );
      }
      return doc.content.slice(0, MAX_SOURCE_CHARS);
    }
    throw new BadRequestException('Provide `text` or a `documentId` to mine.');
  }

  private clampCount(count?: number): number {
    if (count === undefined) return DEFAULT_COUNT;
    return Math.min(Math.max(Math.trunc(count), 1), MAX_COUNT);
  }

  private async mine(
    profile: LanguageProfile,
    source: string,
    count: number,
  ): Promise<VocabularyItem[]> {
    const native = profile.nativeLanguage ?? 'English';
    const spec = modeSpec(profile.mode);
    const system = [
      `You are a professional ${profile.language} teacher building vocabulary`,
      `cards for a learner at "${profile.mode}" level. ${spec.directive}`,
      `Pick the ${count} most useful items for THIS learner from the material —`,
      'high-frequency and level-appropriate, not obscure trivia.',
      'Respond with ONLY a JSON array of objects with string fields:',
      `"term" (the ${profile.language} word/phrase, in ${profile.language}),`,
      `"translation" (its meaning in ${native}),`,
      `"example" (one natural ${profile.language} sentence using it).`,
      'No markdown, no code fences, no commentary.',
    ].join(' ');

    let text: string;
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: system },
          {
            role: 'user',
            content: `Mine vocabulary from this material:\n\n${source}`,
          },
        ],
        { temperature: 0.3 },
      );
      text = result.text;
    } catch (error) {
      this.logger.error(`Vocabulary LLM call failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The teacher is temporarily unavailable. Please try again shortly.',
      );
    }
    return this.parse(text);
  }

  /** Parse the model output, tolerating fences / stray prose. */
  private parse(raw: string): VocabularyItem[] {
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
        (i): i is VocabularyItem =>
          !!i &&
          typeof (i as VocabularyItem).term === 'string' &&
          typeof (i as VocabularyItem).translation === 'string' &&
          (i as VocabularyItem).term.trim().length > 0 &&
          (i as VocabularyItem).translation.trim().length > 0,
      )
      .map((i) => ({
        term: i.term.trim(),
        translation: i.translation.trim(),
        example: typeof i.example === 'string' ? i.example.trim() : '',
      }));
  }

  private formatBack(item: VocabularyItem): string {
    return item.example
      ? `${item.translation}\n\n${item.example}`
      : item.translation;
  }

  private normalizeTerm(term: string): string {
    return term.trim().toLowerCase().replace(/\s+/g, ' ');
  }
}
