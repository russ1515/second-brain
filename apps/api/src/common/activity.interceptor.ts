import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Observable } from 'rxjs';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';

/**
 * Analytics activity signal (Sprint 8.6). Stamps `User.lastActiveAt` on each
 * authenticated request so DAU/WAU/MAU can be computed. Writes are THROTTLED to
 * at most once per user per window (in-memory), so this is one cheap upsert every
 * few minutes per active user — not a write per request. Best-effort: a failed
 * stamp never breaks the request.
 */
@Injectable()
export class ActivityInterceptor implements NestInterceptor {
  private readonly lastWrite = new Map<string, number>();
  private static readonly WINDOW_MS = 5 * 60 * 1000; // 5 minutes

  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const userId = req.user?.userId;
    if (userId) {
      const now = Date.now();
      const last = this.lastWrite.get(userId) ?? 0;
      if (now - last > ActivityInterceptor.WINDOW_MS) {
        this.lastWrite.set(userId, now);
        this.prisma.user
          .update({ where: { id: userId }, data: { lastActiveAt: new Date() } })
          .catch(() => {
            // Best-effort: don't let analytics stamping affect the request.
          });
      }
    }
    return next.handle();
  }
}
