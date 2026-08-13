import { Module } from '@nestjs/common';
import { ConceptModule } from '../concepts/concept.module';
import { MentorModule } from '../mentor/mentor.module';
import { GoalsModule } from '../goals/goals.module';
import { AiMentorController } from './ai-mentor.controller';
import { AiMentorService } from './ai-mentor.service';

/** AI Mentor (Sprint 9.5). A separate, replaceable engine that COMPOSES the twin
 *  (MasteryService), the mentor's streak (MentorService) and the exams
 *  (ExamsService) into a strategic assessment across success, exam prep,
 *  organization, work method and confidence — no logic is duplicated. */
@Module({
  imports: [ConceptModule, MentorModule, GoalsModule],
  controllers: [AiMentorController],
  providers: [AiMentorService],
  exports: [AiMentorService],
})
export class AiMentorModule {}
