import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { Throttle } from '@nestjs/throttler';
import type {
  CheckoutResponse,
  InvoiceView,
  PaymentProviderName,
} from '@second-brain/shared';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import type { AuthenticatedUser } from '../auth/auth.types';
import { BillingService } from './billing.service';
import {
  CancelDto,
  CheckoutDto,
  DevConfirmDto,
  MobileVerifyDto,
} from './dto/billing.dto';

/** Billing & Payments (Sprint 8.2). The webhook is public (verified by provider
 *  signature); everything else is authenticated. The backend never sees card
 *  data — checkout is hosted, mobile purchases are verified server-side. */
@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @UseGuards(JwtAccessGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('checkout')
  @HttpCode(HttpStatus.OK)
  checkout(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CheckoutDto,
  ): Promise<CheckoutResponse> {
    return this.billing.startCheckout(user.userId, dto.slug, dto.interval);
  }

  @UseGuards(JwtAccessGuard)
  @Post('cancel')
  @HttpCode(HttpStatus.NO_CONTENT)
  async cancel(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: CancelDto,
  ): Promise<void> {
    await this.billing.cancel(user.userId, dto.atPeriodEnd ?? true);
  }

  @UseGuards(JwtAccessGuard)
  @Post('mobile/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyMobile(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: MobileVerifyDto,
  ): Promise<void> {
    await this.billing.verifyMobile(user.userId, dto);
  }

  @UseGuards(JwtAccessGuard)
  @Get('invoices')
  invoices(@CurrentUser() user: AuthenticatedUser): Promise<InvoiceView[]> {
    return this.billing.listInvoices(user.userId);
  }

  /** Dev-only: complete a fake checkout (stands in for the provider callback). */
  @UseGuards(JwtAccessGuard)
  @Post('dev/confirm')
  @HttpCode(HttpStatus.NO_CONTENT)
  async devConfirm(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: DevConfirmDto,
  ): Promise<void> {
    await this.billing.devConfirm(user.userId, dto.sessionId);
  }

  /** Provider webhook — PUBLIC, verified by the provider's signature. Uses the
   *  raw request body so signature verification is byte-exact. */
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Post('webhook/:provider')
  @HttpCode(HttpStatus.OK)
  async webhook(
    @Param('provider') provider: PaymentProviderName,
    @Req() req: RawBodyRequest<Request>,
  ): Promise<{ received: true }> {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(req.body ?? {});
    const signature = req.headers['stripe-signature'] as string | undefined;
    await this.billing.handleWebhook(provider, raw, signature);
    return { received: true };
  }
}
