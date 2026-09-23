import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import type { BrainAnswer, BrainConceptView, BrainGraphPage, BrainOverview, BrainSearchPage } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BrainService } from './brain.service';
import { AskBrainDto } from './dto/ask-brain.dto';

@UseGuards(JwtAccessGuard)
@Controller('brain')
export class BrainController {
  constructor(private readonly brain: BrainService) {}

  @Get('overview')
  overview(@CurrentUser() user: AuthenticatedUser): Promise<BrainOverview> {
    return this.brain.overview(user.userId);
  }

  @Get('graph')
  graph(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
    @Query('q') query?: string,
    @Query('documentId') documentId?: string,
  ): Promise<BrainGraphPage> {
    return this.brain.graph(user.userId, { limit: Number(limit) || 40, cursor, query, documentId });
  }

  @Get('search')
  search(
    @CurrentUser() user: AuthenticatedUser,
    @Query('q') query?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<BrainSearchPage> {
    return this.brain.search(user.userId, query ?? '', Number(limit) || 12, cursor);
  }

  @Get('concepts/:id')
  concept(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<BrainConceptView> {
    return this.brain.concept(user.userId, id);
  }

  @Post('ask')
  ask(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: AskBrainDto,
  ): Promise<BrainAnswer> {
    return this.brain.ask(user.userId, dto.question);
  }
}
