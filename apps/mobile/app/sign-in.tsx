import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, usePathname, useRouter } from 'expo-router';
import { toSupportedLanguage } from '@second-brain/shared';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/client';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { useTokens } from '../lib/design/theme';
import { useResponsive } from '../lib/responsive';
import { safeReturnPath } from '../lib/navigation';
import {
  AuthButton,
  AuthField,
  GlassCard,
  GlowBackground,
  LangPill,
  OtpInput,
  PasswordStrength,
  ThemeToggle,
} from '../components/auth/kit';
import { SignupProductDemo } from '../components/auth/signup-product-demo';

type Mode = 'login' | 'register';
type Step = 'credentials' | 'otp' | 'twofactor' | 'forgot' | 'forgotSent';
const RESEND_SECONDS = 30;
const EXPIRY_SECONDS = 300;

function webLinkKeyboardProps(onActivate: () => void) {
  if (Platform.OS !== 'web') return {};
  return {
    onKeyDown: (event: { key?: string; preventDefault?: () => void }) => {
      if (event.key !== 'Enter') return;
      event.preventDefault?.();
      onActivate();
    },
  };
}

/**
 * Premium authentication (refactor v2) — the first product screen of Second
 * Brain, as a theme-aware split-screen (brand story left, form right; form-only
 * on mobile). Reuses the existing auth engine, Mailer/OTP seam and i18n: the
 * secure flow is credentials → mandatory email OTP → two-step verification
 * (TOTP / recovery) → protected app; plus OTP-based password reset. The OTP step
 * offers NO skip — verification is enforced server-side.
 */
