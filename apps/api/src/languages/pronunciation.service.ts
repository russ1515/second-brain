import {
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { LanguageProfile } from '@prisma/client';
import type {
  PronunciationAssessment,
  PronunciationCoaching,
  PronunciationDimension,
  PronunciationDimensionKind,
  PronunciationExercise,
  PronunciationRating,
} from '@second-brain/shared';
import { PRONUNCIATION_DIMENSIONS } from '@second-brain/shared';
import { LlmService } from '../llm/llm.service';
import { SpeechService } from '../speech/speech.service';
import { LanguageService } from './language.service';
import { languageSystemPrompt } from './language-modes';
import { alignWords } from './word-alignment';
import type { UploadedFileLike } from '../documents/extraction/text-extraction.service';

/** Scores a spoken attempt against a target phrase.
 *
 *  The score comes from a deterministic word alignment, NOT from the LLM — the
 *  model only writes the coaching note, and it is handed the diff so its advice
 *  is grounded in what actually happened rather than invented. */
@Injectable()
export class PronunciationService {
  private readonly logger = new Logger(PronunciationService.name);

  constructor(
    private readonly speech: SpeechService,
    private readonly llm: LlmService,
    private readonly languages: LanguageService,
  ) {}

  async assess(
    userId: string,
    profileId: string,
    targetPhrase: string,
    audio: UploadedFileLike,
  ): Promise<PronunciationAssessment> {
    const profile = await this.languages.requireOwned(userId, profileId);
    const heard = await this.transcribe(audio, profile);
    const { words, accuracy } = alignWords(targetPhrase, heard);
    const feedback = await this.coach(profile, targetPhrase, heard, accuracy);

    return { targetPhrase, heard, accuracy, words, feedback };
  }

  /** Pronunciation coach (Sprint 7.5): the teacher LISTENS to a free spoken
   *  sample and reports across five dimensions — pronunciation, accent, rhythm,
   *  fluency, intonation — then explains why it matters, how to improve, and
   *  gives tailored exercises. Audio-native: the model hears the clip, so unlike
   *  `assess` above it can honestly speak to prosody. Communication over
   *  correction. */
  async coachSpeaking(
    userId: string,
    profileId: string,
    audio: UploadedFileLike,
    context?: string,
  ): Promise<PronunciationCoaching> {
    const profile = await this.languages.requireOwned(userId, profileId);
    if (!this.speech.supportsAnalysis) {
      throw new ServiceUnavailableException(
        'Spoken coaching needs an audio-native speech provider; it is not enabled here.',
      );
    }

    const instruction = this.coachInstruction(profile, context);
    let raw: string;
    try {
      const result = await this.speech.analyze(audio.buffer, {
        mimeType: audio.mimetype || 'application/octet-stream',
        language: profile.language,
        instruction,
      });
      raw = result.text;
    } catch (error) {
      this.logger.error(`Pronunciation coaching failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'Could not analyse that audio. Please try again shortly.',
      );
    }

    const parsed = this.parseCoaching(raw);
    if (!parsed) {
      throw new UnprocessableEntityException(
        'No speech could be coached from that audio.',
      );
    }
    return parsed;
  }

  // ── internals ────────────────────────────────────────────────────────────

  /** The coach's brief + the exact JSON schema we parse back. */
  private coachInstruction(profile: LanguageProfile, context?: string): string {
    const persona = languageSystemPrompt({
      language: profile.language,
      nativeLanguage: profile.nativeLanguage,
      mode: profile.mode,
      goal: profile.goal,
      cefrLevel: profile.cefrLevel,
    });
    const nativeLang = profile.nativeLanguage || 'English';
    const tried = context?.trim()
      ? `The learner was trying to say/talk about: "${context.trim()}". `
      : '';
    return [
      persona,
      'You are now an expert pronunciation coach. You are given the learner\'s',
      'AUDIO (not a transcript) — LISTEN to it and assess it honestly, basing',
      'every observation on what you actually hear. Assess EXACTLY these five',
      'dimensions: "pronunciation" (individual sounds), "accent" (how the',
      'learner\'s native language colours the speech), "rhythm" (stress and',
      'pacing), "fluency" (flow, hesitations, filler words, false starts) and',
      '"intonation" (pitch/melody, whether questions rise, etc.).',
      tried,
      'Your goal is COMMUNICATION — help the learner be understood, not perfect.',
      `Write "observation", "summary", "why", "howToImprove" and exercises in ${nativeLang};`,
      'put any example words/sounds in the target language.',
      'Return ONLY JSON with this exact shape:',
      '{"transcript": string (verbatim of what you heard),',
      '"summary": string (could a listener understand them? one warm, honest paragraph),',
      '"dimensions": [{"kind": one of "pronunciation"|"accent"|"rhythm"|"fluency"|"intonation",',
      '"rating": one of "good"|"fair"|"needs_work", "observation": string} — one entry per dimension, all five],',
      '"why": string (why the flagged issues matter for being understood),',
      '"howToImprove": string (concrete guidance),',
      '"exercises": [{"title": string, "instructions": string}] (2-3, tailored to what you heard)}.',
    ].join(' ');
  }

  private parseCoaching(raw: string): PronunciationCoaching | null {
    let data: unknown;
    try {
      // Providers may wrap JSON in prose or fences despite instructions.
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start === -1 || end === -1) return null;
      data = JSON.parse(raw.slice(start, end + 1));
    } catch {
      return null;
    }
    if (typeof data !== 'object' || data === null) return null;
    const d = data as Record<string, unknown>;

    const transcript = typeof d.transcript === 'string' ? d.transcript.trim() : '';
    if (!transcript) return null;

    const ratings: PronunciationRating[] = ['good', 'fair', 'needs_work'];
    const rawDims = Array.isArray(d.dimensions) ? d.dimensions : [];
    const byKind = new Map<PronunciationDimensionKind, PronunciationDimension>();
    for (const item of rawDims) {
      if (typeof item !== 'object' || item === null) continue;
      const di = item as Record<string, unknown>;
      const kind = di.kind as PronunciationDimensionKind;
      if (!PRONUNCIATION_DIMENSIONS.includes(kind)) continue;
      const rating = ratings.includes(di.rating as PronunciationRating)
        ? (di.rating as PronunciationRating)
        : 'fair';
      byKind.set(kind, {
        kind,
        rating,
        observation:
          typeof di.observation === 'string' ? di.observation.trim() : '',
      });
    }
    // Guarantee all five dimensions are present and in spec order.
    const dimensions: PronunciationDimension[] = PRONUNCIATION_DIMENSIONS.map(
      (kind) =>
        byKind.get(kind) ?? { kind, rating: 'fair', observation: '' },
    );

    const exercises: PronunciationExercise[] = (
      Array.isArray(d.exercises) ? d.exercises : []
    )
      .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
      .map((e) => ({
        title: typeof e.title === 'string' ? e.title.trim() : '',
        instructions:
          typeof e.instructions === 'string' ? e.instructions.trim() : '',
      }))
      .filter((e) => e.title || e.instructions);

    return {
      transcript,
      summary: typeof d.summary === 'string' ? d.summary.trim() : '',
      dimensions,
      why: typeof d.why === 'string' ? d.why.trim() : '',
      howToImprove:
        typeof d.howToImprove === 'string' ? d.howToImprove.trim() : '',
      exercises,
    };
  }

  private async transcribe(
    audio: UploadedFileLike,
    profile: LanguageProfile,
  ): Promise<string> {
    let text: string;
    try {
      const result = await this.speech.transcribe(audio.buffer, {
        mimeType: audio.mimetype || 'application/octet-stream',
        // Tell the recogniser what language to expect, or it will happily
        // transcribe learner speech as accented English.
        language: profile.language,
      });
      text = result.text.trim();
    } catch (error) {
      this.logger.error(`Pronunciation STT failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'Could not transcribe that audio. Please try again shortly.',
      );
    }
    if (!text) {
      throw new UnprocessableEntityException(
        'No speech was recognised in that audio.',
      );
    }
    return text;
  }

  /** Coaching note, grounded in the measured diff. Best-effort: the assessment
   *  is already complete and valid without it. */
  private async coach(
    profile: LanguageProfile,
    target: string,
    heard: string,
    accuracy: number,
  ): Promise<string> {
    const system =
      languageSystemPrompt({
        language: profile.language,
        nativeLanguage: profile.nativeLanguage,
        mode: profile.mode,
        goal: profile.goal,
      }) +
      ' The learner just read a phrase aloud. You are given the target and what' +
      ' the speech recogniser actually heard. Note: you are seeing TEXT, not' +
      ' audio — do not claim to hear an accent or comment on intonation you' +
      ' cannot observe. Base your advice only on the difference between the two' +
      ' texts. Reply with 1-3 sentences of concrete, actionable coaching.';

    try {
      const result = await this.llm.generate(
        [
          { role: 'system', content: system },
          {
            role: 'user',
            content:
              `Target phrase: "${target}"\n` +
              `Recognised as: "${heard}"\n` +
              `Word accuracy: ${Math.round(accuracy * 100)}%`,
          },
        ],
        { temperature: 0.3 },
      );
      return result.text.trim();
    } catch (error) {
      this.logger.warn(
        `Pronunciation coaching failed: ${(error as Error).message}`,
      );
      return accuracy === 1
        ? 'Every word was recognised correctly.'
        : 'Some words were not recognised as expected — compare the highlighted words above and try again.';
    }
  }
}
