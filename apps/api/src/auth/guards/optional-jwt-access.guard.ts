import { ExecutionContext, Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Lets a public telemetry endpoint attribute a *valid* access token while
 * retaining anonymous error reporting. Invalid or expired credentials do not
 * gain access to anything and are treated as anonymous telemetry only.
 */
@Injectable()
export class OptionalJwtAccessGuard extends AuthGuard('jwt-access') {
  override handleRequest<TUser = unknown>(_error: unknown, user: TUser | false | null, _info: unknown, _context: ExecutionContext): TUser | undefined {
    return user || undefined;
  }
}
