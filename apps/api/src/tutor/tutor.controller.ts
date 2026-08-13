import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type {
  SendTutorMessageResponse,
  TutorSessionDetail,
  TutorSessionSummary,
  VoiceTurnResponse,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { TutorService } from './tutor.service';
import { VoiceService } from './voice.service';
import { CreateTutorSessionDto } from './dto/create-tutor-session.dto';
import { SendTutorMessageDto } from './dto/send-tutor-message.dto';
import type { UploadedFileLike } from '../documents/extraction/text-extraction.service';

const MAX_AUDIO_BYTES = 10 * 1024 * 1024; // 10 MB

@UseGuards(JwtAccessGuard)
@Controller('tutor/sessions')
export class TutorController {
  constructor(
    private readonly tutor: TutorService,
    private readonly voice: VoiceService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateTutorSessionDto,
  ): Promise<TutorSessionSummary> {
    return this.tutor.createSession(user.userId, dto);
  }

  @Get()
  list(@CurrentUser() user: AuthenticatedUser): Promise<TutorSessionSummary[]> {
    return this.tutor.listSessions(user.userId);
  }

  /** Start a twin-steered session on the learner's most actionable weak spot,
   *  opened by a proactive tutor message. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('focus')
  @HttpCode(HttpStatus.CREATED)
  focus(@CurrentUser() user: AuthenticatedUser): Promise<TutorSessionDetail> {
    return this.tutor.focusOnWeakSpot(user.userId);
  }

  /** Resume the relationship: a natural conversation that remembers what we did
   *  recently and opens with a Socratic recall question (Sprint 7.2). */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('resume')
  @HttpCode(HttpStatus.CREATED)
  resume(@CurrentUser() user: AuthenticatedUser): Promise<TutorSessionDetail> {
    return this.tutor.resumeConversation(user.userId);
  }

  @Get(':id')
  get(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<TutorSessionDetail> {
    return this.tutor.getSession(user.userId, id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
  ): Promise<void> {
    await this.tutor.deleteSession(user.userId, id);
  }

  /** Send a learner message and get the tutor's grounded reply. */
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post(':id/messages')
  @HttpCode(HttpStatus.CREATED)
  sendMessage(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @Body() dto: SendTutorMessageDto,
  ): Promise<SendTutorMessageResponse> {
    return this.tutor.sendMessage(user.userId, id, dto.content, {
      pace: dto.pace,
    });
  }

  /**
   * Speak a turn (multipart field `audio`). Written-first: the interaction is
   * transcribed, answered by the same grounded tutor flow, and turned into a
   * complete written package (lesson + summary + exercises + corrections +
   * flashcards + revision sheet). `speak=true` voices the reply back.
   */
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post(':id/voice')
  @HttpCode(HttpStatus.CREATED)
  @UseInterceptors(
    FileInterceptor('audio', { limits: { fileSize: MAX_AUDIO_BYTES } }),
  )
  voiceTurn(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') id: string,
    @UploadedFile() audio: UploadedFileLike | undefined,
    @Body('speak') speak?: string,
    @Body('language') language?: string,
    @Body('lesson') lesson?: string,
  ): Promise<VoiceTurnResponse> {
    if (!audio) {
      throw new BadRequestException('No audio was uploaded (field "audio").');
    }
    return this.voice.handleTurn(user.userId, id, audio, {
      speak: this.isTrue(speak),
      language: language?.trim() || undefined,
      // Written-first is the default; only an explicit "false" opts out.
      lesson: this.isFalse(lesson) ? false : undefined,
    });
  }

  /** Multipart fields arrive as strings — no implicit boolean conversion. */
  private isTrue(value?: string): boolean {
    return value === 'true' || value === '1';
  }

  private isFalse(value?: string): boolean {
    return value === 'false' || value === '0';
  }
}