export default function SignInScreen() {
  const { user, login, register, verifyEmailOtp, verifyTwoFactor, logout } = useAuth();
  const { t, locale } = useI18n();
  const { colors: c, spacing, reducedMotion } = useTokens();
  const { width } = useResponsive();
  const router = useRouter();
  const pathname = usePathname();
  const { returnTo, mode: requestedMode } = useLocalSearchParams<{ returnTo?: string | string[]; mode?: string | string[] }>();
  const destination = safeReturnPath(returnTo);
  const requestedModeValue = Array.isArray(requestedMode) ? requestedMode[0] : requestedMode;
  const split = width >= 768; // desktop/tablet: brand + form side by side
  const desktop = width >= 1080;
  const fmt = (k: TranslationKey, vars: Record<string, string | number> = {}) =>
    Object.entries(vars).reduce((s, [key, v]) => s.replace(`{${key}}`, String(v)), t(k));

  const routeMode: Mode = pathname === '/login'
    ? 'login'
    : pathname === '/signup'
      ? 'register'
      : requestedModeValue === 'login'
        ? 'login'
        : 'register';
  const [mode, setMode] = useState<Mode>(routeMode);
  const [step, setStep] = useState<Step>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [challengeToken, setChallengeToken] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [expired, setExpired] = useState(false);

  useEffect(() => {
    setMode(routeMode);
    setStep('credentials');
  }, [routeMode]);

  // A pending-verification session is deliberately restorable. Returning to
  // this route after a reload must reopen the OTP step instead of stranding the
  // learner on credentials with an already-created account.
  useEffect(() => {
    if (user && !user.emailVerified && step === 'credentials') {
      setError(null);
      setInfo(null);
      setExpired(false);
      setEmail(user.email);
      setOtp('');
      setStep('otp');
    }
  }, [step, user]);

  // Short fade/slide on mode/step change; fully static when reduced motion is requested.
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reducedMotion) {
      anim.setValue(1);
      return;
    }
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [mode, step, anim, reducedMotion]);
  const animStyle = { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] };

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setTimeout(() => setCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [cooldown]);
  const startCode = () => { setCooldown(RESEND_SECONDS); setExpired(false); setOtp(''); };
  useEffect(() => {
    if (step !== 'otp' && step !== 'forgotSent') return;
    const id = setTimeout(() => setExpired(true), EXPIRY_SECONDS * 1000);
    return () => clearTimeout(id);
  }, [step]);

  const clear = () => { setError(null); setInfo(null); };
  const navigateMode = (nextMode: Mode, replace = false) => {
    const route = nextMode === 'register' ? '/signup' : '/login';
    const href = {
      pathname: route,
      params: destination === '/' ? {} : { returnTo: destination },
    } as const;
    if (replace) router.replace(href);
    else router.push(href);
  };
  const toggleMode = () => {
    clear();
    navigateMode(mode === 'login' ? 'register' : 'login', true);
  };
  const goHome = () => router.dismissTo('/');
  const goPrivacy = () => router.dismissTo('/?section=privacy');

  const homeLink = (
    <Pressable
      {...webLinkKeyboardProps(goHome)}
      testID="auth-back-home"
      onPress={goHome}
      accessibilityRole="link"
      style={{ minHeight: 44, justifyContent: 'center', alignSelf: 'flex-start' }}
    >
      <Text style={{ color: c.primary, fontSize: 14, fontWeight: '700' }}>← {t('session.home')}</Text>
    </Pressable>
  );

  const submitCredentials = async () => {
    setBusy(true); clear();
    try {
      if (mode === 'register') {
        await register(
          email.trim(),
          password,
          name.trim() || undefined,
          toSupportedLanguage(locale) ?? 'en',
        );
        setInfo(fmt('auth.codeSent', { email: email.trim() }));
        startCode(); setStep('otp');
      } else {
        const res = await login(email.trim(), password);
        if (res.status === '2fa') { setChallengeToken(res.challengeToken); setStep('twofactor'); }
        else if (res.status === 'pending-verification') {
          setExpired(false);
          setCooldown(0);
          setOtp('');
          setStep('otp');
          setInfo(t('auth.emailVerificationRequired'));
        }
        else router.replace(destination);
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    if (expired) { setError(t('auth.expired')); return; }
    setBusy(true); clear();
    try {
      await verifyEmailOtp(otp);
      router.replace(destination);
    } catch (e) {
      setError((e as Error).message || t('auth.otpError'));
    } finally { setBusy(false); }
  };
  const resendVerification = async () => {
    setBusy(true); clear();
    try {
      await api('/auth/resend-verification', { method: 'POST' });
      startCode(); setInfo(t('auth.newCodeSent'));
    } catch (e) {
      setError((e as Error).message || t('auth.otpError'));
    } finally {
      setBusy(false);
    }
  };

  const verify2fa = async () => {
    setBusy(true); clear();
    try {
      const result = await verifyTwoFactor(challengeToken, otp.trim());
      if (result.status === 'pending-verification') {
        setChallengeToken('');
        setExpired(false);
        setCooldown(0);
        setOtp('');
        setStep('otp');
        setInfo(t('auth.emailVerificationRequired'));
      } else {
        router.replace(destination);
      }
    }
    catch (e) { setError((e as Error).message || t('auth.otpError')); }
    finally { setBusy(false); }
  };

  const changeAccount = async () => {
    setBusy(true); clear();
    try {
      await logout();
    } finally {
      setMode('login');
      setChallengeToken('');
      setOtp('');
      setPassword('');
      setStep('credentials');
      setBusy(false);
      navigateMode('login', true);
    }
  };

  const requestPasswordReset = async () => {
    await api('/auth/forgot-password', {
      method: 'POST',
      anonymous: true,
      body: { email: email.trim() },
    });
  };
  const sendReset = async () => {
    setBusy(true); clear();
    try {
      await requestPasswordReset();
      setInfo(fmt('auth.resetSent', { email: email.trim() }));
      startCode(); setStep('forgotSent');
    } catch (e) {
      setError((e as Error).message || t('auth.otpError'));
    } finally {
      setBusy(false);
    }
  };
  const resendPasswordReset = async () => {
    setBusy(true); clear();
    try {
      await requestPasswordReset();
      startCode(); setInfo(t('auth.newCodeSent'));
    } catch (e) {
      setError((e as Error).message || t('auth.otpError'));
    } finally {
      setBusy(false);
    }
  };
  const doReset = async () => {
    if (expired) { setError(t('auth.expired')); return; }
    setBusy(true); clear();
    try {
      await api('/auth/reset-password', { method: 'POST', anonymous: true, body: { email: email.trim(), code: otp, password: newPassword } });
      setMode('login'); setStep('credentials'); setInfo(t('auth.resetOk')); navigateMode('login', true);
    } catch (e) { setError((e as Error).message || t('auth.otpError')); } finally { setBusy(false); }
  };

  const resendRow = (onResend: () => void) => (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('auth.notReceived')}</Text>
      {cooldown > 0 ? (
        <Text style={{ color: c.textMuted, fontSize: 13 }}>{fmt('auth.resendIn', { n: cooldown })}</Text>
      ) : (
        <Pressable onPress={onResend} disabled={busy} accessibilityRole="button" accessibilityState={{ disabled: busy }}><Text style={{ color: c.primary, fontSize: 13, fontWeight: '700' }}>{t('auth.resend')}</Text></Pressable>
      )}
    </View>
  );
  const publicBetaLabel = t('landing12.footer.beta').split(' · ')[0];

  const form = (
    <GlassCard>
      <Animated.View style={animStyle}>
        {step === 'credentials' ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: 2 }}>
              <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: '800' }}>{mode === 'register' ? t('auth.createAccount') : t('auth.welcomeBack')}</Text>
              <Text style={{ color: c.textMuted, fontSize: 13 }}>{mode === 'register' ? t('auth.signUpSubtitle') : t('auth.signInSubtitle')}</Text>
              {mode === 'register' ? (
                <Text style={{ color: c.primary, fontSize: 11, lineHeight: 16, fontWeight: '800', paddingTop: 4 }}>
                  {t('landing12.pricing.freeStatus')} · {publicBetaLabel}
                </Text>
              ) : null}
            </View>
            {mode === 'register' ? <AuthField label={t('auth.name')} placeholder={t('auth.namePh')} value={name} onChangeText={setName} autoCapitalize="words" /> : null}
            <AuthField label={t('auth.email')} placeholder={t('auth.emailPh')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
            <AuthField label={t('auth.password')} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'register' ? 'new-password' : 'password'} />
            {mode === 'register' ? <PasswordStrength password={password} /> : null}
            {mode === 'login' ? (
              <Pressable onPress={() => { clear(); setStep('forgot'); }} style={{ alignSelf: 'flex-end' }} accessibilityRole="button">
                <Text style={{ color: c.primary, fontSize: 13, fontWeight: '600' }}>{t('auth.forgot')}</Text>
              </Pressable>
            ) : null}
            <AuthButton label={mode === 'register' ? t('auth.createBtn') : t('auth.signIn')} onPress={submitCredentials} busy={busy} disabled={!email.trim() || !password} />
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
              <Text style={{ color: c.textMuted, fontSize: 14 }}>{mode === 'register' ? t('auth.haveAccount') : t('auth.noAccount')}</Text>
              <Pressable {...webLinkKeyboardProps(toggleMode)} onPress={toggleMode} accessibilityRole="link">
                <Text style={{ color: c.primary, fontSize: 14, fontWeight: '800' }}>{mode === 'register' ? t('auth.signIn') : t('auth.createAccount')}</Text>
              </Pressable>
            </View>
            {mode === 'register' ? (
              <View style={{ gap: 5, paddingTop: 4, borderTopWidth: 1, borderTopColor: c.borderSubtle }}>
                <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 16, textAlign: 'center' }}>
                  {t('landingV1.auth.privacy')}
                </Text>
                <Pressable {...webLinkKeyboardProps(goPrivacy)} testID="auth-privacy-link" onPress={goPrivacy} accessibilityRole="link" style={{ alignSelf: 'center', minHeight: 32, justifyContent: 'center' }}>
                  <Text style={{ color: c.primary, fontSize: 11, fontWeight: '700' }}>{t('landing12.footer.privacy')}</Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}

        {step === 'otp' ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800' }}>{t('auth.otpTitle')}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 14 }}>{fmt('auth.otpSubtitle', { email: maskEmail(email.trim()) })}</Text>
            <OtpInput value={otp} onChange={setOtp} />
            <AuthButton label={t('auth.verify')} onPress={verifyOtp} busy={busy} disabled={otp.length < 6} />
            {resendRow(resendVerification)}
            {/* No skip: OTP verification is mandatory and enforced server-side (§2). */}
            <Pressable onPress={() => void changeAccount()} style={{ alignSelf: 'center' }} accessibilityRole="button">
              <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('app.signOut')}</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'twofactor' ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800' }}>{t('auth.2faTitle')}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 14 }}>{t('auth.2faSubtitle')}</Text>
            {useRecovery ? (
              <AuthField label={t('auth.recoveryPh')} placeholder="xxxx-xxxx" value={otp} onChangeText={setOtp} autoCapitalize="none" />
            ) : (
              <OtpInput value={otp} onChange={setOtp} />
            )}
            <AuthButton label={t('auth.verify')} onPress={verify2fa} busy={busy} disabled={useRecovery ? otp.trim().length < 4 : otp.length < 6} />
            <Pressable onPress={() => { setUseRecovery((v) => !v); setOtp(''); }} style={{ alignSelf: 'center' }} accessibilityRole="button">
              <Text style={{ color: c.primary, fontSize: 13, fontWeight: '700' }}>{useRecovery ? t('auth.2faTitle') : t('auth.useRecovery')}</Text>
            </Pressable>
          </View>
        ) : null}

        {step === 'forgot' ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800' }}>{t('auth.forgotTitle')}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 14 }}>{t('auth.forgotSubtitle')}</Text>
            <AuthField label={t('auth.email')} placeholder={t('auth.emailPh')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
            <AuthButton label={t('auth.sendCode')} onPress={sendReset} busy={busy} disabled={!email.trim()} />
            <Pressable onPress={() => { clear(); setStep('credentials'); }} style={{ alignSelf: 'center' }} accessibilityRole="button"><Text style={{ color: c.textMuted, fontSize: 13 }}>{t('auth.back')}</Text></Pressable>
          </View>
        ) : null}

        {step === 'forgotSent' ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800' }}>{t('auth.resetTitle')}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 14 }}>{t('auth.resetSubtitle')}</Text>
            <OtpInput value={otp} onChange={setOtp} />
            <AuthField label={t('auth.newPassword')} placeholder="••••••••" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" />
            <PasswordStrength password={newPassword} />
            <AuthButton label={t('auth.reset')} onPress={doReset} busy={busy} disabled={otp.length < 6 || newPassword.length < 8} />
            {resendRow(resendPasswordReset)}
            <Pressable onPress={() => { clear(); setStep('credentials'); }} style={{ alignSelf: 'center' }} accessibilityRole="button"><Text style={{ color: c.textMuted, fontSize: 13 }}>{t('auth.back')}</Text></Pressable>
          </View>
        ) : null}

        {expired && (step === 'otp' || step === 'forgotSent') ? <Text style={{ color: c.warning, fontSize: 13, marginTop: 6, textAlign: 'center' }}>{t('auth.expired')}</Text> : null}
        {error ? (
          <View style={{ marginTop: 8, gap: 6, alignItems: 'center' }}>
            <Text style={{ color: c.error, fontSize: 13, textAlign: 'center' }}>{error}</Text>
          </View>
        ) : null}
        {info ? <Text style={{ color: c.success, fontSize: 13, marginTop: 8, textAlign: 'center' }}>{info}</Text> : null}
      </Animated.View>
    </GlassCard>
  );

  return (
    <GlowBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {split ? (
          <View style={{ flex: 1, flexDirection: 'row' }}>
            {/* Signup tells the V1 product story; login intentionally stays quieter. */}
            <View style={{ width: desktop ? '46%' : '38%', padding: desktop ? spacing.xl : spacing.lg }}>
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ flexGrow: 1, justifyContent: 'space-between', gap: spacing.lg }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <ThemeToggle />
                  {mode === 'register' ? (
                    <Text style={{ color: c.primary, fontSize: 10, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' }}>
                      {publicBetaLabel}
                    </Text>
                  ) : null}
                </View>
                <View style={{ gap: desktop ? spacing.lg : spacing.md, maxWidth: 520 }}>
                  <Pressable {...webLinkKeyboardProps(goHome)} testID="auth-brand-home-desktop" onPress={goHome} accessibilityRole="link" style={{ alignSelf: 'flex-start', minHeight: 36, justifyContent: 'center' }}>
                    <Text style={{ color: c.primary, fontSize: 13, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }}>{t('landing12.brand')}</Text>
                  </Pressable>
                  {mode === 'register' ? (
                    <Text style={{ color: c.primary, fontSize: 11, fontWeight: '800' }}>
                      {t('landing12.pricing.freeStatus')} · {publicBetaLabel}
                    </Text>
                  ) : null}
                  <Text style={{ color: c.textPrimary, fontSize: desktop ? 40 : 30, fontWeight: '800', lineHeight: desktop ? 48 : 37 }}>{t('auth.brandTitle')}</Text>
                  <Text style={{ color: c.textSecondary, fontSize: desktop ? 16 : 14, lineHeight: desktop ? 24 : 21 }}>
                    {mode === 'register' ? t('landing12.story.outcome') : t('auth.brandSubtitle')}
                  </Text>
                  {mode === 'register' ? (
                    <SignupProductDemo compact={!desktop} />
                  ) : (
                    <View style={{ borderWidth: 1, borderColor: c.borderSubtle, backgroundColor: c.surface, borderRadius: 16, padding: spacing.lg, gap: 8 }}>
                      <Text style={{ color: c.primary, fontSize: 12, fontWeight: '800' }}>{t('landing12.signature')}</Text>
                      <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>{t('landing12.hero.subtitle')}</Text>
                    </View>
                  )}
                </View>
                <Text style={{ color: c.textMuted, fontSize: 11, lineHeight: 16 }}>{t('landing12.footer.noTracking')}</Text>
              </ScrollView>
            </View>
            {/* Right — form */}
            <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: c.borderSubtle }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg }}>
                <Pressable {...webLinkKeyboardProps(goHome)} testID="auth-logo-home-desktop" onPress={goHome} accessibilityRole="link">
                  <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '800' }}>🧠 {t('landing12.brand')}</Text>
                </Pressable>
                <LangPill />
              </View>
              <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.sm }}>
                {homeLink}
                {form}
              </ScrollView>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, justifyContent: 'flex-start' }}>
            {/* Mobile prioritises the form; the signup demo follows it. */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
              <Pressable {...webLinkKeyboardProps(goHome)} testID="auth-logo-home-mobile" onPress={goHome} accessibilityRole="link">
                <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '800' }}>🧠 {t('landing12.brand')}</Text>
              </Pressable>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <LangPill />
                <ThemeToggle />
              </View>
            </View>
            {homeLink}
            {form}
            {mode === 'register' && step === 'credentials' ? (
              <View style={{ gap: spacing.md, marginTop: spacing.xl }}>
                <View style={{ alignItems: 'center', gap: 7 }}>
                  <Text style={{ color: c.primary, fontSize: 11, fontWeight: '800' }}>
                    {t('landing12.pricing.freeStatus')} · {publicBetaLabel}
                  </Text>
                  <Text style={{ color: c.textPrimary, fontSize: 24, fontWeight: '800', textAlign: 'center', lineHeight: 30 }}>{t('auth.brandTitle')}</Text>
                   <Text style={{ color: c.textSecondary, fontSize: 13, textAlign: 'center', maxWidth: 420, lineHeight: 19 }}>{t('landing12.story.outcome')}</Text>
                </View>
                <SignupProductDemo compact />
              </View>
            ) : null}
          </ScrollView>
        )}
      </KeyboardAvoidingView>
    </GlowBackground>
  );
}

/** Partially mask an email (a***@domain) for the OTP subtitle. */
function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!domain) return email;
  const shown = user.slice(0, 1);
  return `${shown}${'*'.repeat(Math.max(1, user.length - 1))}@${domain}`;
}
