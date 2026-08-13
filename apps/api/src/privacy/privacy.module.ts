import { Module } from '@nestjs/common';
import { PrivacyController } from './privacy.controller';
import { PrivacyService } from './privacy.service';

/** Privacy & GDPR (Sprint 8.7). Data export, consent, and account deletion.
 *  Prisma is @Global; nothing else is needed. */
@Module({
  controllers: [PrivacyController],
  providers: [PrivacyService],
})
export class PrivacyModule {}
