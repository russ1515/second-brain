import { Controller, Get, UseGuards } from '@nestjs/common';
import type { HomeOverview } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { HomeOverviewService } from './home-overview.service';

@UseGuards(JwtAccessGuard)
@Controller('home')
export class HomeController {
  constructor(private readonly home: HomeOverviewService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser): Promise<HomeOverview> {
    return this.home.overview(user.userId);
  }
}
