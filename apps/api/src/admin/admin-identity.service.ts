import { ForbiddenException, Injectable } from '@nestjs/common';
import type { AdminRole } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ROLE_CAPABILITIES, type AdminCapability, type AdminIdentity } from './admin-rbac';

@Injectable()
export class AdminIdentityService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Read-only eligibility check used before an MFA challenge. Resolving an
   * identity can perform the one-time legacy bridge below, so it must never be
   * called merely because a session reached an admin route without an MFA
   * proof.
   */
  async isEligible(userId: string): Promise<boolean> {
    const user = await this.load(userId);
    return Boolean(user && (
      user.adminRoleAssignments.length > 0 ||
      (!user.adminBootstrappedAt && this.isBootstrap(user))
    ));
  }

  async resolve(userId: string): Promise<AdminIdentity> {
    let user = await this.load(userId);
    if (!user) throw new ForbiddenException({ code: 'ADMIN_FORBIDDEN' });

    // One-way controlled bootstrap: a legacy isAdmin flag or allowlisted email
    // may create the first persistent SUPER_ADMIN grant exactly once per user.
    if (!user.adminBootstrappedAt && user.adminRoleAssignments.length === 0 && this.isBootstrap(user)) {
      await this.prisma.$transaction([
        this.prisma.adminRoleAssignment.upsert({
          where: { userId_role: { userId, role: 'SUPER_ADMIN' } },
          create: { userId, role: 'SUPER_ADMIN', reason: 'Controlled legacy bootstrap' },
          update: { revokedAt: null },
        }),
        this.prisma.user.update({ where: { id: userId }, data: { adminBootstrappedAt: new Date() } }),
        this.prisma.auditLog.create({
          data: { actorId: userId, actorRole: 'BOOTSTRAP', action: 'admin.role.bootstrap', targetType: 'User', targetId: userId, reason: 'Legacy bootstrap migration' },
        }),
      ]);
      user = await this.load(userId);
    }

    const roles = (user?.adminRoleAssignments ?? []).map((entry) => entry.role);
    if (!user || roles.length === 0) throw new ForbiddenException({ code: 'ADMIN_FORBIDDEN' });
    const capabilities = [...new Set(roles.flatMap((role) => ROLE_CAPABILITIES[role]))] as AdminCapability[];
    return { userId, email: user.email, roles, capabilities };
  }

  private load(userId: string) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        email: true, isAdmin: true, adminBootstrappedAt: true,
        adminRoleAssignments: { where: { revokedAt: null }, select: { role: true } },
      },
    });
  }

  private isBootstrap(user: { email: string; isAdmin: boolean }): boolean {
    const enabled = (process.env.ADMIN_BOOTSTRAP_ENABLED ?? 'false') === 'true';
    if (!enabled) return false;
    const emails = (process.env.ADMIN_EMAILS ?? '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean);
    return user.isAdmin || emails.includes(user.email.toLowerCase());
  }
}
