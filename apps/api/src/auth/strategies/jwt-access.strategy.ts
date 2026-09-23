import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  ACCESS_PURPOSE,
  type AuthenticatedUser,
  type JwtAccessPayload,
} from '../auth.types';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../../common/request-context.service';

/** Validates the `Authorization: Bearer <accessToken>` header.
 *  Passport verifies the signature/expiry before `validate` runs; we only map
 *  the trusted claims onto `req.user`. */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(config: ConfigService, private readonly prisma: PrismaService, private readonly requestContext: RequestContextService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('auth.accessSecret'),
    });
  }

  async validate(payload: JwtAccessPayload): Promise<AuthenticatedUser> {
    // Reject any token that is not an access token (e.g. a 2FA challenge token),
    // even though they are signed with the same secret.
    if (payload.purpose !== ACCESS_PURPOSE || !payload.sessionId) {
      throw new UnauthorizedException();
    }
    const now = new Date();
    const [user, session] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { email: true, accountStatus: true, suspendedAt: true, bannedAt: true },
      }),
      this.prisma.session.findUnique({
        where: { id: payload.sessionId },
        select: { userId: true, revokedAt: true, expiresAt: true, mfaVerifiedAt: true },
      }),
    ]);
    if (
      !user || !session || session.userId !== payload.sub || session.revokedAt ||
      session.expiresAt <= now || user.accountStatus !== 'active' || user.suspendedAt || user.bannedAt
    ) {
      throw new UnauthorizedException({ code: 'SESSION_OR_ACCOUNT_INACTIVE' });
    }
    this.requestContext.authenticate(payload.sub, payload.sessionId);
    return {
      userId: payload.sub,
      email: user.email,
      sessionId: session.userId === payload.sub ? payload.sessionId : '',
      mfaVerifiedAt: session.mfaVerifiedAt,
    };
  }
}
