import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Put,
  Query,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CreateUserReportDto, UserReportListQueryDto } from '../diagnostics/dto/diagnostics.dto';
import { UserReportService, type CreatedUserReport } from '../diagnostics/user-report.service';
import type { ImageUpload } from '../media/image-safety.service';
import { PrivateMediaService } from '../media/private-media.service';

const REPORT_SCREENSHOT_MAX_BYTES = 10 * 1024 * 1024;

/** User-facing reporting (Sprint 8.5). Any signed-in user can file a report; the
 *  triage happens in the admin dashboard. */
@UseGuards(JwtAccessGuard)
@Controller('reports')
export class ReportsController {
  constructor(
    private readonly reports: UserReportService,
    private readonly media: PrivateMediaService,
  ) {}

  @Get()
  @Header('Cache-Control', 'private, no-store')
  list(@CurrentUser() user: AuthenticatedUser, @Query() query: UserReportListQueryDto) {
    return this.reports.list(user.userId, query);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CreateUserReportDto,
  ): Promise<CreatedUserReport> {
    return this.reports.create(user.userId, dto);
  }

  @Put(':id/screenshot')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('file', { limits: { files: 1, fileSize: REPORT_SCREENSHOT_MAX_BYTES } }))
  async putScreenshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') reportId: string,
    @UploadedFile() file?: ImageUpload,
  ): Promise<{ screenshotAvailable: true; modifiedAt: string }> {
    if (!file) throw new BadRequestException('A support screenshot is required.');
    const result = await this.media.putReportScreenshot(user.userId, reportId, file);
    return { screenshotAvailable: true, modifiedAt: result.modifiedAt };
  }

  @Get(':id/screenshot')
  @Header('Cache-Control', 'private, no-store')
  async getScreenshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') reportId: string,
    @Res({ passthrough: true }) response: Response,
  ): Promise<StreamableFile> {
    const screenshot = await this.media.getReportScreenshot(user.userId, reportId);
    response.set({
      'Content-Type': screenshot.mimeType,
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'inline; filename="support-screenshot.webp"',
      'Last-Modified': screenshot.modifiedAt.toUTCString(),
      'X-Content-Type-Options': 'nosniff',
    });
    return new StreamableFile(screenshot.buffer);
  }

  @Delete(':id/screenshot')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteScreenshot(
    @CurrentUser() user: AuthenticatedUser,
    @Param('id') reportId: string,
  ): Promise<void> {
    await this.media.deleteReportScreenshot(user.userId, reportId);
  }
}
