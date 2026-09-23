import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Optional,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../auth/auth.types';
import { AdminIdentityService } from './admin-identity.service';
import type { AdminIdentity } from './admin-rbac';

/**
 * Persistent admin identity gate. Runs after JwtAccessGuard, requires MFA and
 * delegates role resolution (including the controlled one-time legacy bridge)
 * to AdminIdentityService.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly identities: AdminIdentityService,
    @Optional() private readonly config?: ConfigService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser; adminIdentity?: AdminIdentity }>();
    const auth = req.user;
    if (!auth) throw new ForbiddenException('Admins only.');

    // Resolve can bootstrap a persistent legacy grant, so only perform a
    // read-only eligibility check before MFA. A normal learner still receives
    // a plain admin 403 rather than an MFA eligibility signal.
    const identities = this.identities as AdminIdentityService & { isEligible?: (userId: string) => Promise<boolean> };
    if (typeof identities.isEligible === 'function' && !await identities.isEligible(auth.userId)) {
      throw new ForbiddenException({ code: 'ADMIN_FORBIDDEN' });
    }
    if (!auth.mfaVerifiedAt) {
      throw new ForbiddenException({ code: 'ADMIN_MFA_REQUIRED' });
    }
    const maxTtl = (this.config?.get<number>('admin.sessionMaxTtl', 28_800) ?? 28_800) * 1000;
    if (Date.now() - auth.mfaVerifiedAt.getTime() > maxTtl) {
      throw new ForbiddenException({ code: 'ADMIN_SESSION_EXPIRED' });
    }
    req.adminIdentity = await this.identities.resolve(auth.userId);
    return true;
  }
}
