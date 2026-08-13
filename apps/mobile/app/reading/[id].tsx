import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  GradedAnswer,
  ReadingExerciseView,
  ReadingResultView,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { theme } from '../../lib/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';

export default function ReadingExerciseScreen() {
  const { t } = useI18n();
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [ex, setEx] = useState<ReadingExerciseView | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<ReadingResultView | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const e = await api<ReadingExerciseView>(`/reading/${id}`);
      setEx(e);
      setAnswers(e.questions.map(() => ''));
      setResult(e.latestResult);
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
        await api<ReadingResultView>(`/reading/${id}/submit`, {
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

  if (!ex && !error) return <Loading />;

  const byId = new Map<string, GradedAnswer>(
    (result?.results ?? []).map((r) => [r.questionId, r]),
  );
  const allAnswered = answers.every((a) => a.trim().length > 0);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <ErrorBanner message={error} /> : null}

      <Text style={styles.title}>{ex?.title}</Text>
      <Text style={styles.meta}>
        {ex ? t(`reading.lvl.${ex.level}` as TranslationKey) : ''} {t('reading.levelWord')}
      </Text>

      {result ? (
        <Card style={styles.scoreCard}>
          <Text style={styles.scoreBig}>{result.score}/100</Text>
          {result.summary ? <Text style={styles.summary}>{result.summary}</Text> : null}
          <Text style={styles.levelChange}>
            {result.levelChange === 'up'
              ? t('reading.levelUp')
                  .replace('{from}', t(`reading.lvl.${result.previousLevel}` as TranslationKey))
                  .replace('{to}', t(`reading.lvl.${result.newLevel}` as TranslationKey))
              : result.levelChange === 'down'
                ? t('reading.levelDown')
                    .replace('{from}', t(`reading.lvl.${result.previousLevel}` as TranslationKey))
                    .replace('{to}', t(`reading.lvl.${result.newLevel}` as TranslationKey))
                : t('reading.levelHeld').replace(
                    '{to}',
                    t(`reading.lvl.${result.newLevel}` as TranslationKey),
                  )}
          </Text>
        </Card>
      ) : null}

      <Card style={styles.passageCard}>
        <Text style={styles.passage}>{ex?.text}</Text>
      </Card>

      {ex?.questions.map((q, i) => {
        const r = byId.get(q.id);
        return (
          <Card key={q.id} style={r ? verdictStyle(r.verdict) : undefined}>
            <Text style={styles.qHead}>
              {t('reading.question')} {i + 1}
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
                placeholder={t('reading.yourAnswer')}
                placeholderTextColor={theme.textFaint}
                value={answers[i]}
                onChangeText={(v) => setAnswer(i, v)}
                editable={!result}
                multiline
              />
            )}

            {r ? (
              <View style={styles.feedback}>
                <Text style={[styles.verdict, verdictText(r.verdict)]}>{t(`verdict.${r.verdict}` as TranslationKey)}</Text>
                {r.why ? <Text style={styles.fbLine}>{r.why}</Text> : null}
                {r.errorMade ? <Text style={styles.fbLine}><Text style={styles.fbLabel}>{t('reading.mistake')}</Text>{r.errorMade}</Text> : null}
                {r.howToAvoid ? <Text style={styles.fbLine}><Text style={styles.fbLabel}>{t('reading.avoid')}</Text>{r.howToAvoid}</Text> : null}
              </View>
            ) : null}
          </Card>
        );
      })}

      {!result ? (
        <Button label={t('reading.submit')} onPress={submit} busy={busy} disabled={!allAnswered} />
      ) : null}

      <Button variant="ghost" label={t('reading.back')} onPress={() => router.replace('/reading')} />
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
  levelChange: { fontSize: 14, fontWeight: '700', color: theme.accent, textTransform: 'capitalize' },
  passageCard: { backgroundColor: theme.surfaceAlt },
  passage: { fontSize: 15, color: theme.text, lineHeight: 23 },
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
  optionOn: { borderColor: theme.accent, color: theme.text, backgroundColor: theme.surface },
  input: {
    backgroundColor: theme.surface,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: theme.text,
  },
  tall: { minHeight: 80, textAlignVertical: 'top' },
  feedback: { marginTop: 10, gap: 4, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 8 },
  verdict: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  fbLine: { fontSize: 13, color: theme.textMuted, lineHeight: 19 },
  fbLabel: { color: theme.text, fontWeight: '700' },
});
