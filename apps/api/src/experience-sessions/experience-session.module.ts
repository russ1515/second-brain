import { Module } from '@nestjs/common';
import { ExperienceSessionController } from './experience-session.controller';
import { ExperienceSessionService } from './experience-session.service';
import { LearningDataDeletionService } from './learning-data-deletion.service';

@Module({
  controllers: [ExperienceSessionController],
  providers: [ExperienceSessionService, LearningDataDeletionService],
  exports: [ExperienceSessionService, LearningDataDeletionService],
})
export class ExperienceSessionModule {}
