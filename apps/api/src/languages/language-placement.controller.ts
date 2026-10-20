import { Body, Controller, Get, HttpCode, HttpException, HttpStatus, Param, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { LanguagePlacementView } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { SaveLanguagePlacementProgressDto, StartLanguagePlacementDto, SubmitLanguagePlacementDto } from './dto/language-placement.dto';
import { LanguagePlacementService } from './language-placement.service';
import { PlacementRuntimeException } from '../common/language-placement-error';

@UseGuards(JwtAccessGuard)
@Controller('languages/:id/placement')
export class LanguagePlacementController {
  constructor(private readonly placement: LanguagePlacementService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<LanguagePlacementView> {
    return this.run(() => this.placement.get(user.userId, id));
  }

  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('progress')
  @HttpCode(HttpStatus.OK)
  progress(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SaveLanguagePlacementProgressDto): Promise<LanguagePlacementView> {
    return this.run(() => this.placement.saveProgress(user.userId, id, dto));
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('start')
  @HttpCode(HttpStatus.OK)
  start(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: StartLanguagePlacementDto): Promise<LanguagePlacementView> {
    return this.run(() => this.placement.start(user.userId, id, dto));
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('submit')
  @HttpCode(HttpStatus.OK)
  submit(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string, @Body() dto: SubmitLanguagePlacementDto): Promise<LanguagePlacementView> {
    return this.run(() => this.placement.submit(user.userId, id, dto));
  }

  /** Unexpected runtime failures retain a safe placement identifier too. Known
   * authentication, quota and state/input rejections keep their existing 4xx. */
  private async run(action: () => Promise<LanguagePlacementView>): Promise<LanguagePlacementView> {
    try { return await action(); }
    catch (error) {
      if (error instanceof PlacementRuntimeException
        || (error instanceof HttpException && error.getStatus() < 500)) throw error;
      throw new PlacementRuntimeException('PLACEMENT_UNKNOWN_RUNTIME_ERROR');
    }
  }
}
