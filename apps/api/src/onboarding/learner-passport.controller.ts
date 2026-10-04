import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import type { LearnerPassportView } from '@second-brain/shared';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { UpdateLearnerPassportDto } from './dto/update-learner-passport.dto';
import { LearnerPassportService } from './learner-passport.service';

@UseGuards(JwtAccessGuard)
@Controller('learner-passport')
export class LearnerPassportController {
  constructor(private readonly passport: LearnerPassportService) {}

  @Get()
  get(@CurrentUser() user: AuthenticatedUser): Promise<LearnerPassportView> {
    return this.passport.get(user.userId);
  }

  @Patch()
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: UpdateLearnerPassportDto,
  ): Promise<LearnerPassportView> {
    return this.passport.update(user.userId, dto);
  }
}
