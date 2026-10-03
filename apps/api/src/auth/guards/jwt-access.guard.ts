import {
  ForbiddenException,
  Injectable,
  type ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
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

  override handleRequest<TUser = AuthenticatedUser>(
    error: unknown,
    user: TUser | false | null,
    info: unknown,
    _context: ExecutionContext,
  ): TUser {
    // Preserve the precise account/session error emitted by the strategy.
    if (error) throw error;
    if (
      info &&
      typeof info === 'object' &&
      'name' in info &&
      (info as { name?: unknown }).name === 'TokenExpiredError'
    ) {
      throw new UnauthorizedException({
        code: 'SESSION_EXPIRED',
        message: 'Session expired.',
      });
    }
    if (!user) {
      throw new UnauthorizedException({
        code: 'SESSION_INVALID',
        message: 'Session is no longer valid.',
      });
    }
    return user;
  }

  override async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await super.canActivate(context);
    if (!authenticated) return false;

    const pendingVerificationAllowed = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_VERIFICATION_KEY,
      [context.getHandler(), context.getClass()],
    ) === true;
    const request = context.switchToHttp().getRequest<HttpRequestLike>();
    const user = request.user as AuthenticatedUser | undefined;
    if (!user) throw new UnauthorizedException();
    if (pendingVerificationAllowed && !user.emailVerified) return true;
    if (!user.emailVerified) {
      throw new ForbiddenException({
        code: 'EMAIL_VERIFICATION_REQUIRED',
        message: 'Access is not available.',
      });
    }
    await this.privateBeta.assertNormalAccess(user.userId, user.emailVerified);
    return true;
  }
}
