import { useCallback, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  ReadingExerciseSummary,
  ReadingExerciseView,
  ReadingLevelView,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, Empty, ErrorBanner, Loading } from '../../components/ui';

export default function ReadingScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<ReadingExerciseSummary[] | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [topic, setTopic] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const [lvl, list] = await Promise.all([
        api<ReadingLevelView>('/reading/level'),
        api<ReadingExerciseSummary[]>('/reading'),
      ]);
      setLevel(lvl.level);
      setItems(list);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      const ex = await api<ReadingExerciseView>('/reading/generate', {
        method: 'POST',
        body: { ...(topic.trim() ? { topic: topic.trim() } : {}) },
      });
      setTopic('');
      router.push(`/reading/${ex.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>{t('reading.title')}</Text>
      <Text style={styles.intro}>{t('reading.intro')}</Text>

      {error ? <ErrorBanner message={error} /> : null}

      <Card>
        <View style={styles.levelRow}>
          <Text style={styles.label}>{t('reading.yourLevel')}</Text>
          {level ? (
            <Text style={styles.levelBadge}>
              {t(`reading.lvl.${level}` as TranslationKey)}
            </Text>
          ) : null}
        </View>
        <TextInput
          style={styles.input}
          placeholder={t('reading.topicPlaceholder')}
          placeholderTextColor={c.textMuted}
          value={topic}
          onChangeText={setTopic}
          testID="reading-topic"
        />
        <Button label={t('reading.generate')} onPress={generate} busy={busy} />
      </Card>

      {items === null ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty title={t('reading.emptyTitle')} detail={t('reading.emptyDetail')} />
      ) : (
        items.map((e) => (
          <Card key={e.id}>
            <Text style={styles.name} onPress={() => router.push(`/reading/${e.id}`)}>
              {e.title}
            </Text>
            <Text style={styles.meta}>
              {t(`reading.lvl.${e.level}` as TranslationKey)}
              {e.score !== null
                ? ` · ${t('reading.scored').replace('{n}', String(e.score))}`
                : ` · ${t('reading.notTaken')}`}
            </Text>
            <Button
              variant="ghost"
              label={e.score !== null ? t('reading.review') : t('reading.read')}
              onPress={() => router.push(`/reading/${e.id}`)}
            />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 960, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 28, fontWeight: '700', color: c.textPrimary },
  intro: { fontSize: 14, color: c.textSecondary, lineHeight: 20, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  levelRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  levelBadge: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textPrimary,
    backgroundColor: c.primary,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 10,
    overflow: 'hidden',
    textTransform: 'capitalize',
  },
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
  name: { fontSize: 17, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: 13, color: c.textSecondary, marginTop: 4, marginBottom: 8, textTransform: 'capitalize' },
});
