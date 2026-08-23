import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { HomeworkView, LessonExercise } from '@second-brain/shared';
import { api } from '../../lib/client';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n } from '../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';
import { ExerciseCard } from '../../components/exercise-card';

/**
 * Personalised homework for a lesson (Homework Engine, task 3.5).
 *
 * Generated lazily by the API on first open, adapted to the learner's Digital
 * Twin (ConceptMastery) and grounded in their Learning Memory. The flow follows
 * the spec: Devoirs (why) → Exercices → Questions → Correction.
 */
export default function HomeworkScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const router = useRouter();
  const { t } = useI18n();
  const [homework, setHomework] = useState<HomeworkView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const hw = await api<HomeworkView>(`/homework/lesson/${lessonId}`);
      setHomework(hw);
      setError(null); // a later success must clear an earlier transient error
    } catch (e) {
      setError((e as Error).message);
    }
  }, [lessonId]);

  useEffect(() => {
    void load();
  }, [load]);

  const regenerate = async () => {
    setBusy(true);
    setError(null);
    try {
      setHomework(
        await api<HomeworkView>(`/homework/lesson/${lessonId}/regenerate`, {
          method: 'POST',
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (error && !homework) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('app.tryAgain')} onPress={() => void load()} />
      </ScrollView>
    );
  }
  if (!homework) return <Loading label={t('homework.preparing')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.masthead}>
        <Text style={styles.kicker}>{t('homework.title')}</Text>
        <Text style={styles.topic}>{homework.topic}</Text>
      </View>

      {/* Devoirs — why this homework, and the level it was adapted to. */}
      <View style={styles.focusBanner}>
        <Text style={styles.focusLabel}>🎯 {t('homework.focusLabel')}</Text>
        <Text style={styles.focusText}>{homework.focus}</Text>
        {homework.masteryAtGeneration !== null ? (
          <View style={styles.masteryChip}>
            <Text style={styles.masteryChipText}>
              {t('homework.masteryAt')} {homework.masteryAtGeneration}%
            </Text>
          </View>
        ) : null}
      </View>

      {error ? <ErrorBanner message={error} /> : null}

      {/* Exercices */}
      <Section icon="✍️" title={t('homework.exercises')} />
      {homework.exercises.map((exercise, index) => (
        <ExerciseCard
          key={index}
          attemptUrl={`/homework/${homework.id}/exercises/${index}/attempt`}
          index={index}
          exercise={exercise}
        />
      ))}

      {/* Questions */}
      {homework.questions.length > 0 ? (
        <>
          <Section icon="🤔" title={t('homework.questions')} />
          <Card>
            <Text style={styles.reflect}>{t('homework.reflect')}</Text>
            {homework.questions.map((q, i) => (
              <Text key={i} style={styles.question}>
                {i + 1}. {q}
              </Text>
            ))}
          </Card>
        </>
      ) : null}

      {/* Correction — the model answers, revealed on demand. */}
      <Section icon="🔑" title={t('homework.correction')} />
      <Card>
        <Corrections exercises={homework.exercises} />
      </Card>

      <View style={styles.actions}>
        <Button label={t('homework.regenerate')} onPress={regenerate} busy={busy} />
        <Text style={styles.hint}>{t('homework.regenHint')}</Text>
        <Button variant="ghost" label={t('homework.back')} onPress={() => router.back()} />
      </View>
    </ScrollView>
  );
}

/** A textbook-style section divider — mirrors the lesson's look. */
function Section({ icon, title }: { icon: string; title: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.section}>
      <View style={styles.iconChip}>
        <Text style={styles.iconChipText}>{icon}</Text>
      </View>
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

/** The model answers, revealed on demand. */
function Corrections({ exercises }: { exercises: LessonExercise[] }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  if (!shown) {
    return (
      <Button
        variant="ghost"
        label={t('homework.showAnswers')}
        onPress={() => setShown(true)}
      />
    );
  }
  return (
    <>
      {exercises.map((e, i) => (
        <View key={i} style={i > 0 ? styles.spaced : undefined}>
          <Text style={styles.question}>
            {i + 1}. {e.question}
          </Text>
          <Text style={styles.answerModel}>{e.answer}</Text>
        </View>
      ))}
      <Button
        variant="ghost"
        label={t('homework.hideAnswers')}
        onPress={() => setShown(false)}
      />
    </>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  topic: { fontSize: 26, fontWeight: '800', color: c.textPrimary, lineHeight: 32 },
  focusBanner: {
    backgroundColor: c.surfaceElevated,
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
    borderRadius: 10,
    padding: 14,
    gap: 8,
  },
  focusLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  focusText: { fontSize: 16, color: c.textPrimary, lineHeight: 24 },
  masteryChip: {
    alignSelf: 'flex-start',
    backgroundColor: c.surface,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  masteryChipText: { fontSize: 12, color: c.textSecondary, fontWeight: '600' },
  section: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 6 },
  iconChip: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: c.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipText: { fontSize: 20 },
  sectionTitle: { fontSize: 19, fontWeight: '700', color: c.textPrimary },
  reflect: { fontSize: 13, color: c.textMuted, fontStyle: 'italic', marginBottom: 4 },
  question: { fontSize: 15, fontWeight: '600', color: c.textPrimary, lineHeight: 22, marginTop: 6 },
  answerModel: { fontSize: 14, color: c.success, lineHeight: 21, marginTop: 4 },
  spaced: { marginTop: 12 },
  actions: { gap: 8, marginTop: 8 },
  hint: { fontSize: 12, color: c.textMuted, textAlign: 'center' },
});
