import { Prisma } from '@prisma/client';
import { toSupportedLanguage } from '@second-brain/shared';
import type { PrismaService } from '../prisma/prisma.service';
import type { OtpPurpose } from './email-otp.service';

export type AuthEmailLocale = 'en' | 'fr';

/** Resolve mail language from trusted persisted account state, never from an
 * unauthenticated resend/reset payload. English is the explicit fallback until
 * another server mail template has been reviewed end-to-end. */
export async function resolveAuthEmailLocale(
  prisma: PrismaService,
  userId: string,
): Promise<AuthEmailLocale> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      profile: { select: { preferredLanguage: true } },
      onboardingProfile: { select: { extra: true } },
    },
  });
  const extra = jsonObject(user?.onboardingProfile?.extra);
  const stored = typeof extra.interfaceLanguage === 'string'
    ? extra.interfaceLanguage
    : user?.profile?.preferredLanguage;
  return toSupportedLanguage(stored) === 'fr' ? 'fr' : 'en';
}

export function composeOtpEmail(
  locale: AuthEmailLocale,
  purpose: OtpPurpose,
  code: string,
  ttlSeconds: number,
  to: string,
) {
  const minutes = Math.max(1, Math.round(ttlSeconds / 60));
  if (locale === 'fr') {
    const action = purpose === 'password_reset'
      ? 'réinitialiser votre mot de passe'
      : 'confirmer votre adresse e-mail';
    return {
      to,
      subject: purpose === 'password_reset'
        ? `${code} est votre code de réinitialisation Second Brain`
        : `${code} est votre code de vérification Second Brain`,
      text:
        `Votre code Second Brain pour ${action} est :\n\n${code}\n\n` +
        `Il expire dans ${minutes} minutes. Si vous n’êtes pas à l’origine de cette demande, ignorez cet e-mail.`,
    };
  }
  const action = purpose === 'password_reset' ? 'reset your password' : 'confirm your email';
  return {
    to,
    subject: purpose === 'password_reset'
      ? `${code} is your Second Brain password reset code`
      : `${code} is your Second Brain verification code`,
    text:
      `Your Second Brain code to ${action} is:\n\n${code}\n\n` +
      `It expires in ${minutes} minutes. If you didn't request this, ignore this email.`,
  };
}

export function composeVerificationEmail(
  locale: AuthEmailLocale,
  to: string,
  verifyUrl: string,
  token: string,
  ttlHours: number,
) {
  if (locale === 'fr') {
    return {
      to,
      subject: 'Confirmez votre adresse e-mail Second Brain',
      text:
        `Bienvenue sur Second Brain !\n\nConfirmez votre adresse en ouvrant ce lien :\n${verifyUrl}\n\n` +
        `Vous pouvez aussi envoyer ce jeton à POST /api/auth/verify-email :\n${token}\n\n` +
        `Ce lien expire dans ${ttlHours} heures.`,
    };
  }
  return {
    to,
    subject: 'Confirm your Second Brain email',
    text:
      `Welcome to Second Brain!\n\nConfirm your email by opening this link:\n${verifyUrl}\n\n` +
      `Or submit this token to POST /api/auth/verify-email:\n${token}\n\n` +
      `This link expires in ${ttlHours} hours.`,
  };
}

function jsonObject(value: Prisma.JsonValue | null | undefined): Prisma.JsonObject {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Prisma.JsonObject
    : {};
}
