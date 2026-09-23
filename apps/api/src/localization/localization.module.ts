import { Global, Module } from '@nestjs/common';
import { LocalizationService } from './localization.service';

/** Static localization for deterministic analysis copy. @Global so every engine
 *  uses the same locale source and checked-in catalogue. */
@Global()
@Module({
  providers: [LocalizationService],
  exports: [LocalizationService],
})
export class LocalizationModule {}
