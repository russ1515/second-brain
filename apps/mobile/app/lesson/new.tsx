import { useEffect, useRef, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { LessonView } from '@second-brain/shared';
import { api } from '../../lib/client';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n } from '../../lib/i18n';
import { Button, ErrorBanner, Loading } from '../../components/ui';

/**
 * "The learner enters today's lesson." The plan names a concept; the teacher
 * writes the lesson on demand. This takes a while (the teacher also indexes it
 * into memory and builds flashcards), so the wait is explained rather than hidden.
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
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return; // StrictMode / re-render must not bill two lessons
    started.current = true;

    (async () => {
      try {
        const lesson = await api<LessonView>('/lessons', {
          method: 'POST',
          body: {
            ...(conceptId ? { conceptId } : {}),
            ...(topic ? { topic } : {}),
          },
        });
        router.replace(`/lesson/${lesson.id}`);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, [conceptId, topic, router]);

  if (error) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('common.backToday')} onPress={() => router.replace('/')} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{title ?? t('lessonNew.writing')}</Text>
      <Text style={styles.detail}>{t('lessonNew.detail')}</Text>
      <Loading />
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 960, width: '100%', alignSelf: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: c.textPrimary },
  detail: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
});
