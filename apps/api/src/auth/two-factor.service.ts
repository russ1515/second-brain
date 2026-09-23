import { randomBytes } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import type { User } from '@prisma/client';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import type {
  AuthResponse,
  TwoFactorEnableResponse,
  TwoFactorSetupResponse,
} from '@second-brain/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ARGON2_OPTIONS } from './argon2.options';
import { AuthService } from './auth.service';
import { SecretCipher } from './secret-cipher';
import type { SessionContext } from './auth.types';

const ISSUER = 'Second Brain';
const RECOVERY_CODE_COUNT = 10;

/** TOTP two-factor auth: enrollment, enable/disable, and login step-up.
 *  Secrets are encrypted at rest; recovery codes are stored only as Argon2
 *  hashes and are single-use. */
@Injectable()
export class TwoFactorService {
  // Accept the adjacent time steps (±30s) to tolerate clock skew.
  private readonly totp = authenticator.clone({ window: 1 });

  constructor(
    private readonly prisma: PrismaService,
    private readonly cipher: SecretCipher,
    private readonly auth: AuthService,
  ) {}

  /** Generate a pending secret and the otpauth URI to enroll an authenticator app.
   *  2FA is not active until confirmed via {@link enable}. */
  async setup(userId: string): Promise<TwoFactorSetupResponse> {
    const user = await this.requireUser(userId);
    if (user.twoFactorEnabled) {
      throw new ConflictException('Two-factor auth is already enabled.');
    }
    const secret = this.totp.generateSecret();
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: this.cipher.encrypt(secret), twoFactorEnabled: false },
    });
    return {
      otpauthUrl: this.totp.keyuri(user.email, ISSUER, secret),
      secret,
    };
  }

  /** Confirm a TOTP code against the pending secret, enable 2FA, and return
   *  freshly generated single-use recovery codes (shown only this once). */
  async enable(userId: string, code: string): Promise<TwoFactorEnableResponse> {
    const user = await this.requireUser(userId);
    if (user.twoFactorEnabled) {
      throw new ConflictException('Two-factor auth is already enabled.');
    }
    if (!user.twoFactorSecret) {
      throw new BadRequestException('Call /auth/2fa/setup before enabling.');
    }
    const secret = this.cipher.decrypt(user.twoFactorSecret);
    if (!this.totp.verify({ token: code.trim(), secret })) {
      throw new UnauthorizedException('Invalid authentication code.');
    }

    const { plaintext, hashes } = await this.generateRecoveryCodes();
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: true },
      }),
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
      this.prisma.recoveryCode.createMany({
        data: hashes.map((codeHash) => ({ userId, codeHash })),
      }),
    ]);
    return { recoveryCodes: plaintext };
  }

  /** Turn 2FA off after confirming a current TOTP or recovery code. */
  async disable(userId: string, code: string): Promise<void> {
    const user = await this.requireUser(userId);
    const adminRoles = await this.prisma.adminRoleAssignment.count({ where: { userId, revokedAt: null } });
    if (user.isAdmin || adminRoles > 0) {
      throw new ConflictException({ code: 'ADMIN_MFA_REQUIRED', message: 'Administrators cannot disable MFA.' });
    }
    if (!user.twoFactorEnabled) {
      throw new BadRequestException('Two-factor auth is not enabled.');
    }
    if (!(await this.verifyCode(user, code))) {
      throw new UnauthorizedException('Invalid authentication code.');
    }
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: { twoFactorEnabled: false, twoFactorSecret: null },
      }),
      this.prisma.recoveryCode.deleteMany({ where: { userId } }),
    ]);
  }

  /** Complete a login: validate the challenge token + second factor, issue tokens. */
  async verifyLogin(
    challengeToken: string,
    code: string,
    ctx: SessionContext = {},
  ): Promise<AuthResponse> {
    const userId = await this.auth.verifyChallengeToken(challengeToken);
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { profile: true },
    });
    if (!user || !user.twoFactorEnabled) {
      throw new UnauthorizedException('Two-factor auth is not available.');
    }
    this.auth.assertAccountActive(user);
    if (!(await this.verifyCode(user, code))) {
      await this.auth.recordAdminAuthEvent(user.id, 'ADMIN_LOGIN_FAILED_MFA', ctx, 'failed');
      throw new UnauthorizedException('Invalid authentication code.');
    }
    await this.auth.recordAdminAuthEvent(user.id, 'ADMIN_LOGIN_SUCCESS', ctx);
    return this.auth.issueLoginResponse(
      user,
      user.profile?.displayName ?? null,
      ctx,
      true,
    );
  }

  /** Refresh the session's MFA timestamp for critical admin actions. */
  async stepUp(userId: string, sessionId: string, code: string): Promise<{ mfaVerifiedAt: string }> {
    const user = await this.requireUser(userId);
    this.auth.assertAccountActive(user);
    if (!user.twoFactorEnabled || !(await this.verifyCode(user, code))) {
      // The bearer session is still valid: only the proof for this privileged
      // operation failed.  A typed 403 lets clients keep that session and
      // offer another code instead of treating a mistyped TOTP as logout.
      throw new ForbiddenException({ code: 'MFA_CODE_INVALID', message: 'Invalid authentication code.' });
    }
    const at = new Date();
    const updated = await this.prisma.session.updateMany({
      where: { id: sessionId, userId, revokedAt: null, expiresAt: { gt: at } },
      data: { mfaVerifiedAt: at },
    });
    if (updated.count !== 1) throw new UnauthorizedException('Session is no longer active.');
    return { mfaVerifiedAt: at.toISOString() };
  }

  // ── internals ──────────────────────────────────────────────────────────

  private async requireUser(userId: string): Promise<User> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new BadRequestException('Account not found.');
    }
    return user;
  }

  /** Accept a valid TOTP code, or fall back to consuming a recovery code. */
  private async verifyCode(user: User, code: string): Promise<boolean> {
    if (user.twoFactorSecret) {
      const secret = this.cipher.decrypt(user.twoFactorSecret);
      if (this.totp.verify({ token: code.trim(), secret })) {
        return true;
      }
    }
    return this.consumeRecoveryCode(user.id, code);
  }

  private async consumeRecoveryCode(
    userId: string,
    code: string,
  ): Promise<boolean> {
    const normalized = this.normalizeRecoveryCode(code);
    if (!normalized) {
      return false;
    }
    // Codes are salted-hashed, so we must check each unused one in turn.
    const candidates = await this.prisma.recoveryCode.findMany({
      where: { userId, usedAt: null },
    });
    for (const candidate of candidates) {
      if (await argon2.verify(candidate.codeHash, normalized)) {
        await this.prisma.recoveryCode.update({
          where: { id: candidate.id },
          data: { usedAt: new Date() },
        });
        return true;
      }
    }
    return false;
  }

  private async generateRecoveryCodes(): Promise<{
    plaintext: string[];
    hashes: string[];
  }> {
    const plaintext: string[] = [];
    const hashes: string[] = [];
    for (let i = 0; i < RECOVERY_CODE_COUNT; i++) {
      const raw = randomBytes(5).toString('hex'); // 10 hex chars, 40 bits
      plaintext.push(`${raw.slice(0, 5)}-${raw.slice(5)}`);
      hashes.push(await argon2.hash(raw, ARGON2_OPTIONS));
    }
    return { plaintext, hashes };
  }

  private normalizeRecoveryCode(code: string): string {
    return code.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  }
}
