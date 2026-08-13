import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import type {
  AdaptivePath,
  ConceptMastery,
  ConceptMasteryDetail,
  LearnerInsights,
  LearnerProfile,
  LearningPath,
  ProactivePlan,
  StrengthsWeaknesses,
  TwinGraph,
  TwinOverview,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { MasteryService } from './mastery.service';
import { LearningPathService } from './learning-path.service';
import { LearnerProfileService } from './learner-profile.service';
import { InsightsService } from './insights.service';
import { RecommendationsService } from './recommendations.service';

@UseGuards(JwtAccessGuard)
@Controller()
export class MasteryController {
  constructor(
    private readonly mastery: MasteryService,
    private readonly learningPath: LearningPathService,
    private readonly learnerProfile: LearnerProfileService,
    private readonly insights: InsightsService,
    private readonly recommendations: RecommendationsService,
  ) {}

  /** Digital Twin overview: mastery per concept + summary. */
  @Get('twin')
  twin(@CurrentUser() user: AuthenticatedUser): Promise<TwinOverview> {
    return this.mastery.twin(user.userId);
  }

  /** Digital Twin — the learner's behavioural profile (task 4.1). */
  @Get('twin/profile')
  profile(@CurrentUser() user: AuthenticatedUser): Promise<LearnerProfile> {
    return this.learnerProfile.profile(user.userId);
  }

  /** Per-concept mastery scored with the task-4.3 signals (stars, confidence,
   *  error frequency, forgetting risk, revision priority). */
  @Get('twin/mastery')
  masteryDetails(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ConceptMasteryDetail[]> {
    return this.mastery.masteryDetails(user.userId);
  }

  /** Strengths vs weaknesses — the view the AI personalises sessions from (4.5). */
  @Get('twin/strengths')
  strengths(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<StrengthsWeaknesses> {
    return this.mastery.strengthsWeaknesses(user.userId);
  }

  /** AI Insights — plain-language explanations of the AI's recommendations (4.6). */
  @Get('twin/insights')
  insightsFor(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<LearnerInsights> {
    return this.insights.insights(user.userId);
  }

  /** Proactive Recommendations — the mentor's actionable next steps (4.7). */
  @Get('twin/recommendations')
  recommendationsFor(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<ProactivePlan> {
    return this.recommendations.plan(user.userId);
  }

  /** Prioritised, prerequisite-aware study plan. */
  @Get('twin/next')
  next(@CurrentUser() user: AuthenticatedUser): Promise<LearningPath> {
    return this.learningPath.next(user.userId);
  }

  /** Knowledge graph annotated with mastery + learning status. */
  @Get('twin/graph')
  graph(@CurrentUser() user: AuthenticatedUser): Promise<TwinGraph> {
    return this.learningPath.graph(user.userId);
  }

  /** Adaptive Learning Path to a goal concept — consolidate prerequisites first
   *  (task 5.7). The engine decides the order. */
  @Get('twin/path/:conceptId')
  pathTo(
    @CurrentUser() user: AuthenticatedUser,
    @Param('conceptId') conceptId: string,
  ): Promise<AdaptivePath> {
    return this.learningPath.pathTo(user.userId, conceptId);
  }

  /** Mastery for a single concept. */
  @Get('concepts/:id/mastery')
  conceptMastery(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ConceptMastery> {
    return this.mastery.conceptMastery(user.userId, id);
  }
}
