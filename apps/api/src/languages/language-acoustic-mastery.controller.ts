import {
  BadRequestException,
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { UploadedFileLike } from '../documents/extraction/text-extraction.service';
import { AssessRlleAcousticMasteryDto } from './dto/assess-rlle-acoustic-mastery.dto';
import {
  LanguageAcousticMasteryService,
  type AcousticMasteryResponse,
} from './language-acoustic-mastery.service';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024;

@UseGuards(JwtAccessGuard)
@Controller('languages')
export class LanguageAcousticMasteryController {
  constructor(private readonly acousticMastery: LanguageAcousticMasteryService) {}

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post(':id/course/mastery/acoustic')
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileFieldsInterceptor([
    { name: 'scriptedAudio', maxCount: 1 },
    { name: 'spontaneousAudio', maxCount: 1 },
  ], { limits: { fileSize: MAX_AUDIO_BYTES, files: 2 } }))
  assess(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') profileId: string,
    @UploadedFiles() files: {
      scriptedAudio?: UploadedFileLike[];
      spontaneousAudio?: UploadedFileLike[];
    } | undefined,
    @Body() dto: AssessRlleAcousticMasteryDto,
  ): Promise<AcousticMasteryResponse> {
    const scripted = files?.scriptedAudio?.[0];
    const spontaneous = files?.spontaneousAudio?.[0];
    if (!scripted || !spontaneous) {
      throw new BadRequestException(
        'Both scriptedAudio and spontaneousAudio recordings are required.',
      );
    }
    const exerciseIndex = Number(dto.exerciseIndex);
    if (!Number.isInteger(exerciseIndex) || exerciseIndex < 0) {
      throw new BadRequestException('A valid pronunciation exercise index is required.');
    }
    return this.acousticMastery.assess(
      user.userId,
      profileId,
      {
        experienceSessionId: dto.experienceSessionId,
        lessonId: dto.lessonId,
        targetId: dto.targetId,
        idempotencyKey: dto.idempotencyKey,
        exerciseIndex,
        ...(dto.remediationPlanId ? { remediationPlanId: dto.remediationPlanId } : {}),
      },
      scripted,
      spontaneous,
    );
  }
}
