import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

/** Why an OTP was issued. Kept as a plain union so it maps straight onto the
 *  `EmailOtp.purpose` string column. */
export type OtpPurpose = 'email_verify' | 'password_reset';

/**
 * Issues, emails and verifies short-lived 6-digit email OTP codes.
 *
 * Codes are single-use, expire fast (config `auth.otpTtl`), and only their
 * SHA-256 hash is stored — a DB leak never exposes a usable code. Guessing is
 * capped by `auth.otpMaxAttempts`. Delivery rides the shared Mail seam
 * (`MailService`), so `log` prints the code to the API console in dev and SMTP
 * mails it in production — no second mailer.
 */
@Injectable()
export class EmailOtpService {
  private readonly logger = new Logger(EmailOtpService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Generate a fresh code for a user+purpose, invalidate any earlier pending
   *  code, persist the hash, and email the raw code. Best-effort on delivery:
   *  a transport failure is logged, not thrown, so the caller never breaks. */
  async issue(user: Pick<User, 'id' | 'email'>, purpose: OtpPurpose): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const ttl = this.config.getOrThrow<number>('auth.otpTtl');

    // Only the newest code is ever valid: consume any still-pending ones.
    await this.prisma.emailOtp.updateMany({
      where: { userId: user.id, purpose, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.prisma.emailOtp.create({
      data: {
        userId: user.id,
        purpose,
        codeHash: this.hash(code),
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });

    try {
      await this.mail.send(this.compose(purpose, code, ttl, user.email));
    } catch (error) {
      this.logger.warn(
        `Failed to send ${purpose} OTP to ${user.email}: ${(error as Error).message}`,
      );
    }
  }

  /** Verify a code for a user+purpose. Consumes it on success. Throws a generic
   *  BadRequest on any failure (unknown/expired/wrong/too-many-attempts) so the
   *  caller cannot distinguish cases — no oracle for guessing. */
  async verify(userId: string, code: string, purpose: OtpPurpose): Promise<void> {
    const invalid = new BadRequestException('Invalid or expired code.');
    const record = await this.prisma.emailOtp.findFirst({
      where: { userId, purpose, consumedAt: null },
      orderBy: { createdAt: 'desc' },
    });
    if (!record || record.expiresAt.getTime() <= Date.now()) throw invalid;

    const maxAttempts = this.config.getOrThrow<number>('auth.otpMaxAttempts');
    if (record.attempts >= maxAttempts) {
      // Burn it so a locked-out code can't be retried after it would expire.
      await this.prisma.emailOtp.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      });
      throw invalid;
    }

    if (!this.matches(code, record.codeHash)) {
      await this.prisma.emailOtp.update({
        where: { id: record.id },
        data: { attempts: { increment: 1 } },
      });
      throw invalid;
    }

    await this.prisma.emailOtp.update({
      where: { id: record.id },
      data: { consumedAt: new Date() },
    });
  }

  // ── internals ──────────────────────────────────────────────────────────

  private compose(purpose: OtpPurpose, code: string, ttl: number, to: string) {
    const minutes = Math.max(1, Math.round(ttl / 60));
    const subject =
      purpose === 'password_reset'
        ? `${code} is your Second Brain password reset code`
        : `${code} is your Second Brain verification code`;
    const action =
      purpose === 'password_reset'
        ? 'reset your password'
        : 'confirm your email';
    return {
      to,
      subject,
      text:
        `Your Second Brain code to ${action} is:\n\n${code}\n\n` +
        `It expires in ${minutes} minutes. If you didn't request this, ignore this email.`,
    };
  }

  private hash(code: string): string {
    return createHash('sha256').update(code).digest('hex');
  }

  /** Constant-time comparison of the candidate's hash against the stored hash. */
  private matches(code: string, storedHash: string): boolean {
    const candidate = Buffer.from(this.hash(code), 'hex');
    const stored = Buffer.from(storedHash, 'hex');
    return candidate.length === stored.length && timingSafeEqual(candidate, stored);
  }
}
