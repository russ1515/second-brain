import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma, type User } from '@prisma/client';
import * as argon2 from 'argon2';
import type {
  AuthResponse,
  AuthTokens,
  AuthUser,
  TwoFactorChallenge,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ARGON2_OPTIONS } from './argon2.options';
import { EmailVerificationService } from './email-verification.service';
import { EmailOtpService } from './email-otp.service';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import {
  ACCESS_PURPOSE,
  TWO_FACTOR_PURPOSE,
  type JwtAccessPayload,
  type SessionContext,
  type TwoFactorChallengePayload,
} from './auth.types';

/** Identity claims needed to sign an access token. */
type AccessSubject = Pick<User, 'id' | 'email'>;

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly emailVerification: EmailVerificationService,
    private readonly emailOtp: EmailOtpService,
  ) {}

  /** Create a new user (+ profile) and issue an initial token pair. */
  async register(dto: RegisterDto, ctx: SessionContext = {}): Promise<AuthResponse> {
    const email = this.normalizeEmail(dto.email);
    const passwordHash = await argon2.hash(dto.password, ARGON2_OPTIONS);

    let user: User;
    try {
      user = await this.prisma.user.create({
        data: {
          email,
          passwordHash,
          profile: {
            create: { displayName: dto.displayName ?? null },
          },
        },
      });
    } catch (error) {
      // Unique violation on email → surface a clean conflict instead of a 500.
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('An account with this email already exists.');
      }
      throw error;
    }

    // Kick off email verification via a 6-digit OTP (best-effort; never blocks
    // registration). The link-based flow (`/verify-email`) stays available.
    await this.emailOtp.issue(user, 'email_verify');

    const tokens = await this.issueTokens(user, ctx);
    return { user: this.toAuthUser(user, dto.displayName ?? null), tokens };
  }

  /** Confirm a signed-in user's email with the 6-digit OTP that was mailed on
   *  registration (or resend). Flips `emailVerified` and returns the fresh user. */
  async verifyEmailOtp(userId: string, code: string): Promise<AuthUser> {
    await this.emailOtp.verify(userId, code, 'email_verify');
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: { emailVerified: true },
      include: { profile: true },
    });
    return this.toAuthUser(user, user.profile?.displayName ?? null);
  }

  /** Re-issue an email-verification OTP for a signed-in, still-unverified user. */
  async resendEmailOtp(userId: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new BadRequestException('Account not found.');
    if (user.emailVerified) throw new ConflictException('Email is already verified.');
    await this.emailOtp.issue(user, 'email_verify');
  }

  /** Start a password reset: email a reset OTP to the address IF an account
   *  exists. Always resolves without revealing whether the email is registered
   *  (no account-enumeration oracle). */
  async requestPasswordReset(rawEmail: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (user) await this.emailOtp.issue(user, 'password_reset');
  }

  /** Complete a password reset: verify the OTP, set the new password, and revoke
   *  every existing session so a compromised session cannot survive the reset. */
  async resetPassword(rawEmail: string, code: string, newPassword: string): Promise<void> {
    const email = this.normalizeEmail(rawEmail);
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Verify against the user when present; otherwise still fail as a bad code
    // so the caller cannot tell a missing account from a wrong code.
    if (!user) throw new BadRequestException('Invalid or expired code.');
    await this.emailOtp.verify(user.id, code, 'password_reset');
    const passwordHash = await argon2.hash(newPassword, ARGON2_OPTIONS);
    await this.prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    await this.revokeAllSessions(user.id);
  }

  /** Verify credentials. Returns a full token pair, or — when the account has
   *  2FA enabled — a short-lived challenge to be completed via 2FA verify. */
  async login(
    dto: LoginDto,
    ctx: SessionContext = {},
  ): Promise<AuthResponse | TwoFactorChallenge> {
    const email = this.normalizeEmail(dto.email);
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { profile: true },
    });

    // Generic failure — never reveal whether the email exists.
    const invalid = new UnauthorizedException('Invalid email or password.');
    if (!user) {
      // Hash a throwaway value so timing does not leak account existence.
      await argon2.hash(dto.password, ARGON2_OPTIONS).catch(() => undefined);
      throw invalid;
    }

    const passwordOk = await argon2.verify(user.passwordHash, dto.password);
    if (!passwordOk) {
      throw invalid;
    }

    // Password OK. If 2FA is on, stop here and hand back a challenge.
    if (user.twoFactorEnabled) {
      return { twoFactorRequired: true, challengeToken: await this.signChallengeToken(user) };
    }

    return this.issueLoginResponse(user, user.profile?.displayName ?? null, ctx);
  }

  /** Build the full authenticated response (user + fresh tokens). Public so the
   *  2FA-verify flow can complete a login once the second factor is confirmed. */
  async issueLoginResponse(
    user: User,
    displayName: string | null,
    ctx: SessionContext = {},
  ): Promise<AuthResponse> {
    const tokens = await this.issueTokens(user, ctx);
    return { user: this.toAuthUser(user, displayName), tokens };
  }

  /** Sign the short-lived, single-purpose token that carries a login through the
   *  2FA step. Signed with the access secret but marked `two_factor`, so it is
   *  rejected by the access-token guard. */
  async signChallengeToken(user: AccessSubject): Promise<string> {
    const payload: TwoFactorChallengePayload = {
      sub: user.id,
      purpose: TWO_FACTOR_PURPOSE,
    };
    return this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('auth.accessSecret'),
      expiresIn: this.config.getOrThrow<number>('auth.twoFactorChallengeTtl'),
    });
  }

  /** Verify a 2FA challenge token and return the subject id. Throws if invalid. */
  async verifyChallengeToken(token: string): Promise<string> {
    try {
      const payload = await this.jwt.verifyAsync<TwoFactorChallengePayload>(token, {
        secret: this.config.getOrThrow<string>('auth.accessSecret'),
      });
      if (payload.purpose !== TWO_FACTOR_PURPOSE) {
        throw new Error('wrong purpose');
      }
      return payload.sub;
    } catch {
      throw new UnauthorizedException('Invalid or expired 2FA challenge.');
    }
  }

  /** Resolve the current user for a validated access token. */
  async me(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user) {
      // Token was valid but the account is gone.
      throw new UnauthorizedException('Account no longer exists.');
    }
    return this.toAuthUser(user, user.profile?.displayName ?? null);
  }

  /** Set the learner's Learning Locale (single source of truth for UI + all
   *  AI-generated content). Upserts the profile so it works before onboarding. */
  async setLocale(userId: string, locale: string): Promise<AuthUser> {
    await this.prisma.profile.upsert({
      where: { userId },
      create: { userId, preferredLanguage: locale },
      update: { preferredLanguage: locale },
    });
    return this.me(userId);
  }

  /** Exchange a refresh token for a rotated token pair.
   *  Implements refresh-token rotation with reuse detection (OAuth RTR): the
   *  presented token's session is revoked and a fresh one is issued. If a token
   *  belonging to an *already-revoked* session is presented, it is treated as a
   *  leak/replay and every session for that user is revoked. */
  async refresh(refreshToken: string, ctx: SessionContext = {}): Promise<AuthTokens> {
    const invalid = new UnauthorizedException('Invalid or expired refresh token.');

    const parsed = this.parseRefreshToken(refreshToken);
    if (!parsed) {
      throw invalid;
    }

    const session = await this.prisma.session.findUnique({
      where: { id: parsed.sessionId },
      include: { user: true },
    });
    if (!session) {
      throw invalid;
    }

    // Verify the secret against the stored hash before trusting the token at all.
    const secretOk = await argon2.verify(session.refreshTokenHash, parsed.secret);
    if (!secretOk) {
      throw invalid;
    }

    // A valid secret for a revoked session means the token was already rotated
    // or logged out — i.e. replayed. Revoke the whole family defensively.
    if (session.revokedAt) {
      await this.revokeAllSessions(session.userId);
      throw new UnauthorizedException(
        'Refresh token reuse detected — all sessions have been revoked.',
      );
    }

    if (session.expiresAt.getTime() <= Date.now()) {
      throw invalid;
    }

    return this.rotate(session.id, session.user, ctx);
  }

  /** Revoke the single session tied to a refresh token. Idempotent and silent —
   *  a malformed/unknown/already-revoked token is a no-op so logout never leaks
   *  whether a token was valid. */
  async logout(refreshToken: string): Promise<void> {
    const parsed = this.parseRefreshToken(refreshToken);
    if (!parsed) {
      return;
    }
    const session = await this.prisma.session.findUnique({
      where: { id: parsed.sessionId },
    });
    if (!session || session.revokedAt) {
      return;
    }
    const secretOk = await argon2.verify(session.refreshTokenHash, parsed.secret);
    if (!secretOk) {
      return;
    }
    await this.prisma.session.update({
      where: { id: session.id },
      data: { revokedAt: new Date() },
    });
  }

  /** Revoke every active session for a user (logout on all devices). */
  async logoutAll(userId: string): Promise<void> {
    await this.revokeAllSessions(userId);
  }

  // ── internals ──────────────────────────────────────────────────────────

  /** Split `${sessionId}.${secret}`. Neither part contains a '.', so the first
   *  dot is the separator. */
  private parseRefreshToken(
    token: string,
  ): { sessionId: string; secret: string } | null {
    const dot = token.indexOf('.');
    if (dot <= 0 || dot === token.length - 1) {
      return null;
    }
    return { sessionId: token.slice(0, dot), secret: token.slice(dot + 1) };
  }

  private async revokeAllSessions(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /** Atomically revoke the old session and mint a new one, returning fresh tokens. */
  private async rotate(
    oldSessionId: string,
    user: AccessSubject,
    ctx: SessionContext,
  ): Promise<AuthTokens> {
    const refreshTtl = this.config.getOrThrow<number>('auth.refreshTtl');
    const { secret, hash } = await this.mintRefreshSecret();

    const [, newSession] = await this.prisma.$transaction([
      this.prisma.session.update({
        where: { id: oldSessionId },
        data: { revokedAt: new Date() },
      }),
      this.prisma.session.create({
        data: {
          userId: user.id,
          refreshTokenHash: hash,
          expiresAt: new Date(Date.now() + refreshTtl * 1000),
          userAgent: ctx.userAgent ?? null,
          ipAddress: ctx.ipAddress ?? null,
        },
      }),
    ]);

    const { token, expiresIn } = await this.signAccessToken(user);
    return {
      accessToken: token,
      refreshToken: `${newSession.id}.${secret}`,
      tokenType: 'Bearer',
      expiresIn,
    };
  }

  private normalizeEmail(email: string): string {
    return email.trim().toLowerCase();
  }

  /** Mint an access JWT plus an opaque, DB-backed refresh token for a brand-new
   *  session (register/login). The refresh token is `${sessionId}.${secret}`;
   *  only an Argon2 hash of the secret is stored, so a database leak cannot be
   *  replayed and the session id lets us locate the row for rotation/revocation. */
  private async issueTokens(user: User, ctx: SessionContext): Promise<AuthTokens> {
    const refreshTtl = this.config.getOrThrow<number>('auth.refreshTtl');
    const { secret, hash } = await this.mintRefreshSecret();

    const session = await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshTokenHash: hash,
        expiresAt: new Date(Date.now() + refreshTtl * 1000),
        userAgent: ctx.userAgent ?? null,
        ipAddress: ctx.ipAddress ?? null,
      },
    });

    const { token, expiresIn } = await this.signAccessToken(user);
    return {
      accessToken: token,
      refreshToken: `${session.id}.${secret}`,
      tokenType: 'Bearer',
      expiresIn,
    };
  }

  /** Sign a short-lived access token for the given subject. */
  private async signAccessToken(
    user: AccessSubject,
  ): Promise<{ token: string; expiresIn: number }> {
    const accessTtl = this.config.getOrThrow<number>('auth.accessTtl');
    const payload: JwtAccessPayload = {
      sub: user.id,
      email: user.email,
      purpose: ACCESS_PURPOSE,
    };
    const token = await this.jwt.signAsync(payload, {
      secret: this.config.getOrThrow<string>('auth.accessSecret'),
      expiresIn: accessTtl,
    });
    return { token, expiresIn: accessTtl };
  }

  /** Generate a fresh refresh-token secret and its Argon2 hash for storage. */
  private async mintRefreshSecret(): Promise<{ secret: string; hash: string }> {
    const secret = randomBytes(32).toString('base64url');
    const hash = await argon2.hash(secret, ARGON2_OPTIONS);
    return { secret, hash };
  }

  private toAuthUser(user: User, displayName: string | null): AuthUser {
    return {
      id: user.id,
      email: user.email,
      emailVerified: user.emailVerified,
      displayName: displayName ?? undefined,
    };
  }
}
