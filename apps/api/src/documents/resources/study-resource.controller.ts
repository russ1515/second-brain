import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { StudyResource } from '@second-brain/shared';
import { CurrentUser } from '../../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../../auth/auth.types';
import { StudyResourceService } from './study-resource.service';
import { GenerateResourceDto } from './dto/generate-resource.dto';

/** AI Study Resources Generator (Sprint 6.6) — generate + persist study
 *  material derived from a document. */
@UseGuards(JwtAccessGuard)
@Controller('library')
export class StudyResourceController {
  constructor(private readonly resources: StudyResourceService) {}

  /** Generate and SAVE a resource from a document. LLM-backed (or card-gen). */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('documents/:id/resources')
  @HttpCode(HttpStatus.CREATED)
  generate(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: GenerateResourceDto,
  ): Promise<StudyResource> {
    return this.resources.generate(user.userId, id, dto.type);
  }

  /** List the saved resources for a document. */
  @Get('documents/:id/resources')
  list(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<StudyResource[]> {
    return this.resources.list(user.userId, id);
  }

  /** Fetch one saved resource. */
  @Get('resources/:id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<StudyResource> {
    return this.resources.get(user.userId, id);
  }

  @Delete('resources/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.resources.remove(user.userId, id);
  }
}
