import {
  Injectable,
  Logger,
  NotFoundException,
  NotImplementedException,
  ServiceUnavailableException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type {
  LessonView,
  SynthesisResult,
  VoiceTurnResponse,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { SpeechService } from '../speech/speech.service';
import { LessonService } from '../lessons/lesson.service';
import { TutorService } from './tutor.service';
import type { UploadedFileLike } from '../documents/extraction/text-extraction.service';

export interface VoiceTurnOptions {
  /** Voice the tutor's reply back as audio (requires a TTS-capable provider). */
  speak?: boolean;
  /** BCP-47 hint for the spoken language. */
  language?: string;
  /** Escape hatch for rapid back-and-forth; the written package is the default. */
  lesson?: boolean;
}

/**
 * The voice layer (Phase 5, Educational Engine).
 *
 * Voice reinforces; writing preserves. This service adds NO parallel teaching
 * path: it transcribes, hands the transcript to the same tutor flow a typed
 * message goes through, and then runs the written-first rule — every spoken
 * interaction produces the full written package (lesson, summary, exercises,
 * corrections, flashcards, revision sheet) via LessonService, which also indexes
 * it into long-term memory and wires it to the twin.
 */
@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly speech: SpeechService,
    private readonly tutor: TutorService,
    private readonly lessons: LessonService,
  ) {}

  async handleTurn(
    userId: string,
    sessionId: string,
    audio: UploadedFileLike,
    options: VoiceTurnOptions = {},
  ): Promise<VoiceTurnResponse> {
    await this.requireOwnedSession(userId, sessionId);

    // Fail fast on a TTS request the provider cannot honour, before spending
    // any LLM budget on the turn.
    if (options.speak && !this.speech.supportsSynthesis) {
      throw new NotImplementedException(
        `The active speech provider ("${this.speech.activeProvider}") cannot ` +
          `synthesize speech. Set SPEECH_PROVIDER=gemini to voice replies back.`,
      );
    }

    const transcript = await this.transcribe(audio, options.language);

    // The same grounded, twin-steered flow a typed message takes.
    const { message } = await this.tutor.sendMessage(
      userId,
      sessionId,
      transcript.text,
      { viaVoice: true },
    );

    // Written-first: the spoken turn must leave written material behind.
    const lesson =
      options.lesson === false
        ? null
        : await this.buildWrittenPackage(userId, sessionId);

    const audioReply = options.speak
      ? await this.synthesize(message.content, options.language)
      : undefined;

    return {
      transcript: transcript.text,
      language: transcript.language,
      message,
      lesson,
      ...(audioReply ? { audio: audioReply } : {}),
    };
  }

  // ── internals ────────────────────────────────────────────────────────────

  private async transcribe(
    audio: UploadedFileLike,
    language?: string,
  ): Promise<{ text: string; language: string | null }> {
    let result;
    try {
      result = await this.speech.transcribe(audio.buffer, {
        mimeType: audio.mimetype || 'application/octet-stream',
        language,
      });
    } catch (error) {
      this.logger.error(`Transcription failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'Could not transcribe that audio. Please try again shortly.',
      );
    }
    if (!result.text.trim()) {
      throw new UnprocessableEntityException(
        'No speech was recognised in that audio.',
      );
    }
    return { text: result.text.trim(), language: result.language };
  }

  /** Generate the full written package for the session. Best-effort by design:
   *  the learner's turn already happened and is persisted — a lesson failure
   *  must never erase it. */
  private async buildWrittenPackage(
    userId: string,
    sessionId: string,
  ): Promise<LessonView | null> {
    try {
      return await this.lessons.generate(userId, { tutorSessionId: sessionId });
    } catch (error) {
      this.logger.warn(
        `Written package for voice turn failed: ${(error as Error).message}`,
      );
      return null;
    }
  }

  private async synthesize(
    text: string,
    language?: string,
  ): Promise<SynthesisResult | undefined> {
    try {
      return await this.speech.synthesize(text, { language });
    } catch (error) {
      // The written turn stands on its own; audio is an enhancement.
      this.logger.warn(`Speech synthesis failed: ${(error as Error).message}`);
      return undefined;
    }
  }

  private async requireOwnedSession(
    userId: string,
    sessionId: string,
  ): Promise<void> {
    const session = await this.prisma.tutorSession.findUnique({
      where: { id: sessionId },
      select: { userId: true },
    });
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Tutor session not found.');
    }
  }
}
