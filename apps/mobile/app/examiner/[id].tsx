import { useCallback, useEffect, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  AssessmentSubmissionView,
  AssessmentView,
  GradedAnswer,
  LanguageMasteryDecision,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import {
  loadRlleCourse,
  markRlleAutonomyHelp,
  submitRlleAutonomy,
} from '../../lib/language-rll-client';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';
import { featureFlags } from '../../lib/feature-flags';

export default function AssessmentScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t, formatLocale } = useI18n();
  const params = useLocalSearchParams<{
    id: string;
    autonomy?: string;
    languageProfileId?: string;
    experienceSessionId?: string;
    lessonId?: string;
  }>();
  const { id } = params;
  const autonomy = featureFlags.languageMasteryV1
    && params.autonomy === '1'
    && Boolean(params.languageProfileId && params.experienceSessionId && params.lessonId);
  const router = useRouter();
  const [assessment, setAssessment] = useState<AssessmentView | null>(null);
  const [answers, setAnswers] = useState<string[]>([]);
  const [result, setResult] = useState<AssessmentSubmissionView | null>(null);
  const [masteryDecision, setMasteryDecision] = useState<LanguageMasteryDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const a = await api<AssessmentView>(`/examiner/${id}`);
      setAssessment(a);
      setAnswers(a.questions.map(() => ''));
      setResult(a.latestSubmission);
      if (autonomy && params.languageProfileId) {
        const loaded = await loadRlleCourse(params.languageProfileId);
        if (loaded.kind === 'live') {
          const attempt = loaded.course.milestoneMastery
            .flatMap((item) => item.attempts)
            .find((item) => item.assessmentId === id);
          setMasteryDecision(attempt?.decision ?? null);
        }
      }
    } catch (e) {
      setError((e as Error).message);
    }
  }, [autonomy, id, params.languageProfileId]);

  useEffect(() => {
    void load();
  }, [load]);

  const setAnswer = (i: number, v: string) =>
    setAnswers((prev) => prev.map((a, j) => (j === i ? v : a)));

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (autonomy && params.languageProfileId && params.experienceSessionId && params.lessonId) {
        const response = await submitRlleAutonomy(params.languageProfileId, {
          experienceSessionId: params.experienceSessionId,
          lessonId: params.lessonId,
          assessmentId: id,
          answers,
        });
        setResult(response.submission);
        setMasteryDecision(response.decision);
      } else {
        setResult(await api<AssessmentSubmissionView>(`/examiner/${id}/submit`, {
          method: 'POST',
          body: { answers },
        }));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const leaveForHelp = async () => {
    if (!autonomy || !params.languageProfileId || !params.experienceSessionId || !params.lessonId) return;
    setBusy(true);
    setError(null);
    try {
      await markRlleAutonomyHelp(params.languageProfileId, {
        experienceSessionId: params.experienceSessionId,
        lessonId: params.lessonId,
        assessmentId: id,
      });
      router.replace(`/languages/${params.languageProfileId}/course/lesson` as never);
    } catch (cause) {
      setError((cause as Error).message);
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

      {assessment?.teacherPolicy ? (
        <Card style={styles.rulesCard} testID="assessment-rules">
          <Text style={styles.rulesTitle}>{t('teacher.exam.rulesTitle')}</Text>
          <Text style={styles.rulesLine}>
            {t('teacher.exam.mode')} · {t(assessment.teacherPolicy.labelCode as TranslationKey)}
          </Text>
          <Text style={styles.rulesLine}>
            {t('teacher.exam.grading')} · {t('teacher.exam.rubric')}
          </Text>
          <Text style={styles.rulesLine}>
            {t('teacher.exam.help')} · {assessment.teacherPolicy.hintsAllowed
              ? t('teacher.exam.helpLimited')
              : t('teacher.exam.helpNone')}
          </Text>
          <Text style={styles.rulesDetail}>{t('teacher.exam.feedbackAfter')}</Text>
        </Card>
      ) : null}

      {autonomy && !result ? (
        <Card style={styles.rulesCard} testID="language-autonomy-rules">
          <Text style={styles.rulesTitle}>{t('teacher.exam.helpNone')}</Text>
          <Text style={styles.rulesDetail}>{t('rlle.ui.autonomy.notice' as TranslationKey)}</Text>
        </Card>
      ) : null}

      {result ? (
        <Card style={styles.scoreCard} testID="assessment-score">
          <Text style={styles.scoreBig}>
            {masteryDecision?.rawScore !== null && masteryDecision?.rawScore !== undefined
              ? `${new Intl.NumberFormat(formatLocale, { maximumFractionDigits: 1 }).format(masteryDecision.rawScore * 100)}/100`
              : `${result.score}/100`}
          </Text>
          {masteryDecision ? (
            <Text style={styles.rulesLine}>
              {t(`rlle.ui.autonomy.verdict.${masteryDecision.verdict}` as TranslationKey)}
            </Text>
          ) : null}
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
        <View style={styles.actions}>
          <Button
            label={t('examiner.submit')}
            onPress={submit}
            busy={busy}
            disabled={!allAnswered}
          />
          {autonomy ? (
            <Button
              variant="ghost"
              label={t('rlle.ui.autonomy.leaveForHelp' as TranslationKey)}
              onPress={() => void leaveForHelp()}
              disabled={busy}
            />
          ) : null}
        </View>
      ) : result.advice ? (
        <Card style={styles.adviceCard}>
          <Text style={styles.adviceLabel}>{t('examiner.next')}</Text>
          <Text style={styles.advice}>{result.advice}</Text>
        </Card>
      ) : null}

      <Button
        variant="ghost"
        label={t('examiner.back')}
        onPress={() => router.replace((
          autonomy && params.languageProfileId
            ? `/languages/${params.languageProfileId}/course/lesson`
            : '/examiner'
        ) as never)}
      />
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
  container: { padding: 20, gap: 12, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  title: { fontSize: 22, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: 13, color: c.textSecondary, textTransform: 'capitalize' },
  rulesCard: { gap: 5, borderColor: c.warning },
  rulesTitle: { fontSize: 16, fontWeight: '800', color: c.textPrimary },
  rulesLine: { fontSize: 13, fontWeight: '600', color: c.textPrimary },
  rulesDetail: { fontSize: 13, lineHeight: 19, color: c.textSecondary },
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
  actions: { gap: 8 },
});
