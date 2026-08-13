import { Module } from '@nestjs/common';
import { ConceptModule } from '../concepts/concept.module';
import { IntelligenceController } from './intelligence.controller';
import { ProactiveService } from './proactive.service';

/** Advanced Intelligence (Sprint 9). The proactive mentor layer. Reuses the
 *  concept engines (LearningPathService, MasteryService) rather than duplicating
 *  logic; Prisma is @Global. Each engine is a separate, replaceable service. */
@Module({
  imports: [ConceptModule],
  controllers: [IntelligenceController],
  providers: [ProactiveService],
  exports: [ProactiveService],
})
export class IntelligenceModule {}
