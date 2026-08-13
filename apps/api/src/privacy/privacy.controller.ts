import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { ConsentView, DataExportResponse } from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { PrivacyService } from './privacy.service';
import { DeleteAccountDto, SetConsentDto } from './dto/privacy.dto';

/** Privacy & GDPR (Sprint 8.7): export your data, manage consents, delete your
 *  account. All scoped to the authenticated user. */
@UseGuards(JwtAccessGuard)
@Controller('me')
export class PrivacyController {
  constructor(private readonly privacy: PrivacyService) {}

  @Get('export')
  export(@CurrentUser() user: AuthenticatedUser): Promise<DataExportResponse> {
    return this.privacy.exportData(user.userId);
  }

  @Get('consents')
  consents(@CurrentUser() user: AuthenticatedUser): Promise<ConsentView[]> {
    return this.privacy.getConsents(user.userId);
  }

  @Put('consents')
  @HttpCode(HttpStatus.OK)
  setConsent(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetConsentDto,
  ): Promise<ConsentView> {
    return this.privacy.setConsent(user.userId, dto.key, dto.granted);
  }

  /** Irreversible: re-enter the password, then everything the user owns is
   *  cascade-deleted. */
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteAccount(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DeleteAccountDto,
  ): Promise<void> {
    await this.privacy.deleteAccount(user.userId, dto.password);
  }
}
