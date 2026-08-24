import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/client';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { useTokens } from '../lib/design/theme';
import { useResponsive } from '../lib/responsive';
import {
  AuthButton,
  AuthField,
  BrandBadge,
  GlassCard,
  GlowBackground,
  LangPill,
  OtpInput,
  PasswordStrength,
  ThemeToggle,
} from '../components/auth/kit';

type Mode = 'login' | 'register';
type Step = 'credentials' | 'otp' | 'twofactor' | 'forgot' | 'forgotSent';
const RESEND_SECONDS = 30;
const EXPIRY_SECONDS = 300;

/**
 * Premium authentication (refactor v2) — the first product screen of Second
 * Brain, as a theme-aware split-screen (brand story left, form right; form-only
 * on mobile). Reuses the existing auth engine, Mailer/OTP seam and i18n: the
 * secure flow is credentials → mandatory email OTP → two-step verification
 * (TOTP / recovery) → protected app; plus OTP-based password reset. The OTP step
 * offers NO skip — verification is enforced server-side.
 */
export default function SignInScreen() {
  const { login, register, verifyTwoFactor } = useAuth();
  const { t } = useI18n();
  const { colors: c, spacing } = useTokens();
  const { width } = useResponsive();
  const router = useRouter();
  const split = width >= 768; // desktop/tablet: brand + form side by side
  const fmt = (k: TranslationKey, vars: Record<string, string | number> = {}) =>
    Object.entries(vars).reduce((s, [key, v]) => s.replace(`{${key}}`, String(v)), t(k));

  const [mode, setMode] = useState<Mode>('register');
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

  // Short fade/slide on mode/step change (respects reduced motion via short dur).
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [mode, step, anim]);
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
  const toggleMode = () => { clear(); setMode((m) => (m === 'login' ? 'register' : 'login')); };

  const submitCredentials = async () => {
    setBusy(true); clear();
    try {
      if (mode === 'register') {
        await register(email.trim(), password, name.trim() || undefined);
        setInfo(fmt('auth.codeSent', { email: email.trim() }));
        startCode(); setStep('otp');
      } else {
        const res = await login(email.trim(), password);
        if (res.status === '2fa') { setChallengeToken(res.challengeToken); setStep('twofactor'); }
        else router.replace('/');
      }
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };

  const verifyOtp = async () => {
    if (expired) { setError(t('auth.expired')); return; }
    setBusy(true); clear();
    try {
      await api('/auth/verify-otp', { method: 'POST', body: { code: otp } });
      router.replace('/');
    } catch (e) {
      setError((e as Error).message || t('auth.otpError'));
    } finally { setBusy(false); }
  };
  const resend = async () => {
    clear();
    try { await api('/auth/resend-verification', { method: 'POST' }); } catch { /* best effort */ }
    startCode(); setInfo(t('auth.newCodeSent'));
  };

  const verify2fa = async () => {
    setBusy(true); clear();
    try { await verifyTwoFactor(challengeToken, otp.trim()); router.replace('/'); }
    catch (e) { setError((e as Error).message || t('auth.otpError')); }
    finally { setBusy(false); }
  };

  const sendReset = async () => {
    setBusy(true); clear();
    try { await api('/auth/forgot-password', { method: 'POST', anonymous: true, body: { email: email.trim() } }); } catch { /* endpoint optional */ }
    setBusy(false);
    setInfo(fmt('auth.resetSent', { email: email.trim() }));
    startCode(); setStep('forgotSent');
  };
  const doReset = async () => {
    if (expired) { setError(t('auth.expired')); return; }
    setBusy(true); clear();
    try {
      await api('/auth/reset-password', { method: 'POST', anonymous: true, body: { email: email.trim(), code: otp, password: newPassword } });
      setMode('login'); setStep('credentials'); setInfo(t('auth.resetOk'));
    } catch (e) { setError((e as Error).message || t('auth.otpError')); } finally { setBusy(false); }
  };

  const resendRow = (
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
      <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('auth.notReceived')}</Text>
      {cooldown > 0 ? (
        <Text style={{ color: c.textMuted, fontSize: 13 }}>{fmt('auth.resendIn', { n: cooldown })}</Text>
      ) : (
        <Pressable onPress={resend} accessibilityRole="button"><Text style={{ color: c.primary, fontSize: 13, fontWeight: '700' }}>{t('auth.resend')}</Text></Pressable>
      )}
    </View>
  );

  const form = (
    <GlassCard>
      <Animated.View style={animStyle}>
        {step === 'credentials' ? (
          <View style={{ gap: spacing.md }}>
            <View style={{ gap: 2 }}>
              <Text style={{ color: c.textPrimary, fontSize: 22, fontWeight: '800' }}>{mode === 'register' ? t('auth.createAccount') : t('auth.welcomeBack')}</Text>
              <Text style={{ color: c.textMuted, fontSize: 13 }}>{mode === 'register' ? t('auth.signUpSubtitle') : t('auth.signInSubtitle')}</Text>
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
              <Pressable onPress={toggleMode} accessibilityRole="button">
                <Text style={{ color: c.primary, fontSize: 14, fontWeight: '800' }}>{mode === 'register' ? t('auth.signIn') : t('auth.createAccount')}</Text>
              </Pressable>
            </View>
          </View>
        ) : null}

        {step === 'otp' ? (
          <View style={{ gap: spacing.md }}>
            <Text style={{ color: c.textPrimary, fontSize: 20, fontWeight: '800' }}>{t('auth.otpTitle')}</Text>
            <Text style={{ color: c.textSecondary, fontSize: 14 }}>{fmt('auth.otpSubtitle', { email: maskEmail(email.trim()) })}</Text>
            <OtpInput value={otp} onChange={setOtp} />
            <AuthButton label={t('auth.verify')} onPress={verifyOtp} busy={busy} disabled={otp.length < 6} />
            {resendRow}
            {/* No skip: OTP verification is mandatory and enforced server-side (§2). */}
            <Pressable onPress={() => { clear(); setStep('credentials'); }} style={{ alignSelf: 'center' }} accessibilityRole="button">
              <Text style={{ color: c.textMuted, fontSize: 13 }}>{t('auth.back')}</Text>
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
            {resendRow}
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
            {/* Left — brand experience (§7-9) */}
            <View style={{ width: '46%', padding: spacing.xl, justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row' }}><ThemeToggle /></View>
              <View style={{ gap: spacing.lg, maxWidth: 460 }}>
                <Text style={{ color: c.primary, fontSize: 13, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }}>Second Brain</Text>
                <Text style={{ color: c.textPrimary, fontSize: 40, fontWeight: '800', lineHeight: 48 }}>{t('auth.brandTitle')}</Text>
                <Text style={{ color: c.textSecondary, fontSize: 16, lineHeight: 24 }}>{t('auth.brandSubtitle')}</Text>
                <AuthScene />
              </View>
              <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                <BrandBadge icon="🌍" label={t('auth.badgeLangs')} />
                <BrandBadge icon="🤖" label={t('auth.badgeModels')} />
                <BrandBadge icon="🧠" label={t('auth.badgeGraph')} />
              </View>
            </View>
            {/* Right — form */}
            <View style={{ flex: 1, borderLeftWidth: 1, borderLeftColor: c.borderSubtle }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.lg }}>
                <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '800' }}>🧠 Second Brain</Text>
                <LangPill />
              </View>
              <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.lg }}>
                {form}
              </ScrollView>
            </View>
          </View>
        ) : (
          <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, justifyContent: 'center' }}>
            {/* Mobile — compact header + form only (§18) */}
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg }}>
              <Text style={{ color: c.textPrimary, fontSize: 15, fontWeight: '800' }}>🧠 Second Brain</Text>
              <View style={{ flexDirection: 'row', gap: 8 }}>
                <LangPill />
                <ThemeToggle />
              </View>
            </View>
            <View style={{ alignItems: 'center', gap: 8, marginBottom: spacing.lg }}>
              <Text style={{ color: c.textPrimary, fontSize: 26, fontWeight: '800', textAlign: 'center', lineHeight: 32 }}>{t('auth.brandTitle')}</Text>
              <Text style={{ color: c.textSecondary, fontSize: 14, textAlign: 'center', maxWidth: 340, lineHeight: 20 }}>{t('auth.brandSubtitle')}</Text>
            </View>
            {form}
            <View style={{ flexDirection: 'row', gap: 8, justifyContent: 'center', flexWrap: 'wrap', marginTop: spacing.lg }}>
              <BrandBadge icon="🌍" label={t('auth.badgeLangs')} />
              <BrandBadge icon="🤖" label={t('auth.badgeModels')} />
              <BrandBadge icon="🧠" label={t('auth.badgeGraph')} />
            </View>
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

