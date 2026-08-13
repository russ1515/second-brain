import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/** Route guard for endpoints that require a valid access token. */
@Injectable()
export class JwtAccessGuard extends AuthGuard('jwt-access') {}
