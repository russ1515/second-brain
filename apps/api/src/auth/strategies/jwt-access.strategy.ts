import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import {
  ACCESS_PURPOSE,
  type AuthenticatedUser,
  type JwtAccessPayload,
} from '../auth.types';

/** Validates the `Authorization: Bearer <accessToken>` header.
 *  Passport verifies the signature/expiry before `validate` runs; we only map
 *  the trusted claims onto `req.user`. */
@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(config: ConfigService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('auth.accessSecret'),
    });
  }

  validate(payload: JwtAccessPayload): AuthenticatedUser {
    // Reject any token that is not an access token (e.g. a 2FA challenge token),
    // even though they are signed with the same secret.
    if (payload.purpose !== ACCESS_PURPOSE) {
      throw new UnauthorizedException();
    }
    return { userId: payload.sub, email: payload.email };
  }
}
