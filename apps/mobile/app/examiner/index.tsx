import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  ASSESSMENT_TYPES,
  type AssessmentSummary,
  type AssessmentType,
  type AssessmentView,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { theme } from '../../lib/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, Empty, ErrorBanner, Loading } from '../../components/ui';

const TYPE_LABEL: Record<AssessmentType, TranslationKey> = {
  mcq: 'examiner.t.mcq',
  open: 'examiner.t.open',
  dissertation: 'examiner.t.dissertation',
  exercise: 'examiner.t.exercise',
  case_study: 'examiner.t.case_study',
  mock_exam: 'examiner.t.mock_exam',
  oral: 'examiner.t.oral',
};

const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

export default function ExaminerScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [items, setItems] = useState<AssessmentSummary[] | null>(null);
  const [type, setType] = useState<AssessmentType>('mcq');
  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] =
    useState<(typeof DIFFICULTIES)[number]>('intermediate');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setItems(await api<AssessmentSummary[]>('/examiner'));
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
      const created = await api<AssessmentView>('/examiner', {
        method: 'POST',
        body: { type, topic: topic.trim(), difficulty },
      });
      setTopic('');
      router.push(`/examiner/${created.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.h1}>{t('examiner.title')}</Text>
      <Text style={styles.intro}>{t('examiner.intro')}</Text>

      {error ? <ErrorBanner message={error} /> : null}

      <Card>
        <Text style={styles.label}>{t('examiner.create')}</Text>
        <View style={styles.chips}>
          {ASSESSMENT_TYPES.map((tp) => (
            <Text
              key={tp}
              onPress={() => setType(tp)}
              style={[styles.chip, tp === type && styles.chipOn]}
              testID={`type-${tp}`}
            >
              {t(TYPE_LABEL[tp])}
            </Text>
          ))}
        </View>
        <TextInput
          style={styles.input}
          placeholder={t('examiner.topicPlaceholder')}
          placeholderTextColor={theme.textFaint}
          value={topic}
          onChangeText={setTopic}
          testID="topic"
        />
        <Text style={styles.hint}>{t('examiner.difficulty')}</Text>
        <View style={styles.chips}>
          {DIFFICULTIES.map((d) => (
            <Text
              key={d}
              onPress={() => setDifficulty(d)}
              style={[styles.chip, d === difficulty && styles.chipOn]}
            >
              {t(`level.${d}` as TranslationKey)}
            </Text>
          ))}
        </View>
        <Button
          label={t('examiner.createTake')}
          onPress={create}
          busy={busy}
          disabled={!topic.trim()}
        />
      </Card>

      {items === null ? (
        <Loading />
      ) : items.length === 0 ? (
        <Empty
          title={t('examiner.emptyTitle')}
          detail={t('examiner.emptyDetail')}
        />
      ) : (
        items.map((a) => (
          <Card key={a.id}>
            <Text style={styles.name} onPress={() => router.push(`/examiner/${a.id}`)}>
              {a.title}
            </Text>
            <Text style={styles.meta}>
              {t(TYPE_LABEL[a.type])} ·{' '}
              {t('examiner.questionsCount').replace('{n}', String(a.questionCount))}
              {a.score !== null
                ? ` · ${t('examiner.scored').replace('{n}', String(a.score))}`
                : ` · ${t('examiner.notTaken')}`}
            </Text>
            <Button
              variant="ghost"
              label={a.score !== null ? t('examiner.review') : t('examiner.take')}
              onPress={() => router.push(`/examiner/${a.id}`)}
            />
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
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: theme.textFaint,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  hint: { fontSize: 12, color: theme.textFaint, marginBottom: 6 },
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
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 12 },
  chip: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    color: theme.textMuted,
    fontSize: 13,
    textTransform: 'capitalize',
  },
  chipOn: { borderColor: theme.accent, color: theme.text, backgroundColor: theme.accent },
  name: { fontSize: 17, fontWeight: '700', color: theme.text },
  meta: { fontSize: 13, color: theme.textMuted, marginTop: 4, marginBottom: 8 },
});
