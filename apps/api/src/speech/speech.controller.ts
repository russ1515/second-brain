import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotImplementedException,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type {
  SpeechCapabilities,
  SynthesisResult,
  TranscriptionResult,
} from '@second-brain/shared';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { UploadedFileLike } from '../documents/extraction/text-extraction.service';
import { SpeechService } from './speech.service';
import { SynthesizeDto } from './dto/synthesize.dto';

/**
 * Letting the teacher SPEAK.
 *
 * The voice endpoint could already synthesize, but only as the tail of a spoken
 * turn — there was no way to say "read this aloud". That left the teacher mute
 * for a learner who types, which is exactly backwards for language work, where
 * hearing the target language is the point.
 */
@UseGuards(JwtAccessGuard)
@Controller('speech')
export class SpeechController {
  private readonly logger = new Logger(SpeechController.name);

  constructor(private readonly speech: SpeechService) {}

  @Get('capabilities')
  capabilities(): SpeechCapabilities {
    return {
      provider: this.speech.activeProvider,
      transcription: true,
      synthesis: this.speech.supportsSynthesis,
      audioAnalysis: this.speech.supportsAnalysis,
    };
  }

  /** Transcribe first so the learner can inspect and edit the text before it is
   * sent to the Professor. The transcript is not persisted by this endpoint. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('stt')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: 10 * 1024 * 1024 } }),
  )
  async transcribe(
    @UploadedFile() audio: UploadedFileLike | undefined,
    @Body('language') language?: string,
  ): Promise<TranscriptionResult> {
    if (!audio) {
      throw new BadRequestException('No audio was uploaded (field "audio").');
    }
    try {
      return await this.speech.transcribe(audio.buffer, {
        mimeType: audio.mimetype || 'application/octet-stream',
        ...(language?.trim() ? { language: language.trim() } : {}),
      });
    } catch (error) {
      this.logger.error('Learning operation failed.');
      throw new ServiceUnavailableException({
        code: 'SPEECH_TRANSCRIPTION_UNAVAILABLE',
        message: 'Transcription is temporarily unavailable. Your recording was not sent.',
        retryable: true,
      });
    }
  }

  /** Voice arbitrary text. Nothing is taught, marked or remembered here. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('tts')
  @HttpCode(HttpStatus.OK)
  async synthesize(@Body() dto: SynthesizeDto): Promise<SynthesisResult> {
    if (!this.speech.supportsSynthesis) {
      throw new NotImplementedException(
        `The active speech provider ("${this.speech.activeProvider}") cannot ` +
          `synthesize speech. Set SPEECH_PROVIDER=gemini to hear your teacher.`,
      );
    }
    try {
      return await this.speech.synthesize(dto.text, { language: dto.language });
    } catch (error) {
      this.logger.error('Learning operation failed.');
      throw new ServiceUnavailableException(
        'Your teacher’s voice is temporarily unavailable. Please try again shortly.',
      );
    }
  }
}
