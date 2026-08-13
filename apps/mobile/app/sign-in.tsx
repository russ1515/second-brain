import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '../lib/auth-context';
import { Button, ErrorBanner } from '../components/ui';
import { LocalePicker } from '../components/locale-picker';
import { useI18n } from '../lib/i18n';
import { theme } from '../lib/theme';

export default function SignInScreen() {
  const { login, register } = useAuth();
  const { t } = useI18n();
  const router = useRouter();
  const [mode, setMode] = useState<'login' | 'register'>('register');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (mode === 'register') {
        await register(email.trim(), password, displayName.trim() || undefined);
      } else {
        await login(email.trim(), password);
      }
      router.replace('/');
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>{t('auth.title')}</Text>
        <Text style={styles.subtitle}>{t('auth.subtitle')}</Text>

        <LocalePicker />

        {error ? <ErrorBanner message={error} /> : null}

        {mode === 'register' ? (
          <TextInput
            style={styles.input}
            placeholder={t('auth.name')}
            placeholderTextColor={theme.textFaint}
            value={displayName}
            onChangeText={setDisplayName}
            testID="name"
          />
        ) : null}

        <TextInput
          style={styles.input}
          placeholder={t('auth.email')}
          placeholderTextColor={theme.textFaint}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          testID="email"
        />
        <TextInput
          style={styles.input}
          placeholder={t('auth.password')}
          placeholderTextColor={theme.textFaint}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          testID="password"
        />

        <Button
          label={mode === 'register' ? t('auth.start') : t('auth.signIn')}
          onPress={submit}
          busy={busy}
          disabled={!email || !password}
        />
        <View style={styles.switch}>
          <Button
            variant="ghost"
            label={
              mode === 'register' ? t('auth.haveAccount') : t('auth.createAccount')
            }
            onPress={() => {
              setMode(mode === 'register' ? 'login' : 'register');
              setError(null);
            }}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: theme.bg },
  container: { padding: 24, gap: 12, maxWidth: 520, width: '100%', alignSelf: 'center' },
  title: { fontSize: 30, fontWeight: '700', color: theme.text },
  subtitle: { fontSize: 15, color: theme.textMuted, marginBottom: 12, lineHeight: 21 },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 14,
    fontSize: 16,
    color: theme.text,
  },
  switch: { marginTop: 4 },
});
