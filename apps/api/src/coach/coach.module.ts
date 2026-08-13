import { Module } from '@nestjs/common';
import { CoachController } from './coach.controller';
import { CoachService } from './coach.service';
import { AcademicCoachService } from './academic-coach.service';
import { ConceptModule } from '../concepts/concept.module';
import { MentorModule } from '../mentor/mentor.module';

/** Proactive AI coach (sprint 2, task 8) + Personalized Academic Coach (9.2).
 *  Both reuse the twin (MasteryService); the academic coach additionally reuses
 *  the mentor's streak (MentorService) and reads raw study signals via Prisma.
 *  Each coach is a separate, replaceable service — no logic is duplicated. */
@Module({
  imports: [ConceptModule, MentorModule], // MasteryService/LearningPathService + MentorService
  controllers: [CoachController],
  providers: [CoachService, AcademicCoachService],
  exports: [CoachService, AcademicCoachService],
})
export class CoachModule {}
