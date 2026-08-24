import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import type {
  CardView,
  ComprehensionResult,
  DayPlan,
  HomeworkView,
  LessonExercise,
  LessonView,
  ReviewableView,
  SessionPlan,
  SessionReport,
} from '@second-brain/shared';
import { api } from '../lib/client';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n, type TranslationKey } from '../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../components/ui';
import { Markdown } from '../components/markdown';
import { ExerciseCard } from '../components/exercise-card';
import { SpeakButton } from '../components/speak-button';

interface Phase {
  key: string;
  icon: string;
  title: string;
  node: React.ReactNode;
}

/**
 * Daily Study Session (task 5.3) — the heart of the experience.
 *
 * One uninterrupted session, like a real classroom: welcome, objectives, FSRS
 * revision, lesson, questions, discussion, exercises, homework, correction,
 * quiz, summary, flashcards, the brain update and the next plan — all INLINE.
 * The learner never leaves the session; it composes the other engines.
 */
export default function DailySessionScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const router = useRouter();
  const [plan, setPlan] = useState<SessionPlan | null>(null);
  const [lesson, setLesson] = useState<LessonView | null>(null);
  const [cards, setCards] = useState<CardView[]>([]);
  const [homework, setHomework] = useState<HomeworkView | null>(null);
  const [due, setDue] = useState<ReviewableView[]>([]);
  const [report, setReport] = useState<SessionReport | null>(null);
  const [nextPlan, setNextPlan] = useState<DayPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);

  // Boot the session: start it, then load everything it needs — once.
  useEffect(() => {
    (async () => {
      try {
        const p = await api<SessionPlan>('/sessions/start', { method: 'POST', body: {} });
        setPlan(p);
        const [l, c, hw, d] = await Promise.allSettled([
          api<LessonView>(`/lessons/${p.lessonId}`),
          api<CardView[]>(`/lessons/${p.lessonId}/flashcards`),
          api<HomeworkView>(`/homework/lesson/${p.lessonId}`),
          api<ReviewableView[]>('/revision-engine/due'),
        ]);
        if (l.status === 'fulfilled') setLesson(l.value);
        if (c.status === 'fulfilled') setCards(c.value);
        if (hw.status === 'fulfilled') setHomework(hw.value);
        if (d.status === 'fulfilled') setDue(d.value);
      } catch (e) {
        setError((e as Error).message);
      }
    })();
  }, []);

  // Close the loop when the learner reaches the brain-update / planning steps.
  const finishBrain = useCallback(async () => {
    if (report || !plan) return;
    try {
      setReport(await api<SessionReport>(`/sessions/${plan.sessionId}/complete`, { method: 'POST' }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [report, plan]);
  const buildNextPlan = useCallback(async () => {
    if (nextPlan) return;
    try {
      setNextPlan(await api<DayPlan>('/planner/replan', { method: 'POST' }));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [nextPlan]);

  const phases: Phase[] = useMemo(() => {
    if (!lesson || !plan) return [];
    const p: Phase[] = [];
    const qcm = (homework?.exercises ?? []).filter((e) => e.type === 'qcm');

    p.push({
      key: 'welcome',
      icon: '👋',
      title: t('daily.p.welcome'),
      node: <Text style={styles.body}>{plan.planMessage}</Text>,
    });
    p.push({
      key: 'objectives',
      icon: '🎯',
      title: t('daily.p.objectives'),
      node: <Text style={styles.objective}>{lesson.objective}</Text>,
    });
    p.push({
      key: 'revision',
      icon: '🔁',
      title: t('daily.p.revision'),
      node: <Revision items={due} t={t} />,
    });
    p.push({
      key: 'lesson',
      icon: '📘',
      title: t('daily.p.lesson'),
      node: (
        <>
          <Markdown text={lesson.explanation} />
          <SpeakButton text={lesson.explanation} language={lesson.language ?? undefined} label={t('lesson.readAloud')} />
        </>
      ),
    });
    if (lesson.questions.length) {
      p.push({
        key: 'questions',
        icon: '🤔',
        title: t('daily.p.questions'),
        node: (
          <>
            <Text style={styles.muted}>{t('daily.checkIntro')}</Text>
            {lesson.questions.map((q, i) => (
              <ComprehensionCheck key={i} sessionId={plan.sessionId} index={i} question={q} t={t} />
            ))}
          </>
        ),
      });
    }
    p.push({
      key: 'discussion',
      icon: '💬',
      title: t('daily.p.discussion'),
      node: <Discussion conceptId={lesson.conceptId} title={plan.subject} t={t} />,
    });
    if (lesson.exercises.length) {
      p.push({
        key: 'exercises',
        icon: '✍️',
        title: t('daily.p.exercises'),
        node: lesson.exercises.map((e, i) => (
          <ExerciseCard key={i} attemptUrl={`/lessons/${lesson.id}/exercises/${i}/attempt`} index={i} exercise={e} />
        )),
      });
    }
    if (homework && homework.exercises.length) {
      p.push({
        key: 'homework',
        icon: '📝',
        title: t('daily.p.homework'),
        node: (
          <>
            <Text style={styles.focus}>{homework.focus}</Text>
            {homework.exercises.map((e, i) => (
              <ExerciseCard key={i} attemptUrl={`/homework/${homework.id}/exercises/${i}/attempt`} index={i} exercise={e} />
            ))}
          </>
        ),
      });
    }
    if (lesson.exercises.length) {
      p.push({
        key: 'correction',
        icon: '🔑',
        title: t('daily.p.correction'),
        node: <Corrections exercises={lesson.exercises} t={t} />,
      });
    }
    if (qcm.length) {
      p.push({
        key: 'quiz',
        icon: '❓',
        title: t('daily.p.quiz'),
        node: qcm.map((e, i) => {
          const idx = homework!.exercises.indexOf(e);
          return (
            <ExerciseCard key={i} attemptUrl={`/homework/${homework!.id}/exercises/${idx}/attempt`} index={idx} exercise={e} />
          );
        }),
      });
    }
    if (lesson.summary || lesson.keyPoints.length) {
      p.push({
        key: 'summary',
        icon: '📋',
        title: t('daily.p.summary'),
        node: (
          <>
            {lesson.summary ? <Markdown text={lesson.summary} /> : null}
            {lesson.keyPoints.map((k, i) => (
              <View key={i} style={styles.kp}><Text style={styles.kpCheck}>✓</Text><Text style={styles.kpText}>{k}</Text></View>
            ))}
          </>
        ),
      });
    }
    p.push({
      key: 'flashcards',
      icon: '🗂️',
      title: t('daily.p.flashcards'),
      node: cards.length
        ? cards.map((c) => <Flashcard key={c.id} card={c} t={t} />)
        : <Text style={styles.muted}>{t('lesson.noFlashcards')}</Text>,
    });
    p.push({
      key: 'brain',
      icon: '🧠',
      title: t('daily.p.brain'),
      node: <BrainUpdate report={report} t={t} />,
    });
    p.push({
      key: 'planning',
      icon: '🗓️',
      title: t('daily.p.planning'),
      node: <NextPlan plan={nextPlan} t={t} />,
    });
    return p;
  }, [lesson, plan, cards, homework, due, report, nextPlan, t]);

  if (error && !lesson) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
        <Button variant="ghost" label={t('session.home')} onPress={() => router.replace('/')} />
      </ScrollView>
    );
  }
  if (!phases.length) return <Loading label={t('daily.loading')} />;

  const total = phases.length;
  const clamped = Math.min(step, total - 1);
  const isLast = clamped === total - 1;
  const current = phases[clamped];

  const advance = () => {
    const next = clamped + 1;
    if (phases[next]?.key === 'brain') void finishBrain();
    if (phases[next]?.key === 'planning') void buildNextPlan();
    setStep(next);
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.masthead}>
          <Text style={styles.kicker}>🎓 {t('daily.title')}</Text>
          <Text style={styles.topic}>{plan?.subject}</Text>
        </View>
        <View style={styles.dots}>
          {phases.map((ph, i) => (
            <View key={ph.key} style={[styles.dot, i < clamped && styles.dotDone, i === clamped && styles.dotCur]} />
          ))}
        </View>
        <Text style={styles.progressLabel}>{t('lesson.step')} {clamped + 1} {t('lesson.of')} {total} · {current.title}</Text>
        {error ? <ErrorBanner message={error} /> : null}

        {/* All phases stay mounted; only the current shows, so answers survive. */}
        {phases.map((ph, i) => (
          <View key={ph.key} style={i === clamped ? undefined : styles.hidden}>
            <Card>
              <View style={styles.phaseHead}>
                <View style={styles.iconChip}><Text style={styles.iconChipText}>{ph.icon}</Text></View>
                <Text style={styles.phaseTitle}>{ph.title}</Text>
              </View>
              <View style={styles.phaseBody}>{ph.node}</View>
            </Card>
          </View>
        ))}
      </ScrollView>

      <View style={styles.nav}>
        {clamped > 0 ? (
          <View style={styles.flex}><Button variant="ghost" label={t('lesson.previous')} onPress={() => setStep(clamped - 1)} /></View>
        ) : <View style={styles.flex} />}
        <View style={styles.flex}>
          {isLast
            ? <Button label={t('lesson.finish')} onPress={() => router.replace('/')} />
            : <Button label={t('lesson.continue')} onPress={advance} />}
        </View>
      </View>
    </View>
  );
}

function Revision({ items, t }: { items: ReviewableView[]; t: (k: TranslationKey) => string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (items.length === 0) return <Text style={styles.muted}>{t('daily.noRevision')}</Text>;
  return (
    <>
      <Text style={styles.body}>{t('daily.revisionIntro')}</Text>
      {items.map((it) => (
        <View key={it.id} style={styles.revRow}>
          <Text style={styles.revTitle} numberOfLines={1}>{it.title}</Text>
          <Text style={styles.revMeta}>🧠 {it.memoryScore}%</Text>
        </View>
      ))}
    </>
  );
}

/** AI Teacher comprehension check (Sprint 7.1): the teacher asks, the student
 *  answers, and the teacher detects a misunderstanding + re-explains more simply
 *  when needed — the interactive "poser des questions / adapter le rythme" step. */
function ComprehensionCheck({
  sessionId,
  index,
  question,
  t,
}: {
  sessionId: string;
  index: number;
  question: string;
  t: (k: TranslationKey) => string;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState<ComprehensionResult | null>(null);
  const [busy, setBusy] = useState(false);

  const check = async () => {
    if (!answer.trim()) return;
    setBusy(true);
    try {
      setResult(
        await api<ComprehensionResult>(`/sessions/${sessionId}/comprehension`, {
          method: 'POST',
          body: { question, answer: answer.trim() },
        }),
      );
    } catch {
      // Best-effort: a check failure must not block the session.
    } finally {
      setBusy(false);
    }
  };

  const verdict = result?.verdict;
  const badge =
    verdict === 'understood'
      ? { icon: '✅', label: t('daily.check.understood'), color: c.success }
      : verdict === 'partial'
        ? { icon: '🟡', label: t('daily.check.partial'), color: c.warning }
        : { icon: '🔁', label: t('daily.check.confused'), color: c.error };

  return (
    <View style={styles.checkCard}>
      <Text style={styles.question}>{index + 1}. {question}</Text>
      <TextInput
        style={styles.checkInput}
        placeholder={t('daily.check.placeholder')}
        placeholderTextColor={c.textMuted}
        value={answer}
        onChangeText={setAnswer}
        multiline
      />
      <Button
        label={result ? t('daily.check.again') : t('daily.check.btn')}
        onPress={check}
        busy={busy}
        disabled={!answer.trim()}
      />
      {result ? (
        <View style={styles.checkResult}>
          <Text style={[styles.checkVerdict, { color: badge.color }]}>
            {badge.icon} {badge.label}
          </Text>
          {result.feedback ? <Text style={styles.body}>{result.feedback}</Text> : null}
          {result.reexplanation ? (
            <View style={styles.reexplain}>
              <Text style={styles.reexplainLabel}>👨‍🏫 {t('daily.check.reexplain')}</Text>
              <Text style={styles.body}>{result.reexplanation}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function Discussion({ conceptId, title, t }: { conceptId: string | null; title: string; t: (k: TranslationKey) => string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = async () => {
    setBusy(true);
    try {
      let sid = sessionId;
      if (!sid) {
        const s = await api<{ id: string }>('/tutor/sessions', {
          method: 'POST',
          body: { ...(conceptId ? { focusConceptId: conceptId } : { title }) },
        });
        sid = s.id;
        setSessionId(sid);
      }
      const r = await api<{ message: { content: string } }>(`/tutor/sessions/${sid}/messages`, {
        method: 'POST',
        body: { content: t('daily.askPrompt') },
      });
      setReply(r.message.content);
    } catch {
      setReply(t('daily.askError'));
    } finally {
      setBusy(false);
    }
  };
  return (
    <>
      <Text style={styles.body}>{t('daily.discussionIntro')}</Text>
      {reply ? <Text style={styles.teacherReply}>👨‍🏫 {reply}</Text> : null}
      <Button label={reply ? t('daily.askMore') : t('daily.ask')} onPress={ask} busy={busy} />
    </>
  );
}

function Corrections({ exercises, t }: { exercises: LessonExercise[]; t: (k: TranslationKey) => string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [shown, setShown] = useState(false);
  if (!shown) return <Button variant="ghost" label={t('lesson.showCorrections')} onPress={() => setShown(true)} />;
  return (
    <>
      {exercises.map((e, i) => (
        <View key={i} style={i > 0 ? styles.spaced : undefined}>
          <Text style={styles.question}>{i + 1}. {e.question}</Text>
          <Text style={styles.answerModel}>{e.answer}</Text>
        </View>
      ))}
    </>
  );
}

function Flashcard({ card, t }: { card: CardView; t: (k: TranslationKey) => string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button">
      <View style={styles.flashcard}>
        <Text style={styles.flashFront}>{card.front}</Text>
        {open ? <Text style={styles.flashBack}>{card.back}</Text> : <Text style={styles.flashHint}>{t('lesson.reveal')}</Text>}
      </View>
    </Pressable>
  );
}

function BrainUpdate({ report, t }: { report: SessionReport | null; t: (k: TranslationKey) => string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (!report) return <Loading label={t('session.closing')} />;
  const d = report.scoreDelta;
  return (
    <>
      <View style={styles.scoreRow}>
        <ScoreBlock label={t('session.before')} value={report.learningScoreBefore} />
        <Text style={styles.arrow}>→</Text>
        <ScoreBlock label={t('session.after')} value={report.learningScoreAfter} hi />
      </View>
      {d !== null ? (
        <Text style={[styles.delta, d >= 0 ? styles.up : styles.down]}>{d >= 0 ? '▲ +' : '▼ '}{d} {t('session.points')}</Text>
      ) : null}
      <Text style={styles.body}>🗂️ {report.cardsScheduled} {t('session.cardsScheduled')}</Text>
      <Text style={styles.body}>✍️ {report.exercisesCorrect}/{report.exercisesAttempted} {t('session.exercisesRight')}</Text>
    </>
  );
}

function ScoreBlock({ label, value, hi }: { label: string; value: number | null; hi?: boolean }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.scoreBlock}>
      <Text style={styles.scoreLabel}>{label}</Text>
      <Text style={[styles.scoreValue, hi && styles.scoreHi]}>{value === null ? '—' : value}</Text>
    </View>
  );
}

function NextPlan({ plan, t }: { plan: DayPlan | null; t: (k: TranslationKey) => string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  if (!plan) return <Loading label={t('plan.loading')} />;
  return (
    <>
      <Text style={styles.body}>{t('daily.planningIntro')}</Text>
      {plan.blocks.filter((b) => b.kind !== 'end').slice(0, 6).map((b, i) => (
        <View key={i} style={styles.planRow}>
          <Text style={styles.planTime}>{b.start}</Text>
          <Text style={styles.planKind}>{t(('plan.k.' + b.kind) as TranslationKey)}</Text>
        </View>
      ))}
    </>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
  container: { padding: 20, gap: 12, maxWidth: 960, width: '100%', alignSelf: 'center' },
  masthead: { gap: 4 },
  kicker: { fontSize: 13, fontWeight: '700', color: c.primary, textTransform: 'uppercase', letterSpacing: 1.2 },
  topic: { fontSize: 26, fontWeight: '800', color: c.textPrimary },
  dots: { flexDirection: 'row', gap: 4, flexWrap: 'wrap' },
  dot: { flex: 1, minWidth: 8, height: 5, borderRadius: 3, backgroundColor: c.border },
  dotDone: { backgroundColor: c.success },
  dotCur: { backgroundColor: c.primary },
  progressLabel: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
  phaseHead: { flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: 1, borderBottomColor: c.border, paddingBottom: 12 },
  iconChip: { width: 44, height: 44, borderRadius: 12, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  iconChipText: { fontSize: 22 },
  phaseTitle: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
  phaseBody: { marginTop: 14, gap: 12 },
  body: { fontSize: 16, color: c.textPrimary, lineHeight: 24 },
  objective: { fontSize: 17, fontWeight: '600', color: c.textPrimary, lineHeight: 25 },
  muted: { fontSize: 14, color: c.textSecondary },
  focus: { fontSize: 15, color: c.textPrimary, lineHeight: 22, fontStyle: 'italic' },
  question: { fontSize: 15, fontWeight: '600', color: c.textPrimary, lineHeight: 22, marginTop: 6 },
  checkCard: { backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12, gap: 10, marginTop: 8 },
  checkInput: { backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 10, fontSize: 15, color: c.textPrimary, minHeight: 56, textAlignVertical: 'top' },
  checkResult: { gap: 8 },
  checkVerdict: { fontSize: 14, fontWeight: '700' },
  reexplain: { backgroundColor: c.surfaceElevated, borderRadius: 10, padding: 10, gap: 4 },
  reexplainLabel: { fontSize: 12, fontWeight: '700', color: c.primary },
  answerModel: { fontSize: 14, color: c.success, lineHeight: 21, marginTop: 4 },
  spaced: { marginTop: 12 },
  kp: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  kpCheck: { fontSize: 15, fontWeight: '800', color: c.success, width: 18, textAlign: 'center' },
  kpText: { flex: 1, fontSize: 16, lineHeight: 24, color: c.textPrimary },
  revRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, backgroundColor: c.surfaceElevated, borderRadius: 8, padding: 10 },
  revTitle: { flex: 1, fontSize: 14, color: c.textPrimary, fontWeight: '600' },
  revMeta: { fontSize: 13, color: c.textSecondary },
  teacherReply: { fontSize: 15, color: c.textSecondary, lineHeight: 23, backgroundColor: c.surfaceElevated, borderRadius: 10, padding: 12 },
  flashcard: { backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.border, borderRadius: 10, padding: 14 },
  flashFront: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  flashBack: { fontSize: 14, color: c.textSecondary, marginTop: 8, lineHeight: 20 },
  flashHint: { fontSize: 12, color: c.textMuted, marginTop: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 16 },
  scoreBlock: { alignItems: 'center', gap: 2 },
  scoreLabel: { fontSize: 11, color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '700' },
  scoreValue: { fontSize: 34, fontWeight: '800', color: c.textSecondary },
  scoreHi: { color: c.textPrimary },
  arrow: { fontSize: 24, color: c.textMuted },
  delta: { textAlign: 'center', fontSize: 15, fontWeight: '700' },
  up: { color: c.success },
  down: { color: c.warning },
  planRow: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  planTime: { fontSize: 14, fontWeight: '800', color: c.textPrimary, width: 48 },
  planKind: { fontSize: 15, color: c.textPrimary },
  nav: {
    flexDirection: 'row', gap: 10, padding: 16, paddingBottom: 20,
    borderTopWidth: 1, borderTopColor: c.border, backgroundColor: c.background,
    maxWidth: 960, width: '100%', alignSelf: 'center',
  },
});
