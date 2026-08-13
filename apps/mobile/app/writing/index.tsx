import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  WRITING_TYPES,
  type WritingSubmissionSummary,
  type WritingSubmissionView,
  type WritingType,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { theme } from '../../lib/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, Empty, ErrorBanner, Loading } from '../../components/ui';

const TYPE_LABEL: Record<WritingType, TranslationKey> = {
  redaction: 'writing.t.redaction',
  dissertation: 'writing.t.dissertation',
  memoire: 'writing.t.memoire',
  rapport: 'writing.t.rapport',
  compte_rendu: 'writing.t.compte_rendu',
  devoir: 'writing.t.devoir',
};

export default function WritingScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<WritingSubmissionSummary[] | null>(null);
  const [type, setType] = useState<WritingType>('redaction');
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api<WritingSubmissionSummary[]>('/writing'));
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const review = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api<WritingSubmissionView>('/writing', {
        method: 'POST',
        body: {
          type,
          text: text.trim(),
          ...(title.trim() ? { title: title.trim() } : {}),
          ...(instructions.trim() ? { instructions: instructions.trim() } : {}),
        },
      });
      setText('');
      setTitle('');
      setInstructions('');
      router.push(`/writing/${res.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>{t('writing.title')}</Text>
      <Text style={styles.intro}>{t('writing.intro')}</Text>

      {error ? <ErrorBanner message={error} /> : null}

      <Card>
        <Text style={styles.label}>{t('writing.new')}</Text>
        <View style={styles.chips}>
          {WRITING_TYPES.map((tp) => (
            <Text
              key={tp}
              onPress={() => setType(tp)}
              style={[styles.chip, tp === type && styles.chipOn]}
            >
              {t(TYPE_LABEL[tp])}
            </Text>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder={t('writing.titlePlaceholder')}
          placeholderTextColor={theme.textFaint}
          value={title}
          onChangeText={setTitle}
        />
        <TextInput
          style={styles.input}
          placeholder={t('writing.briefPlaceholder')}
          placeholderTextColor={theme.textFaint}
          value={instructions}
          onChangeText={setInstructions}
        />
        <TextInput
          style={[styles.input, styles.tall]}
          placeholder={t('writing.textPlaceholder')}
          placeholderTextColor={theme.textFaint}
          value={text}
          onChangeText={setText}
          multiline
          testID="writing-text"
        />
        <Button label={t('writing.review')} onPress={review} busy={busy} disabled={!text.trim()} />
      </Card>

      {items === null ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty title={t('writing.emptyTitle')} detail={t('writing.emptyDetail')} />
      ) : (
        items.map((s) => (
          <Card key={s.id}>
            <Text style={styles.name} onPress={() => router.push(`/writing/${s.id}`)}>
              {s.title || t(TYPE_LABEL[s.type])}
            </Text>
            <Text style={styles.meta}>
              {t(TYPE_LABEL[s.type])} · {t('writing.scored').replace('{n}', String(s.score))}
            </Text>
            <Button variant="ghost" label={t('writing.open')} onPress={() => router.push(`/writing/${s.id}`)} />
          </Card>
        ))
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  h1: { fontSize: 28, fontWeight: '700', color: theme.text },
  intro: { fontSize: 14, color: theme.textMuted, lineHeight: 20, marginBottom: 4 },
  label: { fontSize: 12, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  input: {
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: theme.text,
    marginBottom: 10,
  },
  tall: { minHeight: 140, textAlignVertical: 'top' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    color: theme.textMuted,
    fontSize: 13,
  },
  chipOn: { borderColor: theme.accent, color: theme.text, backgroundColor: theme.accent },
  name: { fontSize: 17, fontWeight: '700', color: theme.text },
  meta: { fontSize: 13, color: theme.textMuted, marginTop: 4, marginBottom: 8 },
});
