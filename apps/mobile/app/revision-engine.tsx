import { useCallback, useEffect, useState, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { ReviewableKind, ReviewableView, ReviewPriority } from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, ErrorBanner, Loading } from '../components/ui';

const KIND_ICON: Record<ReviewableKind, string> = {
  lesson: '📘',
  exercise: '✍️',
  quiz: '❓',
  language: '🗣️',
  practical: '🔬',
  homework: '📝',
  report: '🎓',
  flashcard: '🎴',
  concept: '🎯',
};

const priorityColor = (c: ColorScale): Record<ReviewPriority, string> => ({
  urgent: c.error,
  high: c.warning,
  medium: c.primary,
  low: c.success,
});

const GRADES: { rating: 1 | 2 | 3 | 4; key: TranslationKey }[] = [
  { rating: 1, key: 'revEng.again' },
  { rating: 2, key: 'revEng.hard' },
  { rating: 3, key: 'revEng.good' },
  { rating: 4, key: 'revEng.easy' },
];

/**
 * FSRS Revision Engine — the universal review queue (task 5.1).
 *
 * One queue for EVERY kind of activity — lessons, exercises, quizzes, homework,
 * languages, reports — each scheduled by the same independent FSRS engine and
 * shown with its memory score, priority, urgency and next date.
 */
export default function RevisionEngineScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [items, setItems] = useState<ReviewableView[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setItems(await api<ReviewableView[]>('/revision-engine/queue'));
      setError(null);
    } catch (e) {
      setError((e as Error).message);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const grade = async (id: string, rating: 1 | 2 | 3 | 4) => {
    setBusy(id);
    try {
      await api<ReviewableView>(`/revision-engine/${id}/review`, {
        method: 'POST',
        body: { rating },
      });
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  if (error && !items) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!items) return <Loading label={t('revEng.loading')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>🧬 {t('revEng.title')}</Text>
        <Text style={styles.intro}>{t('revEng.intro')}</Text>
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {items.length === 0 ? (
        <Text style={styles.empty}>{t('revEng.empty')}</Text>
      ) : (
        items.map((it) => (
          <View key={it.id} style={styles.card}>
            <View style={styles.head}>
              <Text style={styles.icon}>{KIND_ICON[it.kind]}</Text>
              <View style={styles.headBody}>
                <Text style={styles.title} numberOfLines={2}>
                  {it.title}
                </Text>
                <View style={styles.metaRow}>
                  <Text style={styles.meta}>
                    🧠 {it.memoryScore}% · {t('revEng.next')} {formatDue(it, t)}
                  </Text>
                  <View style={[styles.prio, { borderColor: priorityColor(c)[it.priority] }]}>
                    <Text style={[styles.prioText, { color: priorityColor(c)[it.priority] }]}>
                      {t(PRIO_KEY[it.priority])}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <View style={styles.grades}>
              {GRADES.map((g) => (
                <Pressable
                  key={g.rating}
                  style={[styles.grade, busy === it.id && styles.gradeOff]}
                  disabled={busy === it.id}
                  onPress={() => grade(it.id, g.rating)}
                  accessibilityRole="button"
                >
                  <Text style={styles.gradeText}>{t(g.key)}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        ))
      )}

      <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
    </ScrollView>
  );
}

const PRIO_KEY: Record<ReviewPriority, TranslationKey> = {
  urgent: 'mastery.prio.urgent',
  high: 'mastery.prio.high',
  medium: 'mastery.prio.medium',
  low: 'mastery.prio.low',
};

function formatDue(it: ReviewableView, t: (k: TranslationKey) => string): string {
  if (it.due) return t('revEng.now');
  const days = Math.ceil((new Date(it.nextReview).getTime() - Date.now()) / 86_400_000);
  if (days <= 0) return t('revEng.now');
  if (days === 1) return t('revEng.tomorrow');
  return `${days} ${t('revEng.days')}`;
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 960, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4, marginBottom: 2 },
  kicker: {
    fontSize: 13,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
  },
  intro: { fontSize: 15, color: c.textSecondary, lineHeight: 21 },
  empty: { fontSize: 14, color: c.textSecondary },
  card: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 14,
    gap: 12,
  },
  head: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  icon: { fontSize: 24 },
  headBody: { flex: 1, gap: 6 },
  title: { fontSize: 15, fontWeight: '700', color: c.textPrimary, lineHeight: 20 },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  meta: { flex: 1, fontSize: 12, color: c.textSecondary },
  prio: { borderWidth: 1, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  prioText: { fontSize: 11, fontWeight: '700' },
  grades: { flexDirection: 'row', gap: 8 },
  grade: {
    flex: 1,
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
  },
  gradeOff: { opacity: 0.5 },
  gradeText: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
});
