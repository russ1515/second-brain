import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import type { ExperienceSession, ExperienceSessionPage } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateExperienceSessionDto } from './dto/create-experience-session.dto';
import { ListExperienceSessionsDto } from './dto/list-experience-sessions.dto';
import { UpdateExperienceSessionDto } from './dto/update-experience-session.dto';
import { ExperienceSessionService } from './experience-session.service';

@UseGuards(JwtAccessGuard)
@Controller('experience-sessions')
export class ExperienceSessionController {
  constructor(private readonly sessions: ExperienceSessionService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateExperienceSessionDto,
  ): Promise<ExperienceSession> {
    return this.sessions.create(user.userId, dto);
  }

  @Get()
  recent(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListExperienceSessionsDto,
  ): Promise<ExperienceSessionPage> {
    return this.sessions.recent(user.userId, query.limit, query.cursor);
  }

  @Get('resumable')
  resumable(
    @CurrentUser() user: AuthenticatedUser,
    @Query() query: ListExperienceSessionsDto,
  ): Promise<ExperienceSessionPage> {
    return this.sessions.resumable(user.userId, query.limit, query.cursor);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ExperienceSession> {
    return this.sessions.get(user.userId, id);
  }

  @Patch(':id')
  update(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: UpdateExperienceSessionDto,
  ): Promise<ExperienceSession> {
    return this.sessions.updateState(user.userId, id, dto);
  }

  @Post(':id/pause')
  pause(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ExperienceSession> {
    return this.sessions.pause(user.userId, id);
  }

  @Post(':id/resume')
  resume(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ExperienceSession> {
    return this.sessions.resume(user.userId, id);
  }

  @Post(':id/complete')
  complete(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<ExperienceSession> {
    return this.sessions.complete(user.userId, id);
  }
}
