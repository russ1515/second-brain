import { useState } from 'react';
import { Platform, ScrollView, Text, View } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import type {
  TwoFactorEnableResponse,
  TwoFactorSetupResponse,
} from '@second-brain/shared';
import { Alert, Button, Card, Input } from '../components/ds/core';
import { Page, PageHeader } from '../components/ds/layout';
import { ApiError, api } from '../lib/client';
import { useAuth } from '../lib/auth-context';
import { useTokens } from '../lib/design/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';

type BusyAction = 'setup' | 'enable' | null;

/**
 * Minimal authenticated enrollment surface for Web.
 *
 * TOTP material deliberately lives only in this component's React state. It is
 * never placed in storage, navigation parameters, diagnostics or logs. Leaving
 * the screen therefore discards any secret or recovery codes still on screen.
 */
export default function TwoFactorEnrollmentScreen() {
  const router = useRouter();
  const { t } = useI18n();
  const { user, loading } = useAuth();
  const { colors: c, spacing, radius, typography } = useTokens();
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [code, setCode] = useState('');
  const [recoveryCodes, setRecoveryCodes] = useState<string[] | null>(null);
  const [complete, setComplete] = useState(false);
  const [busy, setBusy] = useState<BusyAction>(null);
  const [errorKey, setErrorKey] = useState<TranslationKey | null>(null);

  const normalizedCode = code.replace(/\D/g, '').slice(0, 6);
  const codeReady = /^\d{6}$/.test(normalizedCode);

  const beginEnrollment = async () => {
    setBusy('setup');
    setErrorKey(null);
    setSetup(null);
    setCode('');
    try {
      const response = await api<TwoFactorSetupResponse>('/auth/2fa/setup', {
        method: 'POST',
        body: {},
      });
      setSetup(response);
    } catch (error) {
      setErrorKey(error instanceof ApiError && error.status === 409
        ? 'mfa.alreadyEnabled'
        : 'mfa.setupError');
    } finally {
      setBusy(null);
    }
  };

  const enableTwoFactor = async () => {
    if (!setup || !codeReady) return;
    setBusy('enable');
    setErrorKey(null);
    try {
      const response = await api<TwoFactorEnableResponse>('/auth/2fa/enable', {
        method: 'POST',
        body: { code: normalizedCode },
      });
      // The pending secret is no longer needed once the backend has enabled
      // MFA. Only the one-time recovery codes remain in memory for this view.
      setSetup(null);
      setCode('');
      setRecoveryCodes([...response.recoveryCodes]);
    } catch {
      setErrorKey('mfa.enableError');
    } finally {
      setBusy(null);
    }
  };

  const confirmRecoveryCodesSaved = () => {
    setRecoveryCodes(null);
    setComplete(true);
  };

  // The enrollment surface is intentionally Web-only. Its API calls are also
  // guarded by the backend, but the client must not paint sensitive setup UI
  // for an unauthenticated deep link or change the native experience.
  if (loading) {
    return (
      <View
        accessibilityLiveRegion="polite"
        style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: c.background }}
      >
        <Text style={{ color: c.textSecondary }}>{t('state.loading')}</Text>
      </View>
    );
  }
  if (!user) {
    return <Redirect href={{ pathname: '/sign-in', params: { returnTo: '/two-factor' } }} />;
  }
  if (Platform.OS !== 'web') {
    return <Redirect href="/profile" />;
  }

  return (
    <ScrollView style={{ backgroundColor: c.background }} contentContainerStyle={{ flexGrow: 1 }}>
      <Page width="reading" style={{ paddingBottom: 48 }} testID="mfa-enrollment-screen">
        <PageHeader title={t('mfa.title')} description={t('mfa.intro')} />

        {errorKey ? (
          <View accessibilityLiveRegion="assertive">
            <Alert tone="error" title={t('state.error')} detail={t(errorKey)} />
          </View>
        ) : null}

        {recoveryCodes ? (
          <View accessibilityLiveRegion="polite">
            <Card style={{ gap: spacing.md }} testID="mfa-recovery-codes">
              <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>
                {t('mfa.recoveryTitle')}
              </Text>
              <Alert tone="warning" title={t('mfa.recoveryWarning')} detail={t('mfa.recoveryDetail')} />
              <View
                style={{
                  gap: spacing.xs,
                  padding: spacing.md,
                  borderRadius: radius.sm,
                  backgroundColor: c.surfaceSunken,
                }}
              >
                {recoveryCodes.map((recoveryCode, index) => (
                  <Text
                    key={index}
                    selectable
                    accessibilityLabel={`${index + 1}. ${recoveryCode}`}
                    style={{ color: c.textPrimary, fontFamily: 'monospace', fontSize: 16, lineHeight: 24 }}
                  >
                    {recoveryCode}
                  </Text>
                ))}
              </View>
              <Button
                label={t('mfa.saved')}
                onPress={confirmRecoveryCodesSaved}
                fullWidth
                testID="mfa-recovery-saved"
              />
            </Card>
          </View>
        ) : complete ? (
          <View accessibilityLiveRegion="polite">
            <Card style={{ gap: spacing.md }} testID="mfa-enrollment-complete">
              <Alert tone="success" title={t('mfa.doneTitle')} detail={t('mfa.doneDetail')} />
              <Button label={t('mfa.backProfile')} variant="secondary" onPress={() => router.replace('/profile')} />
            </Card>
          </View>
        ) : setup ? (
          <View accessibilityLiveRegion="polite">
            <Card style={{ gap: spacing.md }} testID="mfa-enrollment-setup">
            <View style={{ gap: spacing.xs }}>
              <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>
                {t('mfa.setupTitle')}
              </Text>
              <Text style={[typography.body, { color: c.textSecondary }]}>{t('mfa.setupDetail')}</Text>
            </View>

            <Alert tone="warning" title={t('mfa.secretLabel')} detail={t('mfa.secretWarning')} />
            <SecretValue label={t('mfa.secretLabel')} value={setup.secret} />

            <View style={{ gap: spacing.xs }}>
              <Text style={[typography.label, { color: c.textSecondary }]}>{t('mfa.uriLabel')}</Text>
              <Text style={[typography.caption, { color: c.textMuted }]}>{t('mfa.uriDetail')}</Text>
              <SecretValue label={t('mfa.uriLabel')} value={setup.otpauthUrl} />
            </View>

            <Input
              label={t('mfa.codeLabel')}
              value={normalizedCode}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
              keyboardType="number-pad"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              accessibilityHint={t('mfa.codeHint')}
              testID="mfa-totp-code"
            />
            <Button
              label={t('mfa.enable')}
              onPress={() => void enableTwoFactor()}
              disabled={!codeReady}
              loading={busy === 'enable'}
              fullWidth
              testID="mfa-enable"
            />
            </Card>
          </View>
        ) : (
          <Card style={{ gap: spacing.md }} testID="mfa-enrollment-idle">
            <View style={{ gap: spacing.xs }}>
              <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>
                {t('mfa.idleTitle')}
              </Text>
              <Text style={[typography.body, { color: c.textSecondary }]}>{t('mfa.idleDetail')}</Text>
            </View>
            <Button
              label={t('mfa.start')}
              onPress={() => void beginEnrollment()}
              loading={busy === 'setup'}
              fullWidth
              testID="mfa-start"
            />
            <Button label={t('mfa.backProfile')} variant="ghost" onPress={() => router.replace('/profile')} />
          </Card>
        )}
      </Page>
    </ScrollView>
  );
}

function SecretValue({ label, value }: { label: string; value: string }) {
  const { colors: c, spacing, radius } = useTokens();
  return (
    <ScrollView
      horizontal
      accessibilityLabel={label}
      style={{ borderRadius: radius.sm, backgroundColor: c.surfaceSunken }}
      contentContainerStyle={{ paddingHorizontal: spacing.md, paddingVertical: spacing.sm }}
    >
      <Text selectable style={{ color: c.textPrimary, fontFamily: 'monospace', fontSize: 15 }}>
        {value}
      </Text>
    </ScrollView>
  );
}
