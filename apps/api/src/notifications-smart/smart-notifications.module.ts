import { Module } from '@nestjs/common';
import { SmartNotificationsController } from './smart-notifications.controller';
import { SmartNotificationsService } from './smart-notifications.service';
import { ConceptModule } from '../concepts/concept.module';
import { RevisionModule } from '../revision/revision.module';

/** Smart Notifications (Sprint 5, task 5.6). Assembles pedagogical, justified
 *  notifications from the twin/learning-path (ConceptModule) and predictive
 *  revision (RevisionModule). Read-only composition. */
@Module({
  imports: [ConceptModule, RevisionModule],
  controllers: [SmartNotificationsController],
  providers: [SmartNotificationsService],
  exports: [SmartNotificationsService],
})
export class SmartNotificationsModule {}
