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
  AssessmentSubmissionView,
  AssessmentSummary,
  AssessmentView,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ExaminerService } from './examiner.service';
import { CreateAssessmentDto } from './dto/create-assessment.dto';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';

/** AI Examiner (Sprint 7.6): the teacher creates assessments (QCM, open
 *  questions, dissertations, exercises, case studies, mock exams, oral
 *  evaluations), then marks them — explaining and advising, never a bare grade. */
@UseGuards(JwtAccessGuard)
@Controller('examiner')
export class ExaminerController {
  constructor(private readonly examiner: ExaminerService) {}

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateAssessmentDto,
  ): Promise<AssessmentView> {
    return this.examiner.create(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<AssessmentSummary[]> {
    return this.examiner.list(user.userId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<AssessmentView> {
    return this.examiner.get(user.userId, id);
  }

  @Throttle({ default: { limit: 15, ttl: 60_000 } })
  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  submit(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SubmitAssessmentDto,
  ): Promise<AssessmentSubmissionView> {
    return this.examiner.submit(user.userId, id, dto.answers);
  }
}
