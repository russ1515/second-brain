import { SetMetadata } from '@nestjs/common';

/**
 * Opts an authenticated route into the strictly limited onboarding exception:
 * a newly registered user may only verify or resend their own email before the
 * normal verified-email/private-beta access gate applies.
 */
export const ALLOW_PENDING_VERIFICATION_KEY = 'auth:allow_pending_verification';
export const AllowPendingVerification = () =>
  SetMetadata(ALLOW_PENDING_VERIFICATION_KEY, true);
