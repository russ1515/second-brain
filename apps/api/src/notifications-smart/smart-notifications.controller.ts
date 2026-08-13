import { Controller, Get, UseGuards } from '@nestjs/common';
import type { SmartNotificationsView } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SmartNotificationsService } from './smart-notifications.service';

/** Smart Notifications (task 5.6): pedagogical, justified notifications. */
@UseGuards(JwtAccessGuard)
@Controller('notifications')
export class SmartNotificationsController {
  constructor(private readonly smart: SmartNotificationsService) {}

  /** The learner's current smart notifications, each with its justification. */
  @Get('smart')
  smartNotifications(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<SmartNotificationsView> {
    return this.smart.notifications(user.userId);
  }
}
