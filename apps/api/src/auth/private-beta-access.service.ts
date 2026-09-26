import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { containsSensitiveAdministrativeText, type AuditContext } from '../admin/admin-audit.service';

/**
 * A private-beta grant is a narrow feature entitlement, never a plan, quota or
 * role. Keeping it in the existing override ledger gives it expiry, revocation
 * and durable audit history without a schema migration.
 */
export const PRIVATE_BETA_ACCESS_KEY = 'private_beta_access';

export interface PrivateBetaGrantInput {
  expiresAt: string;
  reason: string;
}

@Injectable()
export class PrivateBetaAccessService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  /** The gate remains backward-compatible until an environment opts in. */
  isEnforced(): boolean {
    return this.config.get<boolean>('privateBeta.enforced') === true;
  }

  /**
   * Registration is the one controlled pre-authentication exception.  The
   * private environment allowlist only lets a person create a pending account;
   * it does not turn into access until email verification and a ledger grant.
   */
  assertRegistrationAllowed(email: string): void {
    if (!this.isEnforced()) return;
    const registrationEmails = this.config.get<string[]>('privateBeta.registrationEmails') ?? [];
    if (!registrationEmails.includes(email)) {
      // Do not distinguish a denied address from an existing account or any
      // other account state at this public endpoint.
      throw new ForbiddenException({
        code: 'PRIVATE_BETA_REGISTRATION_CLOSED',
        message: 'Registration is not available.',
      });
    }
  }

  /** Reject normal session use unless the email is verified and an active
   * private-beta entitlement exists. The pending verification endpoints are
   * explicitly marked and bypass this method in JwtAccessGuard only. */
  async assertNormalAccess(userId: string, emailVerified: boolean): Promise<void> {
    if (!this.isEnforced()) return;
    if (!emailVerified || !(await this.hasActiveAccess(userId))) {
      throw new UnauthorizedException({
        code: 'PRIVATE_BETA_ACCESS_REQUIRED',
        message: 'Access is not available.',
      });
    }
  }

  async hasActiveAccess(userId: string, at = new Date()): Promise<boolean> {
    if (!this.isEnforced()) return true;
    const grant = await this.prisma.entitlementOverride.findFirst({
      where: {
        userId,
        kind: 'feature',
        key: PRIVATE_BETA_ACCESS_KEY,
        value: { equals: true },
        revokedAt: null,
        startsAt: { lte: at },
        OR: [{ endsAt: null }, { endsAt: { gt: at } }],
      },
      select: { id: true },
    });
    return Boolean(grant);
  }

  /** Grant a single expiring beta entitlement. A later grant closes any active
   * predecessor, so revocation has unambiguous session-blocking semantics. */
  async grant(
    userId: string,
    input: PrivateBetaGrantInput,
    context: AuditContext,
  ): Promise<{ id: string; startsAt: string; expiresAt: string }> {
    this.assertSafeReason(input.reason);
    const expiresAt = this.requireFutureExpiry(input.expiresAt);
    const now = new Date();

    const row = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) throw new NotFoundException({ code: 'USER_NOT_FOUND' });

      // Preserve historical grants but make the newly issued one authoritative.
      await tx.entitlementOverride.updateMany({
        where: {
          userId,
          kind: 'feature',
          key: PRIVATE_BETA_ACCESS_KEY,
          revokedAt: null,
          startsAt: { lte: now },
          OR: [{ endsAt: null }, { endsAt: { gt: now } }],
        },
        data: { endsAt: now },
      });
      const grant = await tx.entitlementOverride.create({
        data: {
          userId,
          kind: 'feature',
          key: PRIVATE_BETA_ACCESS_KEY,
          value: true,
          reason: input.reason.trim(),
          grantedById: context.actorId ?? 'system',
          startsAt: now,
          endsAt: expiresAt,
        },
      });
      await tx.auditLog.create({
        data: this.auditData(context, {
          action: 'private_beta_access.grant',
          targetType: 'EntitlementOverride',
          targetId: grant.id,
          reason: input.reason.trim(),
          after: {
            userId,
            startsAt: grant.startsAt.toISOString(),
            expiresAt: expiresAt.toISOString(),
          },
        }),
      });
      await tx.securityEvent.create({
        data: this.securityData(
          context,
          'PRIVATE_BETA_ACCESS_GRANTED',
          userId,
          { overrideId: grant.id, expiresAt: expiresAt.toISOString() },
          'high',
        ),
      });
      return grant;
    });
    return {
      id: row.id,
      startsAt: row.startsAt.toISOString(),
      expiresAt: row.endsAt!.toISOString(),
    };
  }

  /** Revoke one active beta grant and every live session for that user in the
   * same transaction. Existing JWTs therefore fail at their next API request. */
  async revoke(
    userId: string,
    grantId: string,
    reason: string,
    context: AuditContext,
  ): Promise<{ revoked: boolean; sessionsRevoked: number }> {
    this.assertSafeReason(reason);
    const now = new Date();
    return this.prisma.$transaction(async (tx) => {
      const grant = await tx.entitlementOverride.findFirst({
        where: {
          id: grantId,
          userId,
          kind: 'feature',
          key: PRIVATE_BETA_ACCESS_KEY,
          revokedAt: null,
        },
        select: { id: true },
      });
      if (!grant) throw new NotFoundException({ code: 'PRIVATE_BETA_GRANT_NOT_FOUND' });

      const [revoked, sessions] = await Promise.all([
        tx.entitlementOverride.updateMany({
          where: { id: grant.id, revokedAt: null },
          data: { revokedAt: now, revokedById: context.actorId ?? null },
        }),
        tx.session.updateMany({
          where: { userId, revokedAt: null },
          data: { revokedAt: now },
        }),
      ]);
      await tx.auditLog.create({
        data: this.auditData(context, {
          action: 'private_beta_access.revoke',
          targetType: 'EntitlementOverride',
          targetId: grant.id,
          reason: reason.trim(),
          after: { userId, sessionsRevoked: sessions.count },
        }),
      });
      await tx.securityEvent.create({
        data: this.securityData(
          context,
          'PRIVATE_BETA_ACCESS_REVOKED',
          userId,
          { overrideId: grant.id, sessionsRevoked: sessions.count },
          'high',
        ),
      });
      return { revoked: revoked.count === 1, sessionsRevoked: sessions.count };
    });
  }

  private requireFutureExpiry(rawExpiry: string): Date {
    const expiresAt = new Date(rawExpiry);
    if (!Number.isFinite(expiresAt.getTime()) || expiresAt <= new Date()) {
      throw new BadRequestException({
        code: 'PRIVATE_BETA_EXPIRY_INVALID',
        message: 'Private beta expiry must be in the future.',
      });
    }
    return expiresAt;
  }

  private assertSafeReason(reason: string): void {
    if (!reason.trim() || containsSensitiveAdministrativeText(reason)) {
      throw new BadRequestException({
        code: 'ADMINISTRATIVE_REASON_INVALID',
        message: 'Administrative reason is invalid.',
      });
    }
  }

  private auditData(
    context: AuditContext,
    event: { action: string; targetType: string; targetId: string; reason: string; after: Record<string, unknown> },
  ): Prisma.AuditLogCreateArgs['data'] {
    return {
      actorId: context.actorId ?? null,
      actorRole: context.actorRole ?? null,
      action: event.action,
      targetType: event.targetType,
      targetId: event.targetId,
      reason: event.reason,
      after: event.after as Prisma.InputJsonValue,
      requestId: context.requestId ?? null,
      sessionId: context.sessionId ?? null,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
    };
  }

  private securityData(
    context: AuditContext,
    type: string,
    userId: string,
    metadata: Record<string, unknown>,
    severity: 'high',
  ): Prisma.SecurityEventCreateArgs['data'] {
    return {
      actorId: context.actorId ?? null,
      userId,
      type,
      severity,
      requestId: context.requestId ?? null,
      sessionId: context.sessionId ?? null,
      ip: context.ip ?? null,
      userAgent: context.userAgent ?? null,
      metadata: metadata as Prisma.InputJsonValue,
    };
  }
}
