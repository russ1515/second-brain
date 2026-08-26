import { useCallback, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import type { StudyResource, StudyResourceType } from '@second-brain/shared';
import { api } from '../../../lib/client';
import { useTokens } from '../../../lib/design/theme';
import type { ColorScale } from '../../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../../components/ui';
import { Markdown } from '../../../components/markdown';

const RESOURCE_KEY: Record<StudyResourceType, TranslationKey> = {
  summary: 'lib.r.summary',
  revision_sheet: 'lib.r.revisionSheet',
  flashcards: 'lib.r.flashcards',
  quiz: 'lib.r.quiz',
  exercises: 'lib.r.exercises',
  open_questions: 'lib.r.openQuestions',
  course_plan: 'lib.r.coursePlan',
};

/** Reader for a saved study resource (Sprint 6.6). Flashcards link into the
 *  FSRS review queue; everything else renders its markdown. */
export default function ResourceScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { t } = useI18n();
  const router = useRouter();
  const [res, setRes] = useState<StudyResource | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setRes(await api<StudyResource>(`/library/resources/${id}`));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const remove = async () => {
    setBusy(true);
    try {
      await api<void>(`/library/resources/${id}`, { method: 'DELETE' });
      router.back();
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  if (error && !res) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!res) return <Loading label={t('lib.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.kind}>📦 {t(RESOURCE_KEY[res.type])}</Text>
      <Text style={styles.title}>{res.title}</Text>

      {error ? <ErrorBanner message={error} /> : null}

      {res.type === 'flashcards' ? (
        <Card style={styles.card}>
          <Text style={styles.body}>{res.content}</Text>
          <Button label={t('lib.r.review')} onPress={() => router.push('/revision')} />
        </Card>
      ) : (
        <Card style={styles.card}>
          <Markdown text={res.content} />
        </Card>
      )}

      <Button label={t('lib.deleteForever')} variant="danger" busy={busy} onPress={remove} />
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  kind: { fontSize: 12, fontWeight: '700', color: c.primary, textTransform: 'uppercase', letterSpacing: 1 },
  title: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
  card: { gap: 10 },
  body: { fontSize: 15, color: c.textPrimary, lineHeight: 22 },
});
