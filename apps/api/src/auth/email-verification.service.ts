import { createHash, randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { User } from '@prisma/client';
import type { AuthUser } from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

/** Issues, sends and consumes email-verification tokens.
 *  Tokens are high-entropy random strings; only their SHA-256 hash is stored,
 *  so the DB never holds anything a leak could replay, and lookup stays O(1)
 *  via the unique hash index. */
@Injectable()
export class EmailVerificationService {
  private readonly logger = new Logger(EmailVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
    private readonly config: ConfigService,
  ) {}

  /** Create a fresh token for a user and email it. Best-effort on the send:
   *  a transport failure is logged, not thrown, so registration still succeeds. */
  async issueAndSend(user: Pick<User, 'id' | 'email'>): Promise<void> {
    const token = await this.createToken(user.id);
    const verifyUrl = `${this.config.getOrThrow<string>('app.url')}/verify-email?token=${token}`;

    try {
      await this.mail.send({
        to: user.email,
        subject: 'Confirm your Second Brain email',
        text:
          `Welcome to Second Brain!\n\n` +
          `Confirm your email by opening this link:\n${verifyUrl}\n\n` +
          `Or submit this token to POST /api/auth/verify-email:\n${token}\n\n` +
          `This link expires in ${this.ttlHours()} hours.`,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send verification email to ${user.email}: ${(error as Error).message}`,
      );
    }
  }

  /** Consume a verification token and mark the owner's email verified.
   *  Returns the updated user. */
  async verify(rawToken: string): Promise<AuthUser> {
    const tokenHash = this.hash(rawToken);
    const record = await this.prisma.emailVerificationToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { profile: true } } },
    });

    const invalid = new BadRequestException('Invalid or expired verification token.');
    if (!record || record.consumedAt || record.expiresAt.getTime() <= Date.now()) {
      throw invalid;
    }

    // Atomically consume the token and flip the flag.
    const [, user] = await this.prisma.$transaction([
      this.prisma.emailVerificationToken.update({
        where: { id: record.id },
        data: { consumedAt: new Date() },
      }),
      this.prisma.user.update({
        where: { id: record.userId },
        data: { emailVerified: true },
        include: { profile: true },
      }),
    ]);

    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: user.profile?.displayName ?? undefined,
    };
  }

  /** Re-issue a verification email for a still-unverified user. */
  async resend(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      // Should not happen for an authenticated caller, but fail closed.
      throw new BadRequestException('Account not found.');
    }
    if (user.emailVerified) {
      throw new ConflictException('Email is already verified.');
    }
    // Invalidate any outstanding tokens so only the newest link works.
    await this.prisma.emailVerificationToken.updateMany({
      where: { userId, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    await this.issueAndSend(user);
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async createToken(userId: string): Promise<string> {
    const rawToken = randomBytes(32).toString('base64url');
    const ttl = this.config.getOrThrow<number>('auth.emailVerificationTtl');
    await this.prisma.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: this.hash(rawToken),
        expiresAt: new Date(Date.now() + ttl * 1000),
      },
    });
    return rawToken;
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private ttlHours(): number {
    return Math.round(this.config.getOrThrow<number>('auth.emailVerificationTtl') / 3600);
  }
}
