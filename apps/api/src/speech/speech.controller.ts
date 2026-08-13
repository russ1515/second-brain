import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Logger,
  NotImplementedException,
  Post,
  ServiceUnavailableException,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { SynthesisResult } from '@second-brain/shared';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
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
      this.logger.error(`TTS failed: ${(error as Error).message}`);
      throw new ServiceUnavailableException(
        'Your teacher’s voice is temporarily unavailable. Please try again shortly.',
      );
    }
  }
}
