import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  NotImplementedException,
  Optional,
  Post,
  ServiceUnavailableException,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type {
  SpeechCapabilities,
  SynthesisResult,
  TranscriptionResult,
} from '@second-brain/shared';
import {
  LANGUAGE_MASTERY_POLICY_VERSION,
  RLLE_LANGUAGE_MASTERY_MAPPING_AUDIT,
  type LanguageMasterySpeechCoverage,
  type UXFeatureFlags,
} from '@second-brain/shared';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { UploadedFileLike } from '../documents/extraction/text-extraction.service';
import { SpeechService } from './speech.service';
import { SynthesizeDto } from './dto/synthesize.dto';
import { LANGUAGE_MASTERY_STRICT_RUNTIME_READY } from '../languages/language-mastery-readiness';

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

  constructor(
    private readonly speech: SpeechService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  @Get('capabilities')
  capabilities(): SpeechCapabilities {
    const configured = this.config?.get<Omit<LanguageMasterySpeechCoverage, 'enabled' | 'policyVersion'>>(
      'speech.languageMasteryV1',
    );
    const features = this.config?.get<UXFeatureFlags>('features');
    const transcriptionLanguageCodes = configured?.transcriptionLanguageCodes ?? [];
    const synthesisLanguageCodes = configured?.synthesisLanguageCodes ?? [];
    const pronunciationAssessmentLanguageCodes =
      configured?.pronunciationAssessmentLanguageCodes ?? [];
    const fullyCoveredLanguage = transcriptionLanguageCodes.some((languageCode) =>
      synthesisLanguageCodes.includes(languageCode)
      && pronunciationAssessmentLanguageCodes.includes(languageCode));
    const strictPathEnabled = LANGUAGE_MASTERY_STRICT_RUNTIME_READY
      && features?.languageMasteryV1 === true
      && RLLE_LANGUAGE_MASTERY_MAPPING_AUDIT.activationReady
      && this.speech.supportsSynthesis
      && this.speech.supportsAnalysis
      && fullyCoveredLanguage;
    return {
      provider: this.speech.activeProvider,
      transcription: true,
      synthesis: this.speech.supportsSynthesis,
      audioAnalysis: this.speech.supportsAnalysis,
      languageMasteryV1: {
        // This is an activation claim, not merely a configured feature flag.
        // The client still applies the returned per-language allowlists before
        // presenting a language as completable.
        enabled: strictPathEnabled,
        policyVersion: LANGUAGE_MASTERY_POLICY_VERSION,
        transcriptionLanguageCodes,
        synthesisLanguageCodes,
        pronunciationAssessmentLanguageCodes,
      },
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
    @Body('durationMs') durationMs?: string,
  ): Promise<TranscriptionResult> {
    if (!audio) {
      throw new BadRequestException('No audio was uploaded (field "audio").');
    }
    try {
      return await this.speech.transcribe(audio.buffer, {
        mimeType: audio.mimetype || 'application/octet-stream',
        ...(language?.trim() ? { language: language.trim() } : {}),
        ...(this.durationSeconds(durationMs) ? { durationSeconds: this.durationSeconds(durationMs)! } : {}),
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
          `synthesize speech. Configure a real speech provider to hear your teacher.`,
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

  private durationSeconds(value?: string): number | undefined {
    const milliseconds = Number(value);
    if (!Number.isFinite(milliseconds) || milliseconds <= 0 || milliseconds > 600_000) return undefined;
    return Math.ceil(milliseconds / 1_000);
  }
}
