import { createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { AuthenticatedUser, HttpRequestLike } from '../auth.types';

/** Injects `req.user` (populated by JwtAccessGuard) into a handler parameter. */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedUser => {
    const request = ctx.switchToHttp().getRequest<HttpRequestLike>();
    return request.user as AuthenticatedUser;
  },
);
