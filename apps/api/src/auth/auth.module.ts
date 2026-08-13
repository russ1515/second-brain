import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationService } from './email-verification.service';
import { TwoFactorService } from './two-factor.service';
import { SecretCipher } from './secret-cipher';
import { JwtAccessStrategy } from './strategies/jwt-access.strategy';

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
    TwoFactorService,
    SecretCipher,
    JwtAccessStrategy,
  ],
  exports: [AuthService],
})
export class AuthModule {}
