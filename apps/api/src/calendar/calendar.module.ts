import { Module } from '@nestjs/common';
import { CalendarController } from './calendar.controller';
import { CalendarService } from './calendar.service';

/** Smart Calendar (Sprint 5, task 5.4). Assembles the calendar from the other
 *  engines' scheduled items (reviewables, flashcards) plus the learner's own
 *  events. Read-only aggregation + user-event CRUD; needs only PrismaService. */
@Module({
  controllers: [CalendarController],
  providers: [CalendarService],
  exports: [CalendarService],
})
export class CalendarModule {}
