import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { InitiativeView } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { ProactiveService } from './proactive.service';

/** Advanced Intelligence (Sprint 9). The proactive mentor's initiatives + the
 *  learner's response to them (kept so the mentor learns what lands). */
@UseGuards(JwtAccessGuard)
@Controller('proactive')
export class IntelligenceController {
  constructor(private readonly proactive: ProactiveService) {}

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<InitiativeView[]> {
    return this.proactive.list(user.userId);
  }

  @Post(':id/act')
  @HttpCode(HttpStatus.NO_CONTENT)
  async act(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.proactive.respond(user.userId, id, 'acted');
  }

  @Post(':id/dismiss')
  @HttpCode(HttpStatus.NO_CONTENT)
  async dismiss(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.proactive.respond(user.userId, id, 'dismissed');
  }
}
