import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  AssessmentSubmissionView,
  AssessmentView,
  GradedAnswer,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';

export default function AssessmentScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [assessment, setAssessment] = useState<AssessmentView | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<AssessmentSubmissionView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const a = await api<AssessmentView>(`/examiner/${id}`);
      setAssessment(a);
      setAnswers(a.questions.map(() => ''));
      setResult(a.latestSubmission);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const setAnswer = (i: number, v: string) =>
    setAnswers((prev) => prev.map((a, j) => (j === i ? v : a)));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api<AssessmentSubmissionView>(`/examiner/${id}/submit`, {
          method: 'POST',
          body: { answers },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!assessment && !error) return <Loading />;

  const resultById = new Map<string, GradedAnswer>(
    (result?.results ?? []).map((r) => [r.questionId, r]),
  );
  const allAnswered = answers.every((a) => a.trim().length > 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <ErrorBanner message={error} /> : null}

      <Text style={styles.title}>{assessment?.title}</Text>
      {assessment?.level ? (
        <Text style={styles.meta}>
          {assessment.level} {t('examiner.levelWord')}
        </Text>
      ) : null}

      {result ? (
        <Card style={styles.scoreCard} testID="assessment-score">
          <Text style={styles.scoreBig}>{result.score}/100</Text>
          {result.summary ? <Text style={styles.summary}>{result.summary}</Text> : null}
        </Card>
      ) : null}

      {assessment?.questions.map((q, i) => {
        const r = resultById.get(q.id);
        return (
          <Card key={q.id} style={r ? verdictStyle(r.verdict, c) : undefined}>
            <Text style={styles.qHead}>
              {t('examiner.question')} {i + 1} ·{' '}
              {t('examiner.points').replace('{n}', String(q.points))}
              {r ? `  ·  ${r.awarded}/${r.max}` : ''}
            </Text>
            <Text style={styles.prompt}>{q.prompt}</Text>

            {q.format === 'mcq' && q.options ? (
              <View style={styles.options}>
                {q.options.map((opt) => (
                  <Text
                    key={opt}
                    onPress={result ? undefined : () => setAnswer(i, opt)}
                    style={[styles.option, answers[i] === opt && styles.optionOn]}
                  >
                    {opt}
                  </Text>
                ))}
              </View>
            ) : (
              <TextInput
                style={[styles.input, styles.tall]}
                placeholder={t('examiner.yourAnswer')}
                placeholderTextColor={c.textMuted}
                value={answers[i]}
                onChangeText={(v) => setAnswer(i, v)}
                editable={!result}
                multiline
              />
            )}

            {r ? (
              <View style={styles.feedback}>
                <Text style={[styles.verdict, verdictText(r.verdict, c)]}>
                  {t(`verdict.${r.verdict}` as TranslationKey)}
                </Text>
                {r.why ? <Text style={styles.fbLine}><Text style={styles.fbLabel}>{t('examiner.why')}</Text>{r.why}</Text> : null}
                {r.how ? <Text style={styles.fbLine}><Text style={styles.fbLabel}>{t('examiner.how')}</Text>{r.how}</Text> : null}
                {r.errorMade ? <Text style={styles.fbLine}><Text style={styles.fbLabel}>{t('examiner.mistake')}</Text>{r.errorMade}</Text> : null}
                {r.howToAvoid ? <Text style={styles.fbLine}><Text style={styles.fbLabel}>{t('examiner.avoid')}</Text>{r.howToAvoid}</Text> : null}
              </View>
            ) : null}
          </Card>
        );
      })}

      {!result ? (
        <Button
          label={t('examiner.submit')}
          onPress={submit}
          busy={busy}
          disabled={!allAnswered}
        />
      ) : result.advice ? (
        <Card style={styles.adviceCard}>
          <Text style={styles.adviceLabel}>{t('examiner.next')}</Text>
          <Text style={styles.advice}>{result.advice}</Text>
        </Card>
      ) : null}

      <Button variant="ghost" label={t('examiner.back')} onPress={() => router.replace('/examiner')} />
    </ScrollView>
  );
}

function verdictStyle(v: GradedAnswer['verdict'], c: ColorScale) {
  return v === 'correct'
    ? { borderColor: c.success }
    : v === 'partial'
      ? { borderColor: c.warning }
      : { borderColor: c.error };
}
function verdictText(v: GradedAnswer['verdict'], c: ColorScale) {
  return v === 'correct'
    ? { color: c.success }
    : v === 'partial'
      ? { color: c.warning }
      : { color: c.error };
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: 13, color: c.textSecondary, textTransform: 'capitalize' },
  scoreCard: { alignItems: 'center', gap: 6, borderColor: c.primary },
  scoreBig: { fontSize: 34, fontWeight: '800', color: c.textPrimary },
  summary: { fontSize: 14, color: c.textPrimary, lineHeight: 20, textAlign: 'center' },
  qHead: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  prompt: { fontSize: 15, color: c.textPrimary, lineHeight: 21, marginBottom: 10 },
  options: { gap: 8 },
  option: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: c.textSecondary,
    fontSize: 14,
  },
  optionOn: { borderColor: c.primary, color: c.textPrimary, backgroundColor: c.surfaceElevated },
  input: {
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: c.textPrimary,
  },
  tall: { minHeight: 90, textAlignVertical: 'top' },
  feedback: { marginTop: 10, gap: 4, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8 },
  verdict: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  fbLine: { fontSize: 13, color: c.textSecondary, lineHeight: 19 },
  fbLabel: { color: c.textPrimary, fontWeight: '700' },
  adviceCard: { borderColor: c.primary, gap: 6 },
  adviceLabel: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  advice: { fontSize: 14, color: c.textPrimary, lineHeight: 20 },
});
