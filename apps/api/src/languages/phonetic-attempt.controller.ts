import {
  BadRequestException, Body, Controller, Get, HttpCode, HttpStatus, Param,
  Post, Query, UploadedFile, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { UploadedFileLike } from '../documents/extraction/text-extraction.service';
import { CreatePhoneticAttemptDto } from './dto/create-phonetic-attempt.dto';
import { PhoneticAttemptService } from './phonetic-attempt.service';

/** An evidence/practice endpoint, deliberately separate from acoustic mastery. */
@UseGuards(JwtAccessGuard)
@Controller('languages/:id/phonetic-attempts')
export class PhoneticAttemptController {
  constructor(private readonly attempts: PhoneticAttemptService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser, @Param('id') profileId: string) {
    return this.attempts.list(user.userId, profileId);
  }

  @Get('capability')
  capability(
    @CurrentUser() user: AuthenticatedUser, @Param('id') profileId: string,
    @Query('lessonId') lessonId: string,
  ) {
    return this.attempts.capability(user.userId, profileId, lessonId);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post(':attemptId/recover')
  @HttpCode(HttpStatus.OK)
  recover(
    @CurrentUser() user: AuthenticatedUser, @Param('id') profileId: string,
    @Param('attemptId') attemptId: string,
  ) {
    return this.attempts.recoverInterrupted(user.userId, profileId, attemptId);
  }

  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(FileInterceptor('audio', { limits: { fileSize: 4 * 1024 * 1024, files: 1, fields: 6 } }))
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') profileId: string,
    @Body() dto: CreatePhoneticAttemptDto,
    @UploadedFile() audio: UploadedFileLike | undefined,
  ) {
    if (!audio) throw new BadRequestException({ code: 'EMPTY_RECORDING', message: 'A pronunciation recording is required.' });
    return this.attempts.assess(user.userId, profileId, {
      lessonId: dto.lessonId, idempotencyKey: dto.idempotencyKey,
      exerciseIndex: Number(dto.exerciseIndex), locale: dto.locale,
      parentAttemptId: dto.parentAttemptId,
      ...(dto.targetWordIndex !== undefined ? { targetWordIndex: Number(dto.targetWordIndex) } : {}),
    }, audio);
  }
}
