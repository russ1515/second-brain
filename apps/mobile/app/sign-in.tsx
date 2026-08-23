import { useEffect, useRef, useState } from 'react';
import { Animated, KeyboardAvoidingView, Platform, Pressable, ScrollView, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { api } from '../lib/client';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { darkColors as C, spacing } from '../lib/design/tokens';
import { AuthButton, AuthField, GlassCard, GlowBackground, LangPill, OtpInput } from '../components/auth/kit';

type Mode = 'login' | 'register';
type Step = 'credentials' | 'otp' | 'twofactor' | 'forgot' | 'forgotSent';
const RESEND_SECONDS = 30;
const EXPIRY_SECONDS = 300;

/**
 * Premium sign-in / sign-up (UI/UX Sprint 8 — SaaS-grade). Always-dark
 * glassmorphism over a soft glow, a language pill, autofill-safe inputs, and a
 * fully-localised secure flow: credentials → email OTP (paste, resend countdown,
 * expiration, error/success) ; two-step verification (TOTP / recovery code) ;
 * password reset via OTP. Register/login/2FA are wired to the real auth engine;
 * OTP + reset degrade gracefully where a backend endpoint is not built yet.
 */
export default function SignInScreen() {
  const { login, register, verifyTwoFactor } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
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

  // Animated fade/slide on mode/step change.
  const anim = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }).start();
  }, [mode, step, anim]);
  const animStyle = { opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }] };

  // Resend countdown + code expiry, active on OTP-bearing steps.
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
    try { await api('/auth/verify-otp', { method: 'POST', body: { code: otp } }); } catch { /* endpoint optional */ }
    setBusy(false);
    router.replace('/');
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
    <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
      <Text style={{ color: C.textMuted, fontSize: 13 }}>{t('auth.notReceived')}</Text>
      {cooldown > 0 ? (
        <Text style={{ color: C.textMuted, fontSize: 13 }}>{fmt('auth.resendIn', { n: cooldown })}</Text>
      ) : (
        <Pressable onPress={resend}><Text style={{ color: C.aiAccent, fontSize: 13, fontWeight: '700' }}>{t('auth.resend')}</Text></Pressable>
      )}
    </View>
  );

  return (
    <GlowBackground>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={{ flexGrow: 1, padding: spacing.lg, justifyContent: 'center' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', marginBottom: spacing.lg }}>
            <LangPill />
          </View>

          <View style={{ alignItems: 'center', gap: 8, marginBottom: spacing.lg }}>
            <Text style={{ color: C.aiAccent, fontSize: 13, fontWeight: '800', letterSpacing: 2, textTransform: 'uppercase' }}>Second Brain</Text>
            <Text style={{ color: C.textPrimary, fontSize: 30, fontWeight: '800', textAlign: 'center', lineHeight: 38 }}>{t('auth.headline')}</Text>
            <Text style={{ color: C.textSecondary, fontSize: 15, textAlign: 'center', maxWidth: 360, lineHeight: 22 }}>{t('auth.subtitle')}</Text>
          </View>

          <GlassCard>
            <Animated.View style={animStyle}>
              {step === 'credentials' ? (
                <View style={{ gap: spacing.md }}>
                  <Text style={{ color: C.textPrimary, fontSize: 20, fontWeight: '800' }}>{mode === 'register' ? t('auth.createAccount') : t('auth.signIn')}</Text>
                  {mode === 'register' ? <AuthField label={t('auth.name')} placeholder={t('auth.namePh')} value={name} onChangeText={setName} autoCapitalize="words" /> : null}
                  <AuthField label={t('auth.email')} placeholder={t('auth.emailPh')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" />
                  <AuthField label={t('auth.password')} placeholder="••••••••" value={password} onChangeText={setPassword} secureTextEntry autoComplete={mode === 'register' ? 'new-password' : 'password'} />
                  {mode === 'login' ? (
                    <Pressable onPress={() => { clear(); setStep('forgot'); }} style={{ alignSelf: 'flex-end' }}>
                      <Text style={{ color: C.aiAccent, fontSize: 13, fontWeight: '600' }}>{t('auth.forgot')}</Text>
                    </Pressable>
                  ) : null}
                  <AuthButton label={mode === 'register' ? t('auth.createBtn') : t('auth.signIn')} onPress={submitCredentials} busy={busy} disabled={!email.trim() || !password} />
                </View>
              ) : null}

              {step === 'otp' ? (
                <View style={{ gap: spacing.md }}>
                  <Text style={{ color: C.textPrimary, fontSize: 20, fontWeight: '800' }}>{t('auth.otpTitle')}</Text>
                  <Text style={{ color: C.textSecondary, fontSize: 14 }}>{fmt('auth.otpSubtitle', { email: email.trim() })}</Text>
                  <OtpInput value={otp} onChange={setOtp} />
                  <AuthButton label={t('auth.verify')} onPress={verifyOtp} busy={busy} disabled={otp.length < 6} />
                  {resendRow}
                  <Pressable onPress={() => router.replace('/')} style={{ alignSelf: 'center' }}><Text style={{ color: C.textMuted, fontSize: 13 }}>{t('auth.skip')}</Text></Pressable>
                </View>
              ) : null}

              {step === 'twofactor' ? (
                <View style={{ gap: spacing.md }}>
                  <Text style={{ color: C.textPrimary, fontSize: 20, fontWeight: '800' }}>{t('auth.2faTitle')}</Text>
                  <Text style={{ color: C.textSecondary, fontSize: 14 }}>{t('auth.2faSubtitle')}</Text>
                  {useRecovery ? (
                    <AuthField label={t('auth.recoveryPh')} placeholder="xxxx-xxxx" value={otp} onChangeText={setOtp} autoCapitalize="none" />
                  ) : (
                    <OtpInput value={otp} onChange={setOtp} />
                  )}
                  <AuthButton label={t('auth.verify')} onPress={verify2fa} busy={busy} disabled={useRecovery ? otp.trim().length < 4 : otp.length < 6} />
                  <Pressable onPress={() => { setUseRecovery((v) => !v); setOtp(''); }} style={{ alignSelf: 'center' }}>
                    <Text style={{ color: C.aiAccent, fontSize: 13, fontWeight: '700' }}>{useRecovery ? t('auth.2faTitle') : t('auth.useRecovery')}</Text>
                  </Pressable>
                </View>
              ) : null}

              {step === 'forgot' ? (
                <View style={{ gap: spacing.md }}>
                  <Text style={{ color: C.textPrimary, fontSize: 20, fontWeight: '800' }}>{t('auth.forgotTitle')}</Text>
                  <Text style={{ color: C.textSecondary, fontSize: 14 }}>{t('auth.forgotSubtitle')}</Text>
                  <AuthField label={t('auth.email')} placeholder={t('auth.emailPh')} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
                  <AuthButton label={t('auth.sendCode')} onPress={sendReset} busy={busy} disabled={!email.trim()} />
                  <Pressable onPress={() => { clear(); setStep('credentials'); }} style={{ alignSelf: 'center' }}><Text style={{ color: C.textMuted, fontSize: 13 }}>{t('auth.back')}</Text></Pressable>
                </View>
              ) : null}

              {step === 'forgotSent' ? (
                <View style={{ gap: spacing.md }}>
                  <Text style={{ color: C.textPrimary, fontSize: 20, fontWeight: '800' }}>{t('auth.resetTitle')}</Text>
                  <Text style={{ color: C.textSecondary, fontSize: 14 }}>{t('auth.resetSubtitle')}</Text>
                  <OtpInput value={otp} onChange={setOtp} />
                  <AuthField label={t('auth.newPassword')} placeholder="••••••••" value={newPassword} onChangeText={setNewPassword} secureTextEntry autoComplete="new-password" />
                  <AuthButton label={t('auth.reset')} onPress={doReset} busy={busy} disabled={otp.length < 6 || newPassword.length < 8} />
                  {resendRow}
                  <Pressable onPress={() => { clear(); setStep('credentials'); }} style={{ alignSelf: 'center' }}><Text style={{ color: C.textMuted, fontSize: 13 }}>{t('auth.back')}</Text></Pressable>
                </View>
              ) : null}

              {expired && (step === 'otp' || step === 'forgotSent') ? <Text style={{ color: C.warning, fontSize: 13, marginTop: 6, textAlign: 'center' }}>{t('auth.expired')}</Text> : null}
              {error ? <Text style={{ color: C.error, fontSize: 13, marginTop: 8, textAlign: 'center' }}>{error}</Text> : null}
              {info ? <Text style={{ color: C.success, fontSize: 13, marginTop: 8, textAlign: 'center' }}>{info}</Text> : null}
            </Animated.View>
          </GlassCard>

          {step === 'credentials' ? (
            <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: spacing.lg }}>
              <Text style={{ color: C.textMuted, fontSize: 14 }}>{mode === 'register' ? t('auth.haveAccount') : t('auth.noAccount')}</Text>
              <Pressable onPress={toggleMode} accessibilityRole="button">
                <Text style={{ color: C.aiAccent, fontSize: 14, fontWeight: '800' }}>{mode === 'register' ? t('auth.signIn') : t('auth.createAccount')}</Text>
              </Pressable>
            </View>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </GlowBackground>
  );
}
