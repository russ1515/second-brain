import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type {
  AuthResponse,
  AuthTokens,
  AuthUser,
  LoginResponse,
  TwoFactorEnableResponse,
  TwoFactorSetupResponse,
} from '@second-brain/shared';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { TwoFactorService } from './two-factor.service';
import { CurrentUser } from './decorators/current-user.decorator';
import { LoginDto } from './dto/login.dto';
import { LogoutDto } from './dto/logout.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SetLocaleDto } from './dto/set-locale.dto';
import { TwoFactorCodeDto } from './dto/two-factor-code.dto';
import { TwoFactorVerifyDto } from './dto/two-factor-verify.dto';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import type {
  AuthenticatedUser,
  HttpRequestLike,
  SessionContext,
} from './auth.types';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly twoFactor: TwoFactorService,
  ) {}

  // Tighter limits than the global throttler: credential endpoints are prime
  // brute-force targets (10 attempts / minute / IP).
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  register(
    @Body() dto: RegisterDto,
    @Req() req: HttpRequestLike,
  ): Promise<AuthResponse> {
    return this.auth.register(dto, this.sessionContext(req));
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(
    @Body() dto: LoginDto,
    @Req() req: HttpRequestLike,
  ): Promise<LoginResponse> {
    return this.auth.login(dto, this.sessionContext(req));
  }

  // Rotates the token pair. The refresh token is itself the credential, so this
  // is public (no access guard) but rate-limited against token-guessing.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(
    @Body() dto: RefreshDto,
    @Req() req: HttpRequestLike,
  ): Promise<AuthTokens> {
    return this.auth.refresh(dto.refreshToken, this.sessionContext(req));
  }

  // Revokes the session for the supplied refresh token. Idempotent → 204.
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() dto: LogoutDto): Promise<void> {
    await this.auth.logout(dto.refreshToken);
  }

  // Revokes every session for the authenticated user (all devices) → 204.
  @UseGuards(JwtAccessGuard)
  @Post('logout-all')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logoutAll(@CurrentUser() user: AuthenticatedUser): Promise<void> {
    await this.auth.logoutAll(user.userId);
  }

  // Confirms an email address from the token in the verification mail. Public:
  // the high-entropy token is the credential. Rate-limited against guessing.
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('verify-email')
  @HttpCode(HttpStatus.OK)
  verifyEmail(@Body() dto: VerifyEmailDto): Promise<AuthUser> {
    return this.emailVerification.verify(dto.token);
  }

  // Re-sends the verification email (as a fresh 6-digit OTP) for the
  // authenticated, still-unverified user.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @UseGuards(JwtAccessGuard)
  @Post('resend-verification')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendVerification(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<void> {
    await this.auth.resendEmailOtp(user.userId);
  }

  // ── Email OTP + password reset (§27/§28) ──

  // Confirms the authenticated user's email with the 6-digit OTP mailed at
  // registration/resend. Rate-limited against guessing.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(JwtAccessGuard)
  @Post('verify-otp')
  @HttpCode(HttpStatus.OK)
  verifyOtp(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: VerifyOtpDto,
  ): Promise<AuthUser> {
    return this.auth.verifyEmailOtp(user.userId, dto.code);
  }

  // Starts a password reset by emailing a reset OTP. Public + throttled; always
  // returns 204 without revealing whether the email is registered.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    await this.auth.requestPasswordReset(dto.email);
  }

  // Completes a password reset with the emailed OTP → 204. Public + throttled.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    await this.auth.resetPassword(dto.email, dto.code, dto.password);
  }

  // ── Two-factor auth ──

  // Begins enrollment: returns the otpauth URI (QR) + secret. Not active until enable.
  @UseGuards(JwtAccessGuard)
  @Post('2fa/setup')
  @HttpCode(HttpStatus.OK)
  setupTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
  ): Promise<TwoFactorSetupResponse> {
    return this.twoFactor.setup(user.userId);
  }

  // Confirms a TOTP code, enables 2FA, and returns single-use recovery codes.
  @UseGuards(JwtAccessGuard)
  @Post('2fa/enable')
  @HttpCode(HttpStatus.OK)
  enableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<TwoFactorEnableResponse> {
    return this.twoFactor.enable(user.userId, dto.code);
  }

  // Disables 2FA after confirming a current TOTP or recovery code → 204.
  @UseGuards(JwtAccessGuard)
  @Post('2fa/disable')
  @HttpCode(HttpStatus.NO_CONTENT)
  async disableTwoFactor(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: TwoFactorCodeDto,
  ): Promise<void> {
    await this.twoFactor.disable(user.userId, dto.code);
  }

  // Completes a 2FA login challenge with a TOTP/recovery code → full tokens.
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('2fa/verify')
  @HttpCode(HttpStatus.OK)
  verifyTwoFactor(
    @Body() dto: TwoFactorVerifyDto,
    @Req() req: HttpRequestLike,
  ): Promise<AuthResponse> {
    return this.twoFactor.verifyLogin(
      dto.challengeToken,
      dto.code,
      this.sessionContext(req),
    );
  }

  @UseGuards(JwtAccessGuard)
  @Get('me')
  me(@CurrentUser() user: AuthenticatedUser): Promise<AuthUser> {
    return this.auth.me(user.userId);
  }

  // Set the Learning Locale (single source of truth for UI + AI content).
  @UseGuards(JwtAccessGuard)
  @Patch('locale')
  @HttpCode(HttpStatus.OK)
  setLocale(
    @CurrentUser() user: AuthenticatedUser,
    @Body() dto: SetLocaleDto,
  ): Promise<AuthUser> {
    return this.auth.setLocale(user.userId, dto.locale);
  }

  private sessionContext(req: HttpRequestLike): SessionContext {
    const userAgent = req.headers['user-agent'];
    return {
      userAgent: Array.isArray(userAgent) ? userAgent[0] : userAgent,
      ipAddress: req.ip,
    };
  }
}