/** Lightweight product illustration (§8): a question, the teacher's reply, and
 *  a few concept nodes — suggesting the system learns with the user. Static,
 *  no fake app, no business engine. */
function AuthScene() {
  const { colors: c, radius } = useTokens();
  const { t } = useI18n();
  const chip = (label: string) => (
    <View key={label} style={{ borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: radius.full, paddingVertical: 5, paddingHorizontal: 10 }}>
      <Text style={{ color: c.textSecondary, fontSize: 12, fontWeight: '600' }}>{label}</Text>
    </View>
  );
  return (
    <View style={{ gap: 10, padding: 16, borderRadius: radius.lg, borderWidth: 1, borderColor: c.borderSubtle, backgroundColor: c.surface }}>
      <View style={{ alignSelf: 'flex-end', maxWidth: '85%', backgroundColor: c.primary, borderRadius: radius.lg, paddingVertical: 8, paddingHorizontal: 12 }}>
        <Text style={{ color: c.onPrimary, fontSize: 13 }}>{t('auth.sceneQuestion')}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, maxWidth: '90%' }}>
        <Text style={{ fontSize: 18 }}>👨‍🏫</Text>
        <View style={{ flex: 1, backgroundColor: c.surfaceElevated, borderRadius: radius.lg, paddingVertical: 8, paddingHorizontal: 12 }}>
          <Text style={{ color: c.textPrimary, fontSize: 13, lineHeight: 19 }}>{t('auth.sceneAnswer')}</Text>
        </View>
      </View>
      <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
        {chip(`🧩 ${t('auth.sceneConcept')}`)}
        {chip(`🔗 ${t('auth.sceneRelation')}`)}
        {chip(`⭐ ${t('auth.sceneMastery')}`)}
      </View>
    </View>
  );
}
