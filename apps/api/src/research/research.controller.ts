import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { ResearchAvailabilityResponse, ResearchResult } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RunResearchDto } from './dto/run-research.dto';
import { ResearchService } from './research.service';

@UseGuards(JwtAccessGuard)
@Controller('research')
export class ResearchController {
  constructor(private readonly research: ResearchService) {}

  @Get('availability')
  availability(): Promise<ResearchAvailabilityResponse> {
    return this.research.availability();
  }

  @Throttle({ default: { limit: 12, ttl: 60_000 } })
  @Post('run')
  run(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: RunResearchDto,
  ): Promise<ResearchResult> {
    return this.research.run(user.userId, dto);
  }
}
