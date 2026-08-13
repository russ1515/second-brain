import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { LanguageProfile } from '@prisma/client';
import type {
  LanguageMode,
  LanguageSkillResponse,
} from '@second-brain/shared';
import { LlmService } from '../llm/llm.service';
import { languageSystemPrompt } from './language-modes';

/**
 * Language skills (Sprint 7.3) — the structured domain around a language beyond
 * vocabulary/conversation: grammar, conjugation, and reading/listening
 * comprehension. Each reuses the one Language Professor persona, pitched to the
 * profile's mode AND its CEFR level, and returns markdown. Ephemeral (generated
 * and returned, never persisted — like dialogues and essay corrections).
 */
@Injectable()
export class LanguageSkillsService {
  private readonly logger = new Logger(LanguageSkillsService.name);

  constructor(private readonly llm: LlmService) {}

  grammar(profile: LanguageProfile, topic?: string): Promise<LanguageSkillResponse> {
    const focus = topic?.trim()
      ? `the grammar point: "${topic.trim()}"`
      : `one grammar point that matters most at CEFR level ${profile.cefrLevel} (state which)`;
    const user = [
      `Teach ${focus} in ${profile.language}.`,
      'Structure it as markdown: a clear explanation of the rule, 3-4 example',
      'sentences (each glossed in the native language unless in immersion mode),',
      'the most common mistakes learners make, and 3 short practice exercises',
      'followed by an answer key.',
    ].join(' ');
    return this.generate(profile, `Grammar — ${topic?.trim() || profile.language}`, user);
  }

  conjugation(profile: LanguageProfile, verb?: string): Promise<LanguageSkillResponse> {
    const target = verb?.trim()
      ? `the verb "${verb.trim()}"`
      : `one common, useful verb for CEFR level ${profile.cefrLevel} (state which verb you chose)`;
    const user = [
      `Conjugate ${target} in ${profile.language}.`,
      'Give markdown tables for the tenses that matter at this CEFR level',
      '(at least the present; add past/future/others as the level warrants),',
      'then 3 example sentences using different persons/tenses, and a short',
      'fill-in-the-blank drill with an answer key.',
    ].join(' ');
    return this.generate(profile, `Conjugation — ${verb?.trim() || profile.language}`, user);
  }

  reading(profile: LanguageProfile, topic?: string): Promise<LanguageSkillResponse> {
    const about = topic?.trim() ? ` about "${topic.trim()}"` : '';
    const user = [
      `Write a short reading passage in ${profile.language}${about}, pitched at`,
      `CEFR level ${profile.cefrLevel} (a few short paragraphs).`,
      'Then give 4 comprehension questions in the target language and an answer',
      'key. This passage doubles as listening practice (it can be read aloud), so',
      'keep sentences natural to hear. Markdown.',
    ].join(' ');
    return this.generate(profile, `Comprehension — ${topic?.trim() || profile.language}`, user);
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async generate(
    profile: LanguageProfile,
    title: string,
    user: string,
  ): Promise<LanguageSkillResponse> {
    const system = languageSystemPrompt({
      language: profile.language,
      nativeLanguage: profile.nativeLanguage,
      mode: profile.mode as LanguageMode,
      goal: profile.goal,
      cefrLevel: profile.cefrLevel,
    });
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: system },
          { role: 'user', content: `${user} Output only the markdown.` },
        ],
        { temperature: 0.4 },
      );
      return { title, content: result.text.trim() };
    } catch (error) {
      this.logger.error(`Language skill generation failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The language teacher is temporarily unavailable. Please try again shortly.',
      );
    }
  }
}
