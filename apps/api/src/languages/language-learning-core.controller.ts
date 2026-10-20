import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { LanguageLearningCoreService } from './language-learning-core.service';
import { LanguageCoreAnswersDto, LanguageCoreAssessmentDto, LanguageCoreHelpDto, LanguageCoreKeyDto, LanguageCoreSubmitDto } from './dto/language-learning-core.dto';

@UseGuards(JwtAccessGuard)
@Controller('languages/:id/learning-core')
export class LanguageLearningCoreController {
  constructor(private readonly core: LanguageLearningCoreService) {}
  @Get()
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string) { return this.core.get(user.userId, id); }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('lessons/:lessonId/start')
  @HttpCode(HttpStatus.OK)
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('lessonId') lessonId: string, @Body() body: LanguageCoreKeyDto) {
    return this.core.startLesson(user.userId, id, lessonId, body.idempotencyKey);
  }
  @Post('lessons/:lessonId/answers')
  @HttpCode(HttpStatus.OK)
  answers(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('lessonId') lessonId: string, @Body() body: LanguageCoreAnswersDto) {
    return this.core.saveAnswers(user.userId, id, lessonId, body.answers, body.phase, body.teachingStep);
  }
  @Post('lessons/:lessonId/submit')
  @HttpCode(HttpStatus.OK)
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('lessonId') lessonId: string, @Body() body: LanguageCoreSubmitDto) {
    return this.core.submit(user.userId, id, lessonId, body.answers, body.idempotencyKey);
  }
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('lessons/:lessonId/remediation')
  @HttpCode(HttpStatus.OK)
  remediate(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('lessonId') lessonId: string, @Body() body: LanguageCoreKeyDto) {
    return this.core.startLesson(user.userId, id, lessonId, body.idempotencyKey, true);
  }
  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('lessons/:lessonId/help')
  @HttpCode(HttpStatus.OK)
  help(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('lessonId') lessonId: string, @Body() body: LanguageCoreHelpDto) {
    return this.core.help(user.userId, id, lessonId, body.message, body.idempotencyKey);
  }
  @Post('assessments/start')
  @HttpCode(HttpStatus.OK)
  assessment(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: LanguageCoreAssessmentDto) {
    return this.core.startAssessment(user.userId, id, body.scope, body.targetId, body.idempotencyKey);
  }
  @Post('assessments/:targetId/answers')
  @HttpCode(HttpStatus.OK)
  assessmentAnswers(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('targetId') targetId: string, @Body() body: LanguageCoreAnswersDto) {
    return this.core.saveAnswers(user.userId, id, targetId, body.answers, body.phase, body.teachingStep);
  }
  @Post('assessments/:targetId/submit')
  @HttpCode(HttpStatus.OK)
  assessmentSubmit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Param('targetId') targetId: string, @Body() body: LanguageCoreSubmitDto) {
    return this.core.submit(user.userId, id, targetId, body.answers, body.idempotencyKey);
  }
  @Post('levels/next')
  @HttpCode(HttpStatus.OK)
  nextLevel(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() body: LanguageCoreKeyDto) {
    return this.core.nextLevel(user.userId, id, body.idempotencyKey);
  }
}
