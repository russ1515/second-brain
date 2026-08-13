import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { CalendarEntry, CalendarView } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CalendarService } from './calendar.service';
import { CreateCalendarEventDto } from './dto/create-calendar-event.dto';

/** Smart Calendar (task 5.4): the auto-generated calendar + the learner's own
 *  events. AI entries are read-only; only user events can be created/deleted. */
@UseGuards(JwtAccessGuard)
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendar: CalendarService) {}

  /** The assembled calendar over the horizon, day by day. */
  @Get()
  view(@CurrentUser() user: AuthenticatedUser): Promise<CalendarView> {
    return this.calendar.view(user.userId);
  }

  /** Add one of the learner's own events (exam, objective, deadline). */
  @Post('events')
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateCalendarEventDto,
  ): Promise<CalendarEntry> {
    return this.calendar.createEvent(user.userId, dto);
  }

  /** Remove one of the learner's own events (AI entries can't be removed). */
  @Delete('events/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    return this.calendar.deleteEvent(user.userId, id);
  }
}
