import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma, type User } from '@prisma/client';
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
 * capped by `auth.otpMaxAttempts`. Delivery rides the shared Mail seam. The
 * `log` transport simulates delivery without exposing a code; SMTP delivers the
 * code to the recipient. There is no fallback between transports.
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
   *  code, persist the hash, and email the raw code. Issuance is serialized per
   *  user so concurrent resends cannot leave two usable codes behind. Delivery
   *  failures are observable without leaking the recipient, code or SMTP error. */
  async issue(user: Pick<User, 'id' | 'email'>, purpose: OtpPurpose): Promise<void> {
    const code = randomInt(0, 1_000_000).toString().padStart(6, '0');
    const ttl = this.config.getOrThrow<number>('auth.otpTtl');

    await this.withUserOtpLock(user.id, async (tx) => {
      // Only the newest code is ever valid. The parent-row lock prevents two
      // concurrent resend transactions from creating independent pending rows.
      await tx.emailOtp.updateMany({
        where: { userId: user.id, purpose, consumedAt: null },
        data: { consumedAt: new Date() },
      });
      await tx.emailOtp.create({
        data: {
          userId: user.id,
          purpose,
          codeHash: this.hash(code),
          expiresAt: new Date(Date.now() + ttl * 1000),
        },
      });
    });

    try {
      await this.mail.send(this.compose(purpose, code, ttl, user.email));
    } catch {
      // Do not include an Error object: provider errors can carry recipient or
      // transport details. The provider has its own safe startup diagnostic.
      this.logger.error(
        `OTP email delivery failed (purpose=${purpose}; transport=${this.mail.activeTransport}).`,
      );
    }
  }

  /** Verify a code for a user+purpose. Consumes it on success. Throws a generic
   *  BadRequest on any failure (unknown/expired/wrong/too-many-attempts) so the
   *  caller cannot distinguish cases — no oracle for guessing. */
  async verify(userId: string, code: string, purpose: OtpPurpose): Promise<void> {
    const invalid = new BadRequestException('Invalid or expired code.');
    await this.withUserOtpLock(userId, async (tx) => {
      const now = new Date();
      const record = await tx.emailOtp.findFirst({
        where: { userId, purpose, consumedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      if (!record || record.expiresAt.getTime() <= now.getTime()) throw invalid;

      // Defensive cleanup for any stale rows that may pre-date serialized
      // issuance. They must never become valid after the newest code is used.
      await tx.emailOtp.updateMany({
        where: { userId, purpose, consumedAt: null, id: { not: record.id } },
        data: { consumedAt: now },
      });

      const maxAttempts = this.config.getOrThrow<number>('auth.otpMaxAttempts');
      if (record.attempts >= maxAttempts) {
        // Burn it so a locked-out code cannot be retried after it would expire.
        await tx.emailOtp.updateMany({
          where: { id: record.id, consumedAt: null },
          data: { consumedAt: now },
        });
        throw invalid;
      }

      if (!this.matches(code, record.codeHash)) {
        await tx.emailOtp.updateMany({
          where: { id: record.id, consumedAt: null },
          data: { attempts: { increment: 1 } },
        });
        throw invalid;
      }

      // The conditional update remains a second line of defence if a database
      // transaction is retried or another path races outside this service.
      const consumed = await tx.emailOtp.updateMany({
        where: { id: record.id, consumedAt: null },
        data: { consumedAt: now },
      });
      if (consumed.count !== 1) throw invalid;
    });
  }

  // ── internals ──────────────────────────────────────────────────────────

  /**
   * PostgreSQL row locking gives every OTP purpose for one user a shared,
   * cross-process critical section. A process-local mutex would not protect a
   * horizontally scaled API; no schema change is required because every OTP
   * already belongs to a User row.
   */
  private async withUserOtpLock<T>(
    userId: string,
    operation: (tx: Prisma.TransactionClient) => Promise<T>,
  ): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw(
        Prisma.sql`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`,
      );
      return operation(tx);
    });
  }

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
