import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { LanguageProfile } from '@prisma/client';
import type { LanguageMode, TutorSessionDetail } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { LlmService } from '../llm/llm.service';
import { TutorService } from '../tutor/tutor.service';
import { LanguageService } from './language.service';
import { immersionRatio, languageSystemPrompt, modeSpec } from './language-modes';

/**
 * Immersive conversation practice.
 *
 * Only the OPENING lives here: the session is an ordinary TutorSession tagged
 * with `languageProfileId`, so every following turn goes through the existing
 * POST /tutor/sessions/:id/messages (and the voice endpoint) and picks up the
 * Language Professor role automatically.
 */
@Injectable()
export class ConversationService {
  private readonly logger = new Logger(ConversationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly llm: LlmService,
    private readonly tutor: TutorService,
    private readonly languages: LanguageService,
  ) {}

  async start(
    userId: string,
    profileId: string,
    scenario?: string,
  ): Promise<TutorSessionDetail> {
    const profile = await this.languages.requireOwned(userId, profileId);

    const session = await this.prisma.tutorSession.create({
      data: {
        userId,
        languageProfileId: profile.id,
        title: scenario?.trim()
          ? `${profile.language} — ${scenario.trim()}`.slice(0, 200)
          : `${profile.language} conversation`,
      },
    });

    const opening = await this.openingLine(profile, scenario);
    await this.prisma.tutorMessage.create({
      data: { sessionId: session.id, role: 'assistant', content: opening },
    });

    return this.tutor.getSession(userId, session.id);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async openingLine(
    profile: LanguageProfile,
    scenario?: string,
  ): Promise<string> {
    const mode = profile.mode as LanguageMode;
    const spec = modeSpec(mode);
    const system = languageSystemPrompt({
      language: profile.language,
      nativeLanguage: profile.nativeLanguage,
      mode,
      goal: profile.goal,
      cefrLevel: profile.cefrLevel,
    });

    // Immersion (7.8) uses a CEFR-adaptive target ratio; other modes use the
    // static mode ratio.
    const effectiveRatio =
      mode === 'immersion'
        ? immersionRatio(profile.cefrLevel)
        : spec.targetLanguageRatio;
    const setting = scenario?.trim()
      ? `The scenario is: "${scenario.trim()}". Set the scene in one line, then stay in it.`
      : 'Pick a simple everyday situation suited to their level and open it.';
    const ratio =
      effectiveRatio >= 1
        ? `Write ENTIRELY in ${profile.language}. Do not translate anything.`
        : `Write roughly ${Math.round(effectiveRatio * 100)}% in ` +
          `${profile.language}, glossing the rest as your mode requires.`;

    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              `Open a conversation practice session. ${setting} ${ratio} ` +
              `Greet me briefly and ask me ONE opening question so I have to ` +
              `reply. Keep it to 2-3 sentences.`,
          },
        ],
        { temperature: 0.6 },
      );
      return result.text.trim();
    } catch (error) {
      this.logger.error(
        `Conversation opening failed: ${(error as Error).message}`,
      );
      throw new ServiceUnavailableException(
        'The teacher is temporarily unavailable. Please try again shortly.',
      );
    }
  }
}
