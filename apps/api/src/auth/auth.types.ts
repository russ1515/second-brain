/** Server-side auth types. Wire contracts live in `@second-brain/shared`. */

/** Distinguishes token kinds that share the same signing secret, so a 2FA
 *  challenge token can never be replayed as an access token. */
export const ACCESS_PURPOSE = 'access';
export const TWO_FACTOR_PURPOSE = 'two_factor';

/** Claims embedded in the signed access token. */
export interface JwtAccessPayload {
  /** Subject — the user id. */
  sub: string;
  email: string;
  purpose: typeof ACCESS_PURPOSE;
}

/** Claims in the short-lived token issued after the password step when 2FA is on. */
export interface TwoFactorChallengePayload {
  sub: string;
  purpose: typeof TWO_FACTOR_PURPOSE;
}

/** Shape attached to `req.user` by the access-token strategy. */
export interface AuthenticatedUser {
  userId: string;
  email: string;
}

/** Request metadata captured when a session (refresh token) is minted. */
export interface SessionContext {
  userAgent?: string;
  ipAddress?: string;
}

/** Minimal structural view of the incoming HTTP request.
 *  Avoids coupling to a specific `@types/express` major (Nest 10 runs Express 4)
 *  while still typing the few fields the auth layer reads. */
export interface HttpRequestLike {
  headers: Record<string, string | string[] | undefined>;
  ip?: string;
  user?: AuthenticatedUser;
}
