/** Auth wire contracts shared by the API and the mobile client.
 *  Wire shapes only — no server-side secrets, no runtime dependencies. */

export interface RegisterRequest {
  email: string;
  password: string;
  /** Optional friendly name stored on the user's profile. */
  displayName?: string;
}

export interface LoginRequest {
  email: string;
  password: string;
}

/** Exchange a valid refresh token for a rotated access + refresh pair. */
export interface RefreshRequest {
  refreshToken: string;
}

/** Revoke the session tied to a specific refresh token. */
export interface LogoutRequest {
  refreshToken: string;
}

/** Confirm ownership of an email address with the token from the verification mail. */
export interface VerifyEmailRequest {
  token: string;
}

/** The authenticated user, safe to expose to clients (never includes the password hash). */
export interface AuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
}

/** Access + refresh token pair issued on register/login (and rotated on refresh in a later increment). */
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  tokenType: 'Bearer';
  /** Access-token lifetime in seconds. */
  expiresIn: number;
}

/** Standard successful auth response for register and login. */
export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

/** Returned by login when the account has 2FA enabled: no tokens are issued
 *  until the TOTP/recovery code is confirmed via POST /api/auth/2fa/verify. */
export interface TwoFactorChallenge {
  twoFactorRequired: true;
  /** Short-lived token proving the password step passed; submit it to /2fa/verify. */
  challengeToken: string;
}

/** Login result: either full tokens, or a 2FA challenge to complete. */
export type LoginResponse = AuthResponse | TwoFactorChallenge;

/** Type guard: narrows a LoginResponse to the 2FA-challenge branch. */
export function isTwoFactorChallenge(
  res: LoginResponse,
): res is TwoFactorChallenge {
  return (res as TwoFactorChallenge).twoFactorRequired === true;
}

/** Response to POST /api/auth/2fa/setup — data the client turns into a QR code. */
export interface TwoFactorSetupResponse {
  /** otpauth:// URI to render as a QR code in an authenticator app. */
  otpauthUrl: string;
  /** Base32 secret, for manual entry when a QR cannot be scanned. */
  secret: string;
}

/** Confirm a TOTP code to enable 2FA, or to disable it. */
export interface TwoFactorCodeRequest {
  code: string;
}

/** Returned once when 2FA is enabled: single-use recovery codes to store safely. */
export interface TwoFactorEnableResponse {
  recoveryCodes: string[];
}

/** Complete a 2FA login challenge with a TOTP or recovery code. */
export interface TwoFactorVerifyRequest {
  challengeToken: string;
  code: string;
}
