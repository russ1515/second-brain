import { Module } from '@nestjs/common';
import { CalendarModule } from '../calendar/calendar.module';
import { CoachModule } from '../coach/coach.module';
import { ExperienceSessionModule } from '../experience-sessions/experience-session.module';
import { GoalsModule } from '../goals/goals.module';
import { IntelligenceModule } from '../intelligence/intelligence.module';
import { MentorModule } from '../mentor/mentor.module';
import { PredictionModule } from '../prediction/prediction.module';
import { RecommendationModule } from '../recommendation/recommendation.module';
import { RevisionModule } from '../revision/revision.module';
import { HomeController } from './home.controller';
import { HomeOverviewService } from './home-overview.service';

@Module({
  imports: [
    RecommendationModule,
    CoachModule,
    RevisionModule,
    GoalsModule,
    ExperienceSessionModule,
    CalendarModule,
    MentorModule,
    IntelligenceModule,
    PredictionModule,
  ],
  controllers: [HomeController],
  providers: [HomeOverviewService],
  exports: [HomeOverviewService],
})
export class HomeModule {}
