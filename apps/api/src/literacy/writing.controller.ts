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
  WritingSubmissionSummary,
  WritingSubmissionView,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { WritingService } from './writing.service';
import { ReviewWritingDto } from './dto/review-writing.dto';

/** Writing coach (Sprint 7.7): review a written production across seven
 *  dimensions and explain precisely how to improve it. */
@UseGuards(JwtAccessGuard)
@Controller('writing')
export class WritingController {
  constructor(private readonly writing: WritingService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  review(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: ReviewWritingDto,
  ): Promise<WritingSubmissionView> {
    return this.writing.review(user.userId, dto);
  }

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<WritingSubmissionSummary[]> {
    return this.writing.list(user.userId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<WritingSubmissionView> {
    return this.writing.get(user.userId, id);
  }
}
