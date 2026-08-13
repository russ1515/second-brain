import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { LanguageProfile } from '@prisma/client';
import type {
  CefrLevel,
  LanguageMode,
  LanguageProfileDetail,
  LanguageProfileSummary,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import type { CreateLanguageProfileDto } from './dto/create-language-profile.dto';
import type { UpdateLanguageProfileDto } from './dto/update-language-profile.dto';
import { immersionRatio } from './language-modes';

/** Per-language state for the learner. Vocabulary is not a new SRS: each profile
 *  owns an ordinary Deck whose cards ride the existing FSRS engine. */
@Injectable()
export class LanguageService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    userId: string,
    dto: CreateLanguageProfileDto,
  ): Promise<LanguageProfileSummary> {
    const language = dto.language.trim();
    const normalizedLanguage = this.normalize(language);

    const existing = await this.prisma.languageProfile.findUnique({
      where: { userId_normalizedLanguage: { userId, normalizedLanguage } },
    });
    if (existing) {
      throw new ConflictException(`You are already learning ${existing.language}.`);
    }

    // The vocabulary deck is the link between a language and FSRS.
    const deck = await this.prisma.deck.create({
      data: {
        userId,
        name: `Vocabulary — ${language}`.slice(0, 200),
        description: `Vocabulary for ${language}, reviewed with FSRS.`,
      },
    });

    const profile = await this.prisma.languageProfile.create({
      data: {
        userId,
        language,
        normalizedLanguage,
        nativeLanguage: dto.nativeLanguage?.trim() || null,
        mode: dto.mode ?? 'beginner',
        cefrLevel: dto.cefrLevel ?? 'A1',
        goal: dto.goal?.trim() || null,
        vocabDeckId: deck.id,
      },
    });
    return this.toSummary(profile, 0);
  }

  async list(userId: string): Promise<LanguageProfileSummary[]> {
    const profiles = await this.prisma.languageProfile.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
    return Promise.all(
      profiles.map(async (p) =>
        this.toSummary(p, await this.countVocab(userId, p.vocabDeckId)),
      ),
    );
  }

  async get(userId: string, id: string): Promise<LanguageProfileDetail> {
    const profile = await this.requireOwned(userId, id);
    const [vocabCount, vocabDue, lessonCount] = await Promise.all([
      this.countVocab(userId, profile.vocabDeckId),
      this.countVocabDue(userId, profile.vocabDeckId),
      this.prisma.lesson.count({ where: { userId, languageProfileId: id } }),
    ]);
    return {
      ...this.toSummary(profile, vocabCount),
      vocabDue,
      lessonCount,
      immersionRatio:
        profile.mode === 'immersion' ? immersionRatio(profile.cefrLevel) : null,
    };
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateLanguageProfileDto,
  ): Promise<LanguageProfileSummary> {
    await this.requireOwned(userId, id);
    const profile = await this.prisma.languageProfile.update({
      where: { id },
      data: {
        ...(dto.mode !== undefined ? { mode: dto.mode } : {}),
        ...(dto.cefrLevel !== undefined ? { cefrLevel: dto.cefrLevel } : {}),
        ...(dto.nativeLanguage !== undefined
          ? { nativeLanguage: dto.nativeLanguage.trim() || null }
          : {}),
        ...(dto.goal !== undefined ? { goal: dto.goal.trim() || null } : {}),
      },
    });
    return this.toSummary(
      profile,
      await this.countVocab(userId, profile.vocabDeckId),
    );
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireOwned(userId, id);
    // The vocabulary deck is deliberately left behind: those are real FSRS cards
    // with real review history, and dropping a language should not silently
    // destroy the learner's memory of it.
    await this.prisma.languageProfile.delete({ where: { id } });
  }

  /** Load an owned profile, or 404. Shared with the other language services. */
  async requireOwned(userId: string, id: string): Promise<LanguageProfile> {
    const profile = await this.prisma.languageProfile.findUnique({
      where: { id },
    });
    if (!profile || profile.userId !== userId) {
      throw new NotFoundException('Language profile not found.');
    }
    return profile;
  }

  /** Every profile gets a vocabulary deck at creation, but the FK is SetNull —
   *  re-create it if the deck was deleted out from under us. */
  async ensureVocabDeck(profile: LanguageProfile): Promise<string> {
    if (profile.vocabDeckId) {
      const deck = await this.prisma.deck.findUnique({
        where: { id: profile.vocabDeckId },
      });
      if (deck) return deck.id;
    }
    const deck = await this.prisma.deck.create({
      data: {
        userId: profile.userId,
        name: `Vocabulary — ${profile.language}`.slice(0, 200),
        description: `Vocabulary for ${profile.language}, reviewed with FSRS.`,
      },
    });
    await this.prisma.languageProfile.update({
      where: { id: profile.id },
      data: { vocabDeckId: deck.id },
    });
    return deck.id;
  }

  // ── internals ────────────────────────────────────────────────────────────

  private normalize(language: string): string {
    return language.trim().toLowerCase().replace(/\s+/g, ' ');
  }

  private countVocab(userId: string, deckId: string | null): Promise<number> {
    if (!deckId) return Promise.resolve(0);
    return this.prisma.card.count({ where: { userId, deckId } });
  }

  private countVocabDue(userId: string, deckId: string | null): Promise<number> {
    if (!deckId) return Promise.resolve(0);
    return this.prisma.card.count({
      where: { userId, deckId, due: { lte: new Date() } },
    });
  }

  private toSummary(
    profile: LanguageProfile,
    vocabCount: number,
  ): LanguageProfileSummary {
    return {
      id: profile.id,
      language: profile.language,
      nativeLanguage: profile.nativeLanguage,
      mode: profile.mode as LanguageMode,
      cefrLevel: profile.cefrLevel as CefrLevel,
      goal: profile.goal,
      vocabDeckId: profile.vocabDeckId,
      vocabCount,
      createdAt: profile.createdAt.toISOString(),
      updatedAt: profile.updatedAt.toISOString(),
    };
  }
}
