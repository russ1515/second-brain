import { Global, Module } from '@nestjs/common';
import { LocalizationService } from './localization.service';

/** Runtime localization for generated analysis (scalable i18n). @Global so any
 *  engine can translate its output into the learner's Learning Locale. Depends
 *  only on @Global providers (Prisma, LlmService, RedisService). */
@Global()
@Module({
  providers: [LocalizationService],
  exports: [LocalizationService],
})
export class LocalizationModule {}
