import { useCallback, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  LANGUAGE_MODES,
  type LanguageMode,
  type LanguageProfileSummary,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, Empty, ErrorBanner, Loading } from '../../components/ui';

export default function LanguagesScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const router = useRouter();
  const [profiles, setProfiles] = useState<LanguageProfileSummary[] | null>(null);
  const [language, setLanguage] = useState('');
  const [nativeLanguage, setNativeLanguage] = useState('');
  const [mode, setMode] = useState<LanguageMode>('beginner');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setProfiles(await api<LanguageProfileSummary[]>('/languages'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      await api('/languages', {
        method: 'POST',
        body: {
          language: language.trim(),
          ...(nativeLanguage.trim() ? { nativeLanguage: nativeLanguage.trim() } : {}),
          mode,
        },
      });
      setLanguage('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <ErrorBanner message={error} /> : null}

      <Card>
        <Text style={styles.label}>{t('lang.learnTitle')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('lang.langPlaceholder')}
          placeholderTextColor={c.textMuted}
          value={language}
          onChangeText={setLanguage}
          testID="language"
        />
        <TextInput
          style={styles.input}
          placeholder={t('lang.nativePlaceholder')}
          placeholderTextColor={c.textMuted}
          value={nativeLanguage}
          onChangeText={setNativeLanguage}
          testID="native-language"
        />
        <Text style={styles.hint}>{t('lang.teachingMode')}</Text>
        <View style={styles.modes}>
          {LANGUAGE_MODES.map((m) => (
            <Text
              key={m}
              onPress={() => setMode(m)}
              style={[styles.mode, m === mode && styles.modeOn]}
              testID={`mode-${m}`}
            >
              {t(`langmode.${m}` as TranslationKey)}
            </Text>
          ))}
        </View>
        <Button label={t('lang.start')} onPress={create} busy={busy} disabled={!language.trim()} />
      </Card>

      {profiles === null ? (
        <Loading />
      ) : profiles.length === 0 ? (
        <Empty title={t('lang.noLangsTitle')} detail={t('lang.noLangsDetail')} />
      ) : (
        profiles.map((p) => (
          <Card key={p.id}>
            <Text style={styles.name} onPress={() => router.push(`/languages/${p.id}`)}>
              {p.language}
            </Text>
            <Text style={styles.meta}>
              {t(`langmode.${p.mode}` as TranslationKey)} · {p.vocabCount}{' '}
              {t('lang.metaWords')}
              {p.nativeLanguage
                ? ` · ${t('lang.fromNative').replace('{native}', p.nativeLanguage)}`
                : ''}
            </Text>
            <Button variant="ghost" label={t('lang.open')} onPress={() => router.push(`/languages/${p.id}`)} />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  hint: { fontSize: 12, color: c.textMuted, marginBottom: 6 },
  input: {
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: c.textPrimary,
    marginBottom: 10,
  },
  modes: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  mode: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    color: c.textSecondary,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  modeOn: { borderColor: c.primary, color: c.textPrimary, backgroundColor: c.primary },
  name: { fontSize: 18, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: 13, color: c.textSecondary, marginTop: 4, marginBottom: 8, textTransform: 'capitalize' },
});
