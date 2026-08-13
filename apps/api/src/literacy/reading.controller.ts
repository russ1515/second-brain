import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  ReadingExerciseSummary,
  ReadingExerciseView,
  ReadingLevelView,
  ReadingResultView,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ReadingService } from './reading.service';
import { GenerateReadingDto, SubmitReadingDto } from './dto/reading.dto';

/** Reading coach (Sprint 7.7): generate level-adapted passages with
 *  comprehension questions, evaluate answers, and auto-adapt the level. */
@UseGuards(JwtAccessGuard)
@Controller('reading')
export class ReadingController {
  constructor(private readonly reading: ReadingService) {}

  @Get('level')
  async level(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReadingLevelView> {
    return { level: await this.reading.currentLevel(user.userId) };
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('generate')
  @HttpCode(HttpStatus.CREATED)
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: GenerateReadingDto,
  ): Promise<ReadingExerciseView> {
    return this.reading.generate(user.userId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ReadingExerciseSummary[]> {
    return this.reading.list(user.userId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ReadingExerciseView> {
    return this.reading.get(user.userId, id);
  }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitReadingDto,
  ): Promise<ReadingResultView> {
    return this.reading.submit(user.userId, id, dto.answers);
  }
}
