import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { EmailOtpService } from './email-otp.service';
import { TwoFactorService } from './two-factor.service';
import { SecretCipher } from './secret-cipher';
import { PrivateBetaAccessService } from './private-beta-access.service';
import { JwtAccessGuard } from './guards/jwt-access.guard';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

/** JWT guards are consumed by controllers throughout the API. Their new
 * private-beta dependency must therefore be visible in every feature module. */
@Global()
@Module({
  imports: [
    PassportModule,
    // Secrets and TTLs are supplied per-sign call in AuthService (access vs
    // refresh use different secrets), so no global signing config is needed here.
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    EmailVerificationService,
    EmailOtpService,
    TwoFactorService,
    SecretCipher,
    PrivateBetaAccessService,
    JwtAccessGuard,
    JwtAccessStrategy,
  ],
  exports: [AuthService, PrivateBetaAccessService, JwtAccessGuard],
})
export class AuthModule {}
