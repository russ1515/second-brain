import { Injectable, type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { PrivateBetaAccessService } from '../private-beta-access.service';
import { ALLOW_PENDING_VERIFICATION_KEY } from '../decorators/allow-pending-verification.decorator';
import type { AuthenticatedUser, HttpRequestLike } from '../auth.types';

/** Route guard for endpoints that require a valid access token. */
@Injectable()
export class JwtAccessGuard extends AuthGuard('jwt-access') {
  constructor(
    private readonly reflector: Reflector,
    private readonly privateBeta: PrivateBetaAccessService,
  ) {
    super();
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await super.canActivate(context);
    if (!authenticated) return false;

    const pendingVerificationAllowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    ) === true;
    if (pendingVerificationAllowed) return true;

    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) throw new UnauthorizedException();
    await this.privateBeta.assertNormalAccess(user.userId, user.emailVerified);
    return true;
  }
}
