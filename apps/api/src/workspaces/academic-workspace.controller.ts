import { Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  PersistentWorkspace,
  PersistentWorkspaceAssistResponse,
  WorkspaceAutosaveResult,
  WorkspacePage,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AcademicWorkspaceService } from './academic-workspace.service';
import { CreateWorkspaceDto, UpdateWorkspaceDto, WorkspaceAssistDto, WorkspaceAutosaveDto } from './dto/workspace.dto';

@UseGuards(JwtAccessGuard)
@Controller('workspaces')
export class AcademicWorkspaceController {
  constructor(private readonly workspaces: AcademicWorkspaceService) {}

  @Get()
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ): Promise<WorkspacePage> {
    return this.workspaces.list(user.userId, Number(limit) || 20, cursor);
  }

  @Post()
  create(@CurrentUser() user: AuthenticatedUser, @Body() dto: CreateWorkspaceDto): Promise<PersistentWorkspace> {
    return this.workspaces.create(user.userId, dto);
  }

  @Get(':id')
  get(@CurrentUser() user: AuthenticatedUser, @Param('id') id: string): Promise<PersistentWorkspace> {
    return this.workspaces.get(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateWorkspaceDto,
  ): Promise<PersistentWorkspace> {
    return this.workspaces.update(user.userId, id, dto);
  }

  @Patch(':id/autosave')
  autosave(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: WorkspaceAutosaveDto,
  ): Promise<WorkspaceAutosaveResult> {
    return this.workspaces.autosave(user.userId, id, dto);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/assistant')
  assist(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: WorkspaceAssistDto,
  ): Promise<PersistentWorkspaceAssistResponse> {
    return this.workspaces.assist(user.userId, id, dto);
  }
}
