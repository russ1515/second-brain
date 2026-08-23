import { useCallback, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import type {
  LearningPath,
  LearningPathItem,
  LessonSummary,
  MasteryLevel,
  ProactiveBriefing,
  SessionPlan,
  TutorSessionDetail,
  TutorSessionSummary,
} from '@second-brain/shared';
import { useAuth } from '../../lib/auth-context';
import { api } from '../../lib/client';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { teacherRoleLabel } from '../../lib/teacher-role';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';

/** The teaching level a concept's session is pitched at (matches LessonService). */
const LEVEL_KEY: Record<MasteryLevel, TranslationKey> = {
  weak: 'level.beginner',
  unknown: 'level.beginner',
  developing: 'level.intermediate',
  strong: 'level.advanced',
};

/**
 * The AI Teacher — a virtual classroom, not a chat box.
 *
 * Instead of opening on a bare "ask a question" input, the teacher greets the
 * learner by name and frames the session from the twin's learning path: what to
 * work on today, and which weak prerequisite to review first. "Start the lesson"
 * is the primary move. The free discussion and history are kept below, so
 * nothing is lost — the feel changes, the capability does not.
 */
export default function AiTeacherScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { user } = useAuth();
  const { t, locale } = useI18n();
  const router = useRouter();
  const [sessions, setSessions] = useState<TutorSessionSummary[] | null>(null);
  const [path, setPath] = useState<LearningPath | null>(null);
  const [lastLesson, setLastLesson] = useState<LessonSummary | null>(null);
  const [coach, setCoach] = useState<ProactiveBriefing | null>(null);
  const [title, setTitle] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const [sessionsRes, pathRes, lessonsRes, coachRes] = await Promise.allSettled([
      api<TutorSessionSummary[]>('/tutor/sessions'),
      api<LearningPath>('/twin/next'),
      api<LessonSummary[]>('/lessons'),
      api<ProactiveBriefing>('/coach/today'),
    ]);
    if (sessionsRes.status === 'fulfilled') setSessions(sessionsRes.value);
    if (pathRes.status === 'fulfilled') setPath(pathRes.value);
    if (lessonsRes.status === 'fulfilled') setLastLesson(lessonsRes.value[0] ?? null);
    if (coachRes.status === 'fulfilled') setCoach(coachRes.value);
    if (sessionsRes.status === 'rejected' && pathRes.status === 'rejected') {
      setError((sessionsRes.reason as Error)?.message ?? 'Could not reach your teacher.');
    }
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const name = user?.displayName?.trim() || user?.email?.split('@')[0] || '';

  // The teacher's plan, read from the twin: revise what's slipping first, then
  // the next step forward.
  const subject: LearningPathItem | null =
    path?.items.find((i) => ['at_risk', 'in_progress', 'ready'].includes(i.status)) ?? null;
  const isReview = subject?.status === 'at_risk';
  const next: LearningPathItem | null =
    path?.items.find(
      (i) => ['ready', 'in_progress'].includes(i.status) && i.conceptId !== subject?.conceptId,
    ) ?? null;
  // Repair the weak concept before advancing (the twin's own pedagogy).
  const lessonTarget = subject;

  // Estimated time = the coach's time-boxed plan (real minutes), else a default.
  const duration =
    coach && coach.recommendations.length > 0
      ? coach.recommendations.reduce((s, r) => s + r.minutes, 0)
      : lessonTarget
        ? 20
        : 0;
  const levelKey = lessonTarget ? LEVEL_KEY[lessonTarget.level] : null;
  const objectiveKey: TranslationKey = isReview
    ? 'aiteacher.objReview'
    : 'aiteacher.objDiscover';

  const startLesson = () => {
    if (!lessonTarget) return;
    router.push({
      pathname: '/lesson/new',
      params: { conceptId: lessonTarget.conceptId, title: lessonTarget.name },
    });
  };

  // Session Orchestrator (task 3.7): one tap starts the whole guided loop — the
  // AI picks the target, builds the lesson, and drives it through to the recap.
  const startSession = async () => {
    setBusy(true);
    setError(null);
    try {
      const plan = await api<SessionPlan>('/sessions/start', {
        method: 'POST',
        body: lessonTarget?.conceptId ? { conceptId: lessonTarget.conceptId } : {},
      });
      router.push({
        pathname: '/session/[id]',
        params: {
          id: plan.sessionId,
          lessonId: plan.lessonId,
          subject: plan.subject,
          planMessage: plan.planMessage,
          minutes: String(plan.estimatedMinutes),
          scoreBefore: plan.learningScoreBefore == null ? '' : String(plan.learningScoreBefore),
        },
      });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const startDiscussion = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await api<TutorSessionSummary>('/tutor/sessions', {
        method: 'POST',
        body: { ...(title.trim() ? { title: title.trim() } : {}) },
      });
      setTitle('');
      router.push(`/tutor/${session.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const focus = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await api<TutorSessionDetail>('/tutor/sessions/focus', {
        method: 'POST',
      });
      router.push(`/tutor/${session.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  // Sprint 7.2: resume the relationship — a conversation that remembers what we
  // did recently and opens with a Socratic recall question.
  const resume = async () => {
    setBusy(true);
    setError(null);
    try {
      const session = await api<TutorSessionDetail>('/tutor/sessions/resume', {
        method: 'POST',
      });
      router.push(`/tutor/${session.id}`);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loading label={t('classroom.opening')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <ErrorBanner message={error} /> : null}

      {/* The teacher speaks first — a virtual classroom, not a chat. */}
      <View style={styles.stage}>
        <View style={styles.avatarRow}>
          <View style={styles.avatarBadge}>
            <Text style={styles.teacherAvatar}>👨‍🏫</Text>
          </View>
          <View style={styles.flex}>
            <Text style={styles.avatarKicker}>{t('header.aiTeacher')}</Text>
            <Text style={styles.greeting}>
              {t('home.greeting')} {name}.
            </Text>
          </View>
        </View>

        {/* Continuity — the learner never starts from zero. */}
        {lastLesson ? (
          <Text style={styles.line}>
            {t('aiteacher.finishedLesson')}{' '}
            <Text style={styles.subject}>{lastLesson.topic}</Text>.
          </Text>
        ) : null}

        {subject ? (
          <>
            <Text style={styles.line}>
              {isReview ? t('aiteacher.todayReview') : t('aiteacher.todayDiscover')}{' '}
              <Text style={styles.subject}>{subject.name}</Text>
              {isReview ? ` ${t('aiteacher.difficulties')}` : '.'}
            </Text>
            {next ? (
              <Text style={styles.line}>
                {t('aiteacher.thenNext')} <Text style={styles.subject}>{next.name}</Text>.
              </Text>
            ) : null}
          </>
        ) : (
          <Text style={styles.line}>{t('aiteacher.empty')}</Text>
        )}

        {/* Today's session, at a glance — objective, time, level. */}
        {lessonTarget ? (
          <View style={styles.sessionCard}>
            <Text style={styles.sessionHeader}>{t('aiteacher.sessionCard')}</Text>
            <Text style={styles.sessionCourse}>{lessonTarget.name}</Text>
            <SessionRow label={t('aiteacher.objective')} value={`${t(objectiveKey)} ${lessonTarget.name}`} />
            <SessionRow label={t('aiteacher.duration')} value={`${duration} ${t('aiteacher.minutes')}`} />
            {levelKey ? <SessionRow label={t('aiteacher.levelLabel')} value={t(levelKey)} /> : null}
          </View>
        ) : null}

        <View style={styles.cta}>
          {lessonTarget ? <Text style={styles.readyQ}>{t('aiteacher.readyQ')}</Text> : null}
          {/* One tap = the whole integrated classroom, never leaving (task 5.3). */}
          <Button label={t('daily.start')} onPress={() => router.push('/daily-session')} />
          <Button variant="ghost" label={t('session.startGuided')} onPress={startSession} busy={busy} />
          {lessonTarget ? (
            <Button variant="ghost" label={t('aiteacher.start')} onPress={startLesson} />
          ) : null}
        </View>
      </View>

      {/* Free discussion — kept, but no longer the first thing you see. */}
      <Card>
        <Text style={styles.label}>{t('aiteacher.talkTitle')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('aiteacher.topicPlaceholder')}
          placeholderTextColor={c.textMuted}
          value={title}
          onChangeText={setTitle}
          testID="session-title"
        />
        <Button label={t('aiteacher.talk')} onPress={startDiscussion} busy={busy} />
        <View style={styles.spacer} />
        <Button label={t('aiteacher.resume')} onPress={resume} busy={busy} />
        <View style={styles.spacer} />
        <Button variant="ghost" label={t('aiteacher.twinPick')} onPress={focus} busy={busy} />
      </Card>

      {/* History. */}
      {sessions && sessions.length > 0 ? (
        <View style={styles.history}>
          <Text style={styles.label}>{t('aiteacher.recent')}</Text>
          {sessions.map((s) => (
            <Card key={s.id}>
              <Text
                style={styles.sessionTitle}
                onPress={() => router.push(`/tutor/${s.id}`)}
              >
                {s.title ?? t('aiteacher.untitled')}
              </Text>
              <Text style={styles.sessionMeta}>
                {s.role.kind !== 'general' ? `${s.role.emoji} ${teacherRoleLabel(s.role, locale)} · ` : ''}
                {s.messageCount} {t('aiteacher.messages')}
                {s.focusConceptName ? ` · ${t('aiteacher.focusedOn')} ${s.focusConceptName}` : ''}
              </Text>
              <Button
                variant="ghost"
                label={t('aiteacher.open')}
                onPress={() => router.push(`/tutor/${s.id}`)}
              />
            </Card>
          ))}
        </View>
      ) : null}
    </ScrollView>
  );
}

/** One labelled fact in the "Today's session" card. */
function SessionRow({ label, value }: { label: string; value: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.sessionRow}>
      <Text style={styles.sessionRowLabel}>{label}</Text>
      <Text style={styles.sessionRowValue}>{value}</Text>
    </View>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 720, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  stage: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 16,
    padding: 22,
    gap: 12,
  },
  avatarRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarBadge: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  teacherAvatar: { fontSize: 34 },
  avatarKicker: {
    fontSize: 11,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  greeting: { fontSize: 24, fontWeight: '700', color: c.textPrimary },
  line: { fontSize: 17, color: '#CBD5E1', lineHeight: 26 },
  subject: { color: c.textPrimary, fontWeight: '700' },
  sessionCard: {
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    padding: 16,
    marginTop: 4,
    gap: 8,
  },
  sessionHeader: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sessionCourse: { fontSize: 20, fontWeight: '700', color: c.textPrimary },
  sessionRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: 8,
  },
  sessionRowLabel: { fontSize: 13, color: c.textSecondary },
  sessionRowValue: { fontSize: 14, color: c.textPrimary, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  cta: { marginTop: 8, gap: 8 },
  readyQ: { fontSize: 16, fontWeight: '700', color: c.textPrimary, textAlign: 'center' },
  label: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 10,
  },
  input: {
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 12,
    fontSize: 15,
    color: c.textPrimary,
    marginBottom: 10,
  },
  spacer: { height: 8 },
  history: { gap: 10 },
  sessionTitle: { fontSize: 16, fontWeight: '600', color: c.textPrimary },
  sessionMeta: { fontSize: 13, color: c.textSecondary, marginTop: 4, marginBottom: 8 },
});
