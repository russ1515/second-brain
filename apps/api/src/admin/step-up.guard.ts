import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedUser } from '../auth/auth.types';

@Injectable()
export class AdminStepUpGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const at = req.user?.mfaVerifiedAt?.getTime() ?? 0;
    const ttl = this.config.get<number>('admin.stepUpTtl', 600) * 1000;
    if (!at || Date.now() - at > ttl) {
      throw new ForbiddenException({ code: 'ADMIN_STEP_UP_REQUIRED', endpoint: '/api/auth/2fa/step-up' });
    }
    return true;
  }
}
