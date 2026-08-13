import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import type { CardView, ReviewQueue, ReviewRating } from '@second-brain/shared';
import { api } from '../lib/client';
import { theme } from '../lib/theme';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, Empty, ErrorBanner, Loading } from '../components/ui';

/** Anki-style grades. The labels are the learner's honest self-report; FSRS
 *  turns them into the next due date. */
const GRADES: { rating: ReviewRating; key: TranslationKey; color: string }[] = [
  { rating: 1, key: 'revision.again', color: theme.danger },
  { rating: 2, key: 'revision.hard', color: theme.warn },
  { rating: 3, key: 'revision.good', color: theme.ok },
  { rating: 4, key: 'revision.easy', color: '#38BDF8' },
];

export default function RevisionScreen() {
  const { t } = useI18n();
  const router = useRouter();
  const [queue, setQueue] = useState<CardView[]>([]);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = await api<ReviewQueue>('/review/queue');
      setQueue(q.cards);
      setIndex(0);
      setRevealed(false);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const card = queue[index];

  const grade = async (rating: ReviewRating) => {
    if (!card) return;
    setBusy(true);
    try {
      await api(`/cards/${card.id}/review`, { method: 'POST', body: { rating } });
      setDone((d) => d + 1);
      setRevealed(false);
      setIndex((i) => i + 1);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading label={t('revision.loading')} />;

  if (error) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('common.backToday')} onPress={() => router.replace('/')} />
      </ScrollView>
    );
  }

  if (!card) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <Empty
          title={done > 0 ? t('revision.queueCleared') : t('revision.nothingDue')}
          detail={
            done > 0
              ? t('revision.clearedDetail').replace('{n}', String(done))
              : t('revision.nothingDetail')
          }
        />
        <Button variant="ghost" label={t('common.backToday')} onPress={() => router.replace('/')} />
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.counter} testID="counter">
        {t('revision.counter')
          .replace('{i}', String(index + 1))
          .replace('{total}', String(queue.length))
          .replace('{done}', String(done))}
      </Text>

      <Pressable onPress={() => setRevealed(true)} accessibilityRole="button">
        <Card style={styles.card}>
          <Text style={styles.front} testID="card-front">
            {card.front}
          </Text>

          {revealed ? (
            <>
              <View style={styles.divider} />
              <Text style={styles.back} testID="card-back">
                {card.back}
              </Text>
            </>
          ) : (
            <Text style={styles.tapHint}>{t('revision.tapReveal')}</Text>
          )}
        </Card>
      </Pressable>

      {revealed ? (
        <View style={styles.grades} testID="grades">
          {GRADES.map((g) => (
            <Pressable
              key={g.rating}
              onPress={() => grade(g.rating)}
              disabled={busy}
              accessibilityRole="button"
              style={[styles.grade, { borderColor: g.color }, busy && styles.gradeOff]}
              testID={`grade-${g.rating}`}
            >
              <Text style={[styles.gradeLabel, { color: g.color }]}>{t(g.key)}</Text>
            </Pressable>
          ))}
        </View>
      ) : (
        <Button label={t('revision.reveal')} onPress={() => setRevealed(true)} />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  counter: { fontSize: 13, color: theme.textFaint, textAlign: 'center' },
  card: { minHeight: 200, justifyContent: 'center' },
  front: { fontSize: 20, fontWeight: '600', color: theme.text, lineHeight: 28 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 16 },
  back: { fontSize: 17, color: '#CBD5E1', lineHeight: 25 },
  tapHint: { marginTop: 20, fontSize: 13, color: theme.textFaint, textAlign: 'center' },
  grades: { flexDirection: 'row', gap: 8 },
  grade: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  gradeOff: { opacity: 0.5 },
  gradeLabel: { fontSize: 15, fontWeight: '700' },
});
