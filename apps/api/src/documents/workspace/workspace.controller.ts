import {
  Body,
  Controller,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  WorkAnalysis,
  WorkspaceAssistResponse,
} from '@second-brain/shared';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { WorkspaceService } from './workspace.service';
import { AssistDto } from './dto/assist.dto';

/** AI Academic Workspace (Sprint 6.7) — analyse an academic work and accompany
 *  the student on it in one of three modes, twin-adapted. */
@UseGuards(JwtAccessGuard)
@Controller('library/documents')
export class WorkspaceController {
  constructor(private readonly workspace: WorkspaceService) {}

  /** Automatic analysis of the work (objectives, skills, prerequisites,
   *  success criteria, and concepts THIS learner will find hard). */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/workspace/analyze')
  @HttpCode(HttpStatus.OK)
  analyze(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<WorkAnalysis> {
    return this.workspace.analyze(user.userId, id);
  }

  /** One teacher turn in the chosen accompaniment mode. */
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post(':id/workspace/assist')
  @HttpCode(HttpStatus.OK)
  async assist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: AssistDto,
  ): Promise<WorkspaceAssistResponse> {
    const reply = await this.workspace.assist(user.userId, id, dto.mode, dto.messages);
    return { mode: dto.mode, reply };
  }
}
