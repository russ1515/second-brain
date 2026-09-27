import {
  BadRequestException,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Put,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { ImageUpload } from './image-safety.service';
import { PrivateMediaService } from './private-media.service';

const AVATAR_MAX_BYTES = 10 * 1024 * 1024;

@UseGuards(JwtAccessGuard)
@Controller('profile/avatar')
export class AvatarController {
  constructor(private readonly media: PrivateMediaService) {}

  @Get()
  async get(
    @CurrentUser() user: AuthenticatedUser,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const avatar = await this.media.getAvatar(user.userId);
    response.set({
      'Content-Type': avatar.mimeType,
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline; filename="avatar.webp"',
      'Last-Modified': avatar.modifiedAt.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(avatar.buffer);
  }

  @Put()
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: AVATAR_MAX_BYTES } }))
  async put(
    @CurrentUser() user: AuthenticatedUser,
    @UploadedFile() file?: ImageUpload,
  ): Promise<{ modifiedAt: string }> {
    if (!file) throw new BadRequestException('An avatar image is required.');
    return this.media.putAvatar(user.userId, file);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.media.deleteAvatar(user.userId);
  }
}
