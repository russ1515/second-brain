import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { resolveLocale } from '../common/learning-locale';
import { translateStaticCopy } from './static-copy.catalog';

/**
 * Localization for deterministic/generated analysis copy.
 *
 * The deterministic engines (Coach, Mentor, Insights, Prediction, …) build their
 * prose in canonical English. Static product copy must never consume an AI
 * request, so reviewed translations live in a versioned catalogue. A missing
 * entry safely falls back to canonical copy and is visible to tests/review.
 */
@Injectable()
export class LocalizationService {
  constructor(private readonly prisma: PrismaService) {}

  /** Resolve the user's locale, then translate the strings into it. */
  async localizeForUser(userId: string, texts: string[]): Promise<string[]> {
    const locale = await resolveLocale(this.prisma, userId);
    return this.translate(texts, locale);
  }

  /** Translate static strings from the checked-in catalogue (no network/LLM). */
  async translate(texts: string[], locale: string): Promise<string[]> {
    return texts.map((text) => translateStaticCopy(text, locale));
  }
}
