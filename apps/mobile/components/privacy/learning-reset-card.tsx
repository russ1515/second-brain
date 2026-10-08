import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import type {
  LearningResetRequirements,
  LearningResetResponse,
} from '@second-brain/shared';
import { useRouter } from 'expo-router';
import { Button, Card, ErrorBanner } from '../ui';
import { api } from '../../lib/client';
import { useAuth } from '../../lib/auth-context';
import { useTokens } from '../../lib/design/theme';
import { useI18n } from '../../lib/i18n';
import { clearLocalLearningState } from '../../lib/learning-reset-local';

const REQUIRED_CONFIRMATION = 'RÉINITIALISER';

/** Strong, account-preserving confirmation surface for pedagogical reset. */
export function LearningResetCard() {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const router = useRouter();
  const { user, refreshOnboarding } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [requirements, setRequirements] = useState<LearningResetRequirements | null>(null);
  const [password, setPassword] = useState('');
  const [mfaCode, setMfaCode] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = async () => {
    setExpanded(true);
    setError(null);
    try {
      setRequirements(await api<LearningResetRequirements>('/me/learning/reset-requirements'));
    } catch (cause) {
      setError((cause as Error).message);
    }
  };

  const cancel = () => {
    setExpanded(false);
    setRequirements(null);
    setPassword('');
    setMfaCode('');
    setConfirmation('');
    setError(null);
  };

  const execute = async () => {
    if (confirmation !== REQUIRED_CONFIRMATION || !password || !requirements || !user) return;
    setBusy(true);
    setError(null);
    try {
      if (requirements.mfaRequired) {
        await api('/auth/2fa/step-up', {
          method: 'POST',
          body: { code: mfaCode.trim() },
        });
      }
      await api<LearningResetResponse>('/me/learning/reset', {
        method: 'POST',
        body: { password, confirmation: REQUIRED_CONFIRMATION },
      });
      await clearLocalLearningState(user.id);
      await refreshOnboarding();
      router.replace('/onboarding');
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const mfaReady = !requirements?.mfaRequired
    || (mfaCode.trim().length >= 6 && mfaCode.trim().length <= 32);
  const ready = Boolean(
    requirements
    && user
    && password
    && confirmation === REQUIRED_CONFIRMATION
    && mfaReady,
  );

  return (
    <Card style={{ borderColor: c.errorSoft, gap: 10 }} testID="learning-reset-card">
      <Text style={{ color: c.textPrimary, fontSize: 16, fontWeight: '700' }}>
        {t('priv.learningReset.title')}
      </Text>
      <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>
        {t('priv.learningReset.help')}
      </Text>
      {!expanded ? (
        <Button
          variant="danger"
          label={t('priv.learningReset.button')}
          onPress={() => { void open(); }}
          testID="learning-reset-open"
        />
      ) : (
        <>
          <Text style={{ color: c.error, fontSize: 13, fontWeight: '700', lineHeight: 19 }}>
            {t('priv.learningReset.warning')}
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>
            {t('priv.learningReset.scope')}
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>
            {t('priv.learningReset.preserved')}
          </Text>
          <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>
            {t('priv.learningReset.pdfReminder')}
          </Text>
          {error ? <ErrorBanner message={error} /> : null}
          <TextInput
            style={{
              backgroundColor: c.surfaceElevated,
              borderWidth: 1,
              borderColor: c.border,
              borderRadius: 10,
              padding: 12,
              fontSize: 15,
              color: c.textPrimary,
            }}
            value={password}
            onChangeText={setPassword}
            placeholder={t('priv.passwordPlaceholder')}
            placeholderTextColor={c.textMuted}
            secureTextEntry
            autoCapitalize="none"
            accessibilityLabel={t('priv.passwordPlaceholder')}
            testID="learning-reset-password"
          />
          {requirements?.mfaRequired ? (
            <TextInput
              style={{
                backgroundColor: c.surfaceElevated,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: 10,
                padding: 12,
                fontSize: 15,
                color: c.textPrimary,
              }}
              value={mfaCode}
              onChangeText={(value) => setMfaCode(value.slice(0, 32))}
              placeholder={t('priv.learningReset.mfaPlaceholder')}
              placeholderTextColor={c.textMuted}
              autoCapitalize="characters"
              accessibilityLabel={t('priv.learningReset.mfaPlaceholder')}
              testID="learning-reset-mfa"
            />
          ) : null}
          <Text style={{ color: c.textSecondary, fontSize: 13, lineHeight: 19 }}>
            {t('priv.learningReset.typePrompt')}
          </Text>
          <TextInput
            style={{
              backgroundColor: c.surfaceElevated,
              borderWidth: 1,
              borderColor: confirmation && confirmation !== REQUIRED_CONFIRMATION ? c.error : c.border,
              borderRadius: 10,
              padding: 12,
              fontSize: 15,
              color: c.textPrimary,
            }}
            value={confirmation}
            onChangeText={setConfirmation}
            placeholder={REQUIRED_CONFIRMATION}
            placeholderTextColor={c.textMuted}
            autoCapitalize="characters"
            accessibilityLabel={t('priv.learningReset.typePrompt')}
            testID="learning-reset-confirmation"
          />
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Button variant="ghost" label={t('priv.cancel')} onPress={cancel} testID="learning-reset-cancel" />
            </View>
            <View style={{ flex: 1 }}>
              <Button
                variant="danger"
                label={t('priv.learningReset.confirm')}
                busy={busy}
                disabled={!ready}
                onPress={() => { void execute(); }}
                testID="learning-reset-submit"
              />
            </View>
          </View>
        </>
      )}
    </Card>
  );
}
