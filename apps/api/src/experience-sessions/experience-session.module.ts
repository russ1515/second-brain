import { Module } from '@nestjs/common';
import { ExperienceSessionController } from './experience-session.controller';
import { ExperienceSessionService } from './experience-session.service';

@Module({
  controllers: [ExperienceSessionController],
  providers: [ExperienceSessionService],
  exports: [ExperienceSessionService],
})
export class ExperienceSessionModule {}
