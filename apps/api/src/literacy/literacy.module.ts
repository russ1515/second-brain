import { Module } from '@nestjs/common';
import { WritingController } from './writing.controller';
import { WritingService } from './writing.service';
import { ReadingController } from './reading.controller';
import { ReadingService } from './reading.service';

/** Writing & Reading coach (Sprint 7.7). Depends only on the @Global LLM seam +
 *  Prisma: the writing coach reviews productions across seven dimensions, the
 *  reading coach generates level-adapted passages, evaluates comprehension, and
 *  auto-adapts the level. */
@Module({
  controllers: [WritingController, ReadingController],
  providers: [WritingService, ReadingService],
  exports: [WritingService, ReadingService],
})
export class LiteracyModule {}
