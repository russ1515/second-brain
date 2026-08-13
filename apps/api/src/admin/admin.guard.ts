import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import type { AuthenticatedUser } from '../auth/auth.types';

/**
 * Platform superadmin gate (Sprint 8.5). Runs AFTER JwtAccessGuard. A user is an
 * admin if their `isAdmin` flag is set OR their email is listed in ADMIN_EMAILS
 * (the bootstrap path, so the very first admin can exist without another admin).
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<{ user?: AuthenticatedUser }>();
    const auth = req.user;
    if (!auth) throw new ForbiddenException('Admins only.');

    const bootstrap = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);

    const user = await this.prisma.user.findUnique({
      where: { id: auth.userId },
      select: { isAdmin: true, email: true },
    });
    const ok =
      !!user &&
      (user.isAdmin || bootstrap.includes(user.email.toLowerCase()));
    if (!ok) throw new ForbiddenException('Admins only.');
    return true;
  }
}
