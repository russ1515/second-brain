import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { LanguageProfile } from '@prisma/client';
import type {
  DialogueLine,
  EssayCorrection,
  EssayCorrectionItem,
  LanguageDialogue,
  LanguageMode,
} from '@second-brain/shared';
import { LlmService } from '../llm/llm.service';
import { LanguageService } from './language.service';
import { languageSystemPrompt, modeSpec } from './language-modes';

const MAX_ESSAY_CHARS = 6000;

/**
 * The written half of the language teacher (sprint 2, task 7): it CREATES
 * DIALOGUES to study and CORRECTS ESSAYS (rédactions). Both are ephemeral study
 * material — generated, returned, not persisted — mirroring pronunciation. The
 * teacher's persona and the mode's target-language ratio come from the shared
 * `languageSystemPrompt`, so the learner meets one consistent teacher.
 */
@Injectable()
export class LanguageWritingService {
  private readonly logger = new Logger(LanguageWritingService.name);

  constructor(
    private readonly llm: LlmService,
    private readonly languages: LanguageService,
  ) {}

  /** A short scripted dialogue in the target language, glossed per the mode. */
  async dialogue(
    userId: string,
    profileId: string,
    scenario?: string,
  ): Promise<LanguageDialogue> {
    const profile = await this.languages.requireOwned(userId, profileId);
    const mode = profile.mode as LanguageMode;
    const spec = modeSpec(mode);
    const native = profile.nativeLanguage ?? 'English';
    const withGloss = spec.targetLanguageRatio < 1;

    const system =
      languageSystemPrompt({
        language: profile.language,
        nativeLanguage: profile.nativeLanguage,
        mode,
        goal: profile.goal,
      }) +
      ` Write a short, natural ${profile.language} dialogue (6-10 turns) the` +
      ` learner can study. Respond with ONLY a JSON object (no markdown):` +
      ` {"title","lines":[{"speaker","text"${withGloss ? `,"translation"` : ''}}]}` +
      ` where "text" is in ${profile.language}` +
      (withGloss
        ? ` and "translation" is the ${native} gloss of that line.`
        : ` and you give NO translation (immersion).`);

    const setting = scenario?.trim()
      ? `Scenario: "${scenario.trim()}".`
      : 'Pick a simple everyday situation suited to the learner’s level.';

    const raw = await this.call(system, `Create the dialogue. ${setting}`);
    return this.parseDialogue(raw, scenario?.trim() || null, withGloss);
  }

  /** Correct a learner's written text with per-fragment explanations. */
  async correctEssay(
    userId: string,
    profileId: string,
    text: string,
  ): Promise<EssayCorrection> {
    const profile = await this.languages.requireOwned(userId, profileId);
    const native = profile.nativeLanguage ?? 'English';
    const essay = text.trim().slice(0, MAX_ESSAY_CHARS);

    const system =
      languageSystemPrompt({
        language: profile.language,
        nativeLanguage: profile.nativeLanguage,
        mode: profile.mode as LanguageMode,
        goal: profile.goal,
      }) +
      ` The learner has written a text in ${profile.language}. Correct it like a` +
      ` teacher marking a rédaction: never just rewrite it silently. Respond with` +
      ` ONLY a JSON object (no markdown): {"assessment","corrections":` +
      ` [{"original","correction","explanation"}],"correctedText","feedback"}.` +
      ` "assessment" and each "explanation" and "feedback" are in ${native};` +
      ` "correction" and "correctedText" are in ${profile.language}. List the` +
      ` real mistakes (grammar, agreement, word choice, spelling); if the text is` +
      ` already correct, return an empty "corrections" array and say so.`;

    const raw = await this.call(system, `My text:\n\n${essay}`);
    return this.parseEssay(raw, essay);
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async call(system: string, user: string): Promise<string> {
    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: system },
          { role: 'user', content: user },
        ],
        { temperature: 0.4 },
      );
      return result.text;
    } catch (error) {
      this.logger.error(`Language writing LLM failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'The teacher is temporarily unavailable. Please try again shortly.',
      );
    }
  }

  private parseObject(raw: string): Record<string, unknown> {
    const start = raw.indexOf('{');
    const end = raw.lastIndexOf('}');
    if (start === -1 || end <= start) return {};
    try {
      return JSON.parse(raw.slice(start, end + 1));
    } catch {
      return {};
    }
  }

  private parseDialogue(
    raw: string,
    scenario: string | null,
    withGloss: boolean,
  ): LanguageDialogue {
    const parsed = this.parseObject(raw);
    const lines: DialogueLine[] = Array.isArray(parsed.lines)
      ? parsed.lines
          .filter(
            (l): l is DialogueLine =>
              !!l &&
              typeof (l as DialogueLine).speaker === 'string' &&
              typeof (l as DialogueLine).text === 'string' &&
              (l as DialogueLine).text.trim().length > 0,
          )
          .map((l) => ({
            speaker: l.speaker.trim(),
            text: l.text.trim(),
            ...(withGloss && typeof l.translation === 'string' && l.translation.trim()
              ? { translation: l.translation.trim() }
              : {}),
          }))
      : [];

    if (lines.length === 0) {
      throw new UnprocessableEntityException(
        'The teacher did not return a usable dialogue. Try again.',
      );
    }
    return {
      title: typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'Dialogue',
      scenario,
      lines,
    };
  }

  private parseEssay(raw: string, essay: string): EssayCorrection {
    const parsed = this.parseObject(raw);
    const str = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
    const corrections: EssayCorrectionItem[] = Array.isArray(parsed.corrections)
      ? parsed.corrections
          .filter(
            (c): c is EssayCorrectionItem =>
              !!c &&
              typeof (c as EssayCorrectionItem).original === 'string' &&
              typeof (c as EssayCorrectionItem).correction === 'string',
          )
          .map((c) => ({
            original: c.original.trim(),
            correction: c.correction.trim(),
            explanation: str(c.explanation),
          }))
      : [];

    const assessment = str(parsed.assessment);
    // No usable assessment AND no corrected text = the model misbehaved.
    const correctedText = str(parsed.correctedText) || essay;
    if (!assessment && corrections.length === 0) {
      throw new UnprocessableEntityException(
        'The teacher did not return a usable correction. Try again.',
      );
    }
    return {
      assessment,
      corrections,
      correctedText,
      feedback: str(parsed.feedback),
    };
  }
}
