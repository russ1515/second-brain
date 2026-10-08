import { useCallback, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { LessonView } from '@second-brain/shared';
import { api } from '../../lib/client';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n } from '../../lib/i18n';
import { Button, Card, ErrorBanner } from '../../components/ui';

/**
 * "The learner enters today's lesson."
 *
 * Two ways in. When a concept or topic is named (from My Brain, a plan, a deep
 * link), the teacher writes that lesson on demand — a wait, explained rather
 * than hidden. When nothing is named (the "Teach me" mode from Learn), we don't
 * silently pick for the learner: we ask what they want taught, then create it.
 */
export default function NewLessonScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { conceptId, topic, title } = useLocalSearchParams<{
    conceptId?: string;
    topic?: string;
    title?: string;
  }>();
  const router = useRouter();
  const { t } = useI18n();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [subject, setSubject] = useState(topic ?? '');
  const [objective, setObjective] = useState('');

  const create = useCallback(
    async (body: Record<string, string>) => {
      setBusy(true);
      try {
        const lesson = await api<LessonView>('/lessons', { method: 'POST', body });
        router.replace(`/lesson/${lesson.id}`);
      } catch (e) {
        setError((e as Error).message);
        setBusy(false);
      }
    },
    [router],
  );

  if (error) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('common.backToday')} onPress={() => router.replace('/')} />
      </ScrollView>
    );
  }

  const ready = Boolean(conceptId || subject.trim()) && objective.trim().length > 0;
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kicker}>👨‍🏫 {t('teach.kicker')}</Text>
      <Text style={styles.title}>{title ?? t('teach.title')}</Text>
      <Text style={styles.detail}>{t('teach.subtitle')}</Text>
      <Card style={styles.card}>
        {!conceptId ? (
          <TextInput
            style={styles.input}
            value={subject}
            onChangeText={setSubject}
            placeholder={t('teach.placeholder')}
            placeholderTextColor={c.textMuted}
            multiline
            editable={!busy}
          />
        ) : null}
        <Text style={styles.label}>{t('lesson.objectiveLabel')}</Text>
        <TextInput
          style={styles.input}
          value={objective}
          onChangeText={setObjective}
          placeholder={t('goals.placeholder')}
          placeholderTextColor={c.textMuted}
          multiline
          editable={!busy}
          testID="lesson-goal-input"
        />
        <Button
          label={t('teach.submit')}
          busy={busy}
          disabled={!ready}
          onPress={() => create({
            ...(conceptId ? { conceptId } : { topic: subject.trim() }),
            goalTitle: objective.trim(),
            goalPeriod: 'weekly',
          })}
        />
      </Card>
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  kicker: { fontSize: 13, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', color: c.aiAccent },
  title: { fontSize: 24, fontWeight: '700', color: c.textPrimary },
  detail: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  card: { gap: 14, marginTop: 4 },
  label: { fontSize: 14, fontWeight: '700', color: c.textPrimary },
  input: {
    minHeight: 88,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 14,
    padding: 14,
    fontSize: 16,
    color: c.textPrimary,
    backgroundColor: c.surfaceSunken,
    textAlignVertical: 'top',
  },
});
