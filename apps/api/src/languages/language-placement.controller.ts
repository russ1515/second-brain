import { Body, Controller, Get, HttpCode, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { LanguagePlacementView } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { StartLanguagePlacementDto, SubmitLanguagePlacementDto } from './dto/language-placement.dto';
import { LanguagePlacementService } from './language-placement.service';

@UseGuards(JwtAccessGuard)
@Controller('languages/:id/placement')
export class LanguagePlacementController {
  constructor(private readonly placement: LanguagePlacementService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<LanguagePlacementView> {
    return this.placement.get(user.userId, id);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('start')
  @HttpCode(HttpStatus.OK)
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: StartLanguagePlacementDto): Promise<LanguagePlacementView> {
    return this.placement.start(user.userId, id, dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('submit')
  @HttpCode(HttpStatus.OK)
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SubmitLanguagePlacementDto): Promise<LanguagePlacementView> {
    return this.placement.submit(user.userId, id, dto);
  }
}
