import { useState, useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import type { LessonExercise, SubmitAttemptResponse } from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner } from './ui';

const TYPE_KEY: Record<NonNullable<LessonExercise['type']>, TranslationKey> = {
  qcm: 'exercise.qcm',
  open: 'exercise.open',
  exercise: 'exercise.exercise',
  case: 'exercise.case',
};

/**
 * One exercise of any type — answered by the learner and marked by the Examiner.
 * Shared by lessons and homework: `attemptUrl` is the endpoint the answer POSTs
 * to (`/lessons/:id/exercises/:i/attempt` or `/homework/:id/exercises/:i/attempt`),
 * so the same rich, structured correction UI serves both.
 */
export function ExerciseCard({
  attemptUrl,
  index,
  exercise,
}: {
  attemptUrl: string;
  index: number;
  exercise: LessonExercise;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<SubmitAttemptResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const type = exercise.type ?? 'exercise';
  const isQcm = type === 'qcm' && (exercise.options?.length ?? 0) >= 2;

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api<SubmitAttemptResponse>(attemptUrl, {
          method: 'POST',
          body: { answer },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const a = result?.attempt;

  return (
    <Card style={styles.exercise}>
      <View style={styles.typeBadge}>
        <Text style={styles.typeBadgeText}>{t(TYPE_KEY[type])}</Text>
      </View>
      <Text style={styles.question} testID={`question-${index}`}>
        {index + 1}. {exercise.question}
      </Text>

      {isQcm ? (
        <View style={styles.options}>
          {exercise.options!.map((opt, i) => {
            const selected = answer === opt;
            return (
              <Pressable
                key={i}
                onPress={() => setAnswer(opt)}
                disabled={busy}
                accessibilityRole="button"
                style={[styles.option, selected && styles.optionOn]}
                testID={`option-${index}-${i}`}
              >
                <Text style={[styles.optionText, selected && styles.optionTextOn]}>{opt}</Text>
              </Pressable>
            );
          })}
        </View>
      ) : (
        <TextInput
          style={styles.answer}
          placeholder={t('lesson.yourAnswer')}
          placeholderTextColor={c.textMuted}
          value={answer}
          onChangeText={setAnswer}
          multiline
          editable={!busy}
          testID={`answer-${index}`}
        />
      )}

      {error ? <ErrorBanner message={error} /> : null}

      <Button
        label={result ? t('lesson.answerAgain') : t('lesson.submit')}
        onPress={submit}
        busy={busy}
        disabled={!answer.trim()}
      />

      {a ? (
        <View style={styles.verdict} testID={`verdict-${index}`}>
          <Text style={[styles.verdictHead, a.correct ? styles.ok : styles.wrong]}>
            {a.correct ? t('lesson.correct') : t('lesson.notQuite')} · {Math.round(a.score * 100)}%
          </Text>

          {/* A real teacher's correction — never a bare correct/incorrect. */}
          <Label t="lesson.why" />
          <Text style={styles.body}>{a.why}</Text>

          {a.how ? (
            <>
              <Label t="lesson.how" />
              <Text style={styles.body}>{a.how}</Text>
            </>
          ) : null}

          {a.errorMade ? (
            <>
              <Label t="lesson.errorMade" />
              <Text style={styles.body}>{a.errorMade}</Text>
            </>
          ) : null}

          {a.howToAvoid ? (
            <>
              <Label t="lesson.howToAvoid" />
              <Text style={styles.body}>{a.howToAvoid}</Text>
            </>
          ) : null}

          <Label t="lesson.feedback" />
          <Text style={styles.body}>{a.feedback}</Text>

          {result?.rootCause ? (
            <View style={styles.gap} testID={`root-cause-${index}`}>
              <Text style={styles.gapTitle}>
                {t('lesson.rootCause')}: {result.rootCause.name}
              </Text>
              <Text style={styles.gapDetail}>{result.rootCause.reason}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </Card>
  );
}

function Label({ t: key }: { t: TranslationKey }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  return <Text style={styles.label}>{t(key)}</Text>;
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 4,
  },
  body: { fontSize: 15, color: '#CBD5E1', lineHeight: 23 },
  question: { fontSize: 15, fontWeight: '600', color: c.textPrimary, lineHeight: 22, marginTop: 6 },
  exercise: { gap: 10 },
  typeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: c.surfaceElevated,
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  typeBadgeText: {
    fontSize: 10,
    color: c.primary,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  options: { gap: 8 },
  option: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 12,
    backgroundColor: c.surfaceElevated,
  },
  optionOn: { borderColor: c.primary, backgroundColor: c.primary },
  optionText: { fontSize: 15, color: c.textPrimary },
  optionTextOn: { color: c.onPrimary, fontWeight: '600' },
  answer: {
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 72,
    fontSize: 15,
    color: c.textPrimary,
    textAlignVertical: 'top',
  },
  verdict: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  verdictHead: { fontSize: 15, fontWeight: '700' },
  ok: { color: c.success },
  wrong: { color: c.error },
  gap: {
    marginTop: 12,
    backgroundColor: c.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: c.warning,
  },
  gapTitle: { color: c.warning, fontWeight: '700', fontSize: 14 },
  gapDetail: { color: c.textSecondary, fontSize: 14, marginTop: 4, lineHeight: 20 },
});
