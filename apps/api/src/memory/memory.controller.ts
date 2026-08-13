import { Controller, Get, UseGuards } from '@nestjs/common';
import type { LearningMemory } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { MemoryService } from './memory.service';

@UseGuards(JwtAccessGuard)
@Controller('memory')
export class MemoryController {
  constructor(private readonly memory: MemoryService) {}

  /** The unified pedagogical memory: a summary + a chronological timeline. */
  @Get()
  timeline(@CurrentUser() user: AuthenticatedUser): Promise<LearningMemory> {
    return this.memory.timeline(user.userId);
  }
}
