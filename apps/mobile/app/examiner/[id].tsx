import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  AssessmentSubmissionView,
  AssessmentView,
  GradedAnswer,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { theme } from '../../lib/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';

export default function AssessmentScreen() {
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
          <Card key={q.id} style={r ? verdictStyle(r.verdict) : undefined}>
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
                placeholderTextColor={theme.textFaint}
                value={answers[i]}
                onChangeText={(v) => setAnswer(i, v)}
                editable={!result}
                multiline
              />
            )}

            {r ? (
              <View style={styles.feedback}>
                <Text style={[styles.verdict, verdictText(r.verdict)]}>
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

function verdictStyle(v: GradedAnswer['verdict']) {
  return v === 'correct'
    ? { borderColor: theme.ok }
    : v === 'partial'
      ? { borderColor: theme.warn }
      : { borderColor: '#EF4444' };
}
function verdictText(v: GradedAnswer['verdict']) {
  return v === 'correct'
    ? { color: theme.ok }
    : v === 'partial'
      ? { color: theme.warn }
      : { color: '#FECACA' };
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 12, maxWidth: 720, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: theme.text },
  meta: { fontSize: 13, color: theme.textMuted, textTransform: 'capitalize' },
  scoreCard: { alignItems: 'center', gap: 6, borderColor: theme.accent },
  scoreBig: { fontSize: 34, fontWeight: '800', color: theme.text },
  summary: { fontSize: 14, color: theme.text, lineHeight: 20, textAlign: 'center' },
  qHead: { fontSize: 12, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 6 },
  prompt: { fontSize: 15, color: theme.text, lineHeight: 21, marginBottom: 10 },
  options: { gap: 8 },
  option: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    color: theme.textMuted,
    fontSize: 14,
  },
  optionOn: { borderColor: theme.accent, color: theme.text, backgroundColor: theme.surfaceAlt },
  input: {
    backgroundColor: theme.surfaceAlt,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: theme.text,
  },
  tall: { minHeight: 90, textAlignVertical: 'top' },
  feedback: { marginTop: 10, gap: 4, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 8 },
  verdict: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  fbLine: { fontSize: 13, color: theme.textMuted, lineHeight: 19 },
  fbLabel: { color: theme.text, fontWeight: '700' },
  adviceCard: { borderColor: theme.accent, gap: 6 },
  adviceLabel: { fontSize: 12, fontWeight: '700', color: theme.textFaint, textTransform: 'uppercase', letterSpacing: 1 },
  advice: { fontSize: 14, color: theme.text, lineHeight: 20 },
});
