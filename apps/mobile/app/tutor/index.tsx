import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  ContextItem,
  TutorSessionDetail,
  TutorSessionSummary,
  VoiceTurnResponse,
} from '@second-brain/shared';
import { useAuth } from '../../lib/auth-context';
import { api, apiUpload } from '../../lib/client';
import { createRecorder, RECORDING_SUPPORTED, type Recorder } from '../../lib/recorder';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { saveTutorSessionDraft } from '../../lib/tutor/session-draft';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';

/**
 * The AI Teacher — a virtual classroom, not a chat box.
 *
 * Instead of opening on a bare "ask a question" input, the teacher greets the
 * learner by name and frames the session from the twin's learning path: what to
 * work on today, and which weak prerequisite to review first. "Start the lesson"
 * is the primary move. The free discussion and history are kept below, so
 * nothing is lost — the feel changes, the capability does not.
 */
/** Modes that legitimately route to /tutor. Not-yet-specialized ones fall back
 *  to the teacher home; only Free Search has its own workspace so far. */
const TUTOR_MODES = new Set(['free', 'free_search', 'explain', 'discuss', 'oral_exercise', 'deepsearch']);

/**
 * Entry point for /tutor — dispatches on the `?mode=` param so a specialised
 * experience opens directly, instead of every sub-feature landing on the same
 * generic teacher greeting. An unknown mode shows a localised error (never a
 * blank page); no mode (or a known-but-not-yet-specialised one) keeps the
 * teacher home.
 */
export default function TutorEntry() {
  const params = useLocalSearchParams<{
    mode?: string | string[];
    q?: string | string[];
    conceptId?: string | string[];
    conceptName?: string | string[];
    docId?: string | string[];
    documentId?: string | string[];
    title?: string | string[];
    goalId?: string | string[];
    goalTitle?: string | string[];
    examId?: string | string[];
    examTitle?: string | string[];
    languageProfileId?: string | string[];
    languageName?: string | string[];
    sourceSessionId?: string | string[];
    workspaceId?: string | string[];
    workspaceTitle?: string | string[];
    researchSessionId?: string | string[];
  }>();
  const mode = Array.isArray(params.mode) ? params.mode[0] : params.mode;
  const initialQuery = Array.isArray(params.q) ? params.q[0] : params.q;
  const focusConceptId = Array.isArray(params.conceptId) ? params.conceptId[0] : params.conceptId;
  const contexts = tutorContextsFromParams(params);
  if (mode === 'free' || mode === 'free_search') return <FreeSearch initialQuery={initialQuery} initialContexts={contexts} />;
  if (mode === 'deepsearch' || mode === 'deep_research') return <DeepResearch initialQuery={initialQuery} initialContexts={contexts} />;
  if (mode === 'oral_exercise') return <OralExercise />;
  if (mode === 'explain') return <Explain initialQuery={initialQuery} focusConceptId={focusConceptId} initialContexts={contexts} />;
  if (mode === 'discuss' || mode === 'chat_tutor') return <Discuss initialQuery={initialQuery} initialContexts={contexts} />;
  if (mode === 'oral_exam') return <OralExam />;
  if (mode && !TUTOR_MODES.has(mode)) return <ModeError />;
  return <TeacherHome />;
}

function tutorContextsFromParams(params: Record<string, string | string[] | undefined>): ContextItem[] {
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const now = new Date().toISOString();
  const contexts: ContextItem[] = [];
  const push = (kind: ContextItem['kind'], referenceId: string | undefined, label?: string) => {
    if (!referenceId) return;
    contexts.push({
      id: `${kind}:${referenceId}`,
      kind,
      scope: kind === 'document' || kind === 'concept' ? 'active-object' : 'experience-session',
      referenceId,
      ...(label ? { label } : {}),
      priority: kind === 'document' ? 90 : kind === 'concept' ? 80 : 60,
      visibility: 'visible',
      addedAt: now,
    });
  };
  push('document', first(params.documentId) ?? first(params.docId), first(params.title));
  push('concept', first(params.conceptId), first(params.conceptName));
  push('goal', first(params.goalId), first(params.goalTitle));
  push('exam', first(params.examId), first(params.examTitle));
  push('language', first(params.languageProfileId), first(params.languageName));
  push('revision', first(params.sourceSessionId));
  push('workspace', first(params.workspaceId), first(params.workspaceTitle));
  push('research', first(params.researchSessionId));
  return contexts;
}

/** Lot 6 lobby: continuity first, one new-request focal point, then bounded
 * history and the existing specialist modes as secondary doors. */
function TeacherHome() {
  const { colors: c, spacing, typography, radius } = useTokens();
  const { t, locale } = useI18n();
  const { user } = useAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<TutorSessionSummary[] | null>(null);
  const [request, setRequest] = useState('');
  const [pendingSessionId, setPendingSessionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setError(null);
    try {
      setSessions(await api<TutorSessionSummary[]>('/tutor/sessions'));
    } catch (loadError) {
      setError((loadError as Error).message);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const start = async () => {
    const content = request.trim();
    if (!content) return;
    setBusy(true);
    setError(null);
    let targetSessionId = pendingSessionId;
    try {
      if (!targetSessionId) {
        const session = await api<TutorSessionSummary>('/tutor/sessions', {
          method: 'POST',
          body: {
            title: content.slice(0, 120),
            objective: content.slice(0, 500),
            intent: 'free',
            mode: 'conversation',
            inputModality: 'text',
          },
        });
        targetSessionId = session.id;
        setPendingSessionId(targetSessionId);
      }
      await api(`/tutor/sessions/${targetSessionId}/messages`, {
        method: 'POST',
        body: { content },
      });
      setRequest('');
      setPendingSessionId(null);
      router.push(`/tutor/${targetSessionId}`);
    } catch (startError) {
      if (targetSessionId && user?.id) {
        await saveTutorSessionDraft(user.id, targetSessionId, content).catch(() => undefined);
      }
      setError((startError as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!sessions && !error) return <Loading label={t('tutor6.lobby.loading')} />;

  const list = sessions ?? [];
  const resumable = list.find((session) => {
    const status = session.experienceSession?.status;
    return status === 'active' || status === 'paused';
  }) ?? null;
  const recent = list.filter((session) => session.id !== resumable?.id && session.experienceSession?.status !== 'completed').slice(0, 3);
  const completed = list.filter((session) => session.experienceSession?.status === 'completed').slice(0, 3);

  const historyCard = (session: TutorSessionSummary) => {
    const context = session.experienceSession?.activeContexts.items.find((item) => item.visibility !== 'hidden');
    return (
      <Card key={session.id}>
        <Text style={[typography.title, { color: c.textPrimary }]}>{session.title ?? t('aiteacher.untitled')}</Text>
        <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
          {new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(session.updatedAt))}
          {' · '}{session.messageCount} {t('aiteacher.messages')}
          {session.subject ? ` · ${session.subject}` : ''}
          {context?.label ? ` · ${context.label}` : ''}
        </Text>
        {session.experienceSession?.progress?.percent !== undefined ? (
          <Text style={[typography.caption, { color: c.textMuted }]}>{session.experienceSession.progress.percent}%</Text>
        ) : null}
        <Button variant="ghost" label={t('tutor6.lobby.resume')} onPress={() => router.push(`/tutor/${session.id}`)} />
      </Card>
    );
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: c.background }} contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ padding: spacing.lg, gap: spacing.xl, width: '100%', maxWidth: 1120, alignSelf: 'center' }} testID="tutor-lobby">
        <View style={{ gap: spacing.xs, maxWidth: 760 }}>
          <Text style={[typography.label, { color: c.aiAccent }]}>{t('tutor6.lobby.eyebrow')}</Text>
          <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary }]}>{t('tutor6.lobby.title')}</Text>
          <Text style={[typography.body, { color: c.textSecondary }]}>{t('tutor6.lobby.subtitle')}</Text>
        </View>

        {error ? (
          <View style={{ gap: spacing.sm }}>
            <ErrorBanner message={error} />
            {pendingSessionId ? (
              <Button variant="ghost" label={t('tutor6.lobby.openSaved')} onPress={() => router.push(`/tutor/${pendingSessionId}`)} />
            ) : null}
          </View>
        ) : null}

        {resumable ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.h2, { color: c.textPrimary }]}>{t('tutor6.lobby.continueTitle')}</Text>
            <Card style={{ borderColor: c.aiAccent, gap: spacing.sm }}>
              <Text style={[typography.title, { color: c.textPrimary }]}>{resumable.title ?? t('aiteacher.untitled')}</Text>
              <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
                {resumable.experienceSession?.currentStep?.label ?? t('tutor6.lobby.resumeDetail')}
              </Text>
              <Button label={t('tutor6.lobby.resume')} onPress={() => router.push(`/tutor/${resumable.id}`)} />
            </Card>
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.h2, { color: c.textPrimary }]}>{t('tutor6.lobby.newTitle')}</Text>
          <Card style={{ gap: spacing.sm }}>
            <TextInput
              value={request}
              onChangeText={setRequest}
              placeholder={t('tutor6.lobby.placeholder')}
              placeholderTextColor={c.textMuted}
              multiline
              maxLength={4_000}
              testID="tutor-new-request"
              style={{ minHeight: 84, borderWidth: 1, borderColor: c.border, borderRadius: radius.md, padding: spacing.md, color: c.textPrimary, textAlignVertical: 'top' }}
            />
            <Button label={t('tutor6.lobby.start')} onPress={() => void start()} disabled={!request.trim()} busy={busy} />
          </Card>
        </View>

        {recent.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.h2, { color: c.textPrimary }]}>{t('tutor6.lobby.recent')}</Text>
            {recent.map(historyCard)}
          </View>
        ) : null}

        {completed.length > 0 ? (
          <View style={{ gap: spacing.sm }}>
            <Text style={[typography.h2, { color: c.textPrimary }]}>{t('tutor6.lobby.completed')}</Text>
            {completed.map(historyCard)}
          </View>
        ) : null}

        <View style={{ gap: spacing.sm }}>
          <Text style={[typography.h2, { color: c.textPrimary }]}>{t('tutor6.lobby.modes')}</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <Button variant="ghost" label={t('tutor6.lobby.mode.explain')} onPress={() => router.push('/tutor?mode=explain')} />
            <Button variant="ghost" label={t('tutor6.lobby.mode.discuss')} onPress={() => router.push('/tutor?mode=discuss')} />
            <Button variant="ghost" label={t('tutor6.lobby.mode.oral')} onPress={() => router.push('/tutor?mode=oral_exercise')} />
            <Button variant="ghost" label={t('tutor6.lobby.mode.deep')} onPress={() => router.push('/tutor?mode=deepsearch')} />
          </View>
        </View>
      </View>
    </ScrollView>
  );
}

/** Shared "← Back to Learn" row for the specialised mode workspaces. */
function BackToLearn() {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const router = useRouter();
  return (
    <Pressable onPress={() => router.push('/learn')} accessibilityRole="button" style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 44, alignSelf: 'flex-start' }}>
      <Text style={{ color: c.textSecondary, fontSize: 15, fontWeight: '600' }}>← {t('learn.backToLearn')}</Text>
    </Pressable>
  );
}

/**
 * A focused question workspace — the shared shell behind Free Search and Deep
 * Research. It reuses the tutor session API: the first question creates a
 * general session (optionally framed by `framePrefixKey` so the professor gives
 * a deeper, structured answer) and opens the existing conversation view. No new
 * chat system, and no fabricated sources/plan — an honest `noteKey` states when
 * a richer capability still depends on the backend.
 */
function QuestionWorkspace({ icon, kickerKey, titleKey, subtitleKey, placeholderKey, submitKey, framePrefixKey, noteKey, initialQuery = '', mode, intent, initialContexts = [] }: {
  icon: string;
  kickerKey: TranslationKey;
  titleKey: TranslationKey;
  subtitleKey: TranslationKey;
  placeholderKey: TranslationKey;
  submitKey: TranslationKey;
  framePrefixKey?: TranslationKey;
  noteKey?: TranslationKey;
  initialQuery?: string;
  mode: string;
  intent: string;
  initialContexts?: ContextItem[];
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    setError(null);
    try {
      const document = initialContexts.find((item) => item.kind === 'document' && item.referenceId);
      const goal = initialContexts.find((item) => item.kind === 'goal' && item.referenceId);
      const language = initialContexts.find((item) => item.kind === 'language' && item.referenceId);
      const session = await api<TutorSessionSummary>('/tutor/sessions', {
        method: 'POST',
        body: {
          title: question.slice(0, 120),
          objective: question.slice(0, 500),
          mode,
          intent,
          inputModality: 'text',
          activeContexts: initialContexts,
          ...(document?.referenceId ? { documentId: document.referenceId } : {}),
          ...(goal?.referenceId ? { goalId: goal.referenceId } : {}),
          ...(language?.referenceId ? { languageProfileId: language.referenceId } : {}),
        },
      });
      const content = framePrefixKey ? `${t(framePrefixKey)}\n\n${question}` : question;
      await api(`/tutor/sessions/${session.id}/messages`, { method: 'POST', body: { content } });
      router.push(`/tutor/${session.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackToLearn />
      <View style={styles.freeHead}>
        <Text style={styles.freeKicker}>{icon} {t(kickerKey)}</Text>
        <Text style={styles.freeTitle}>{t(titleKey)}</Text>
        <Text style={styles.freeSub}>{t(subtitleKey)}</Text>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <Card>
        <TextInput
          style={[styles.input, styles.freeInput]}
          placeholder={t(placeholderKey)}
          placeholderTextColor={c.textMuted}
          value={q}
          onChangeText={setQ}
          multiline
          autoFocus
        />
        <Button label={t(submitKey)} onPress={ask} busy={busy} disabled={!q.trim()} />
      </Card>
      {noteKey ? <Text style={styles.freeNote}>{t(noteKey)}</Text> : null}
    </ScrollView>
  );
}

/** 🔎 Free Search (mode=free) — spontaneous questions, distinct from the teacher. */
function FreeSearch({ initialQuery, initialContexts }: { initialQuery?: string; initialContexts?: ContextItem[] }) {
  return (
    <QuestionWorkspace
      icon="🔎"
      kickerKey="learn.free.kicker"
      titleKey="learn.free.title"
      subtitleKey="learn.free.subtitle"
      placeholderKey="learn.free.placeholder"
      submitKey="learn.free.submit"
      initialQuery={initialQuery}
      initialContexts={initialContexts}
      mode="free"
      intent="free"
    />
  );
}

/** 🔬 Deep Research (mode=deepsearch) — a thorough, structured investigation. */
function DeepResearch({ initialQuery, initialContexts }: { initialQuery?: string; initialContexts?: ContextItem[] }) {
  return (
    <QuestionWorkspace
      icon="🔬"
      kickerKey="learn.deep.kicker"
      titleKey="learn.deep.title"
      subtitleKey="learn.deep.subtitle"
      placeholderKey="learn.deep.placeholder"
      submitKey="learn.deep.submit"
      framePrefixKey="learn.deep.frame"
      noteKey="learn.deep.note"
      initialQuery={initialQuery}
      initialContexts={initialContexts}
      mode="deepsearch"
      intent="research"
    />
  );
}

/** 💬 Conversation (mode=discuss/chat_tutor) — a free pedagogical conversation
 *  with the teacher (who keeps the learner's context), distinct from Free Search. */
function Discuss({ initialQuery, initialContexts }: { initialQuery?: string; initialContexts?: ContextItem[] }) {
  return (
    <QuestionWorkspace
      icon="💬"
      kickerKey="learn.discuss.kicker"
      titleKey="learn.discuss.title"
      subtitleKey="learn.discuss.subtitle"
      placeholderKey="learn.discuss.placeholder"
      submitKey="learn.discuss.submit"
      initialQuery={initialQuery}
      initialContexts={initialContexts}
      mode="conversation"
      intent="learn"
    />
  );
}

const EXPLAIN_LEVELS: TranslationKey[] = ['learn.explain.lvlBeginner', 'learn.explain.lvlIntermediate', 'learn.explain.lvlAdvanced'];

/**
 * 💡 Explain (mode=explain) — a comprehension workspace: a concept + a level
 * (Beginner / Intermediate / Advanced) that frames the request so the teacher
 * explains at the right depth with examples and analogies. Reuses the tutor API.
 */
function Explain({ initialQuery = '', focusConceptId, initialContexts = [] }: { initialQuery?: string; focusConceptId?: string; initialContexts?: ContextItem[] }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const router = useRouter();
  const [q, setQ] = useState(initialQuery);
  const [level, setLevel] = useState(1);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ask = async () => {
    const question = q.trim();
    if (!question || busy) return;
    setBusy(true);
    setError(null);
    try {
      const s = await api<TutorSessionSummary>('/tutor/sessions', {
        method: 'POST',
        body: {
          title: question.slice(0, 120),
          objective: question.slice(0, 500),
          intent: 'understand',
          mode: 'explain',
          inputModality: 'text',
          activeContexts: initialContexts,
          ...(focusConceptId ? { focusConceptId } : {}),
          ...(initialContexts.find((item) => item.kind === 'document')?.referenceId
            ? { documentId: initialContexts.find((item) => item.kind === 'document')?.referenceId }
            : {}),
          ...(initialContexts.find((item) => item.kind === 'goal')?.referenceId
            ? { goalId: initialContexts.find((item) => item.kind === 'goal')?.referenceId }
            : {}),
        },
      });
      const content = `${t('learn.explain.frame')} (${t(EXPLAIN_LEVELS[level])})\n\n${question}`;
      await api(`/tutor/sessions/${s.id}/messages`, { method: 'POST', body: { content } });
      router.push(`/tutor/${s.id}`);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackToLearn />
      <View style={styles.freeHead}>
        <Text style={styles.freeKicker}>💡 {t('learn.explain.kicker')}</Text>
        <Text style={styles.freeTitle}>{t('learn.explain.title')}</Text>
        <Text style={styles.freeSub}>{t('learn.explain.subtitle')}</Text>
      </View>
      {error ? <ErrorBanner message={error} /> : null}
      <Card>
        <Text style={styles.levelLabel}>{t('learn.explain.levelLabel')}</Text>
        <View style={styles.levelRow}>
          {EXPLAIN_LEVELS.map((lv, i) => {
            const on = i === level;
            return (
              <Pressable key={lv} onPress={() => setLevel(i)} accessibilityRole="button" accessibilityState={{ selected: on }} style={[styles.levelPill, on && styles.levelPillOn]}>
                <Text style={[styles.levelPillText, on && styles.levelPillTextOn]}>{t(lv)}</Text>
              </Pressable>
            );
          })}
        </View>
        <TextInput
          style={[styles.input, styles.freeInput]}
          placeholder={t('learn.explain.placeholder')}
          placeholderTextColor={c.textMuted}
          value={q}
          onChangeText={setQ}
          multiline
          autoFocus
        />
        <Button label={t('learn.explain.submit')} onPress={ask} busy={busy} disabled={!q.trim()} />
      </Card>
    </ScrollView>
  );
}

/**
 * 🎙️ Oral Exercise (mode=oral_exercise) — a Voice Studio. The professor asks a
 * question; the learner answers out loud. Reuses the existing recorder and the
 * tutor /voice endpoint (transcript + spoken reply) — no parallel audio system.
 * Honest states (Ready / Listening / Analyzing) and no fabricated pronunciation
 * scores, since the backend returns only a transcript and the teacher's reply.
 */
function OralExercise() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<{ role: 'teacher' | 'you'; text: string }[]>([]);
  const [status, setStatus] = useState<'init' | 'ready' | 'recording' | 'analyzing'>('init');
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<Recorder | null>(null);

  const refresh = useCallback(async (sid: string) => {
    const detail = await api<TutorSessionDetail>(`/tutor/sessions/${sid}`);
    // Drop the synthetic framing turn (the first user message) from the view.
    setTurns(
      detail.messages
        .slice(1)
        .map((m) => ({ role: (m.role === 'assistant' ? 'teacher' : 'you') as 'teacher' | 'you', text: m.content }))
        .filter((x) => x.text.trim()),
    );
  }, []);

  useEffect(() => {
    let cancel = false;
    (async () => {
      try {
        const s = await api<TutorSessionSummary>('/tutor/sessions', {
          method: 'POST',
          body: { objective: t('learn.oral.title'), intent: 'practice', mode: 'oral_exercise', inputModality: 'voice' },
        });
        if (cancel) return;
        setSessionId(s.id);
        await api(`/tutor/sessions/${s.id}/messages`, { method: 'POST', body: { content: t('learn.oral.frame') } });
        if (cancel) return;
        await refresh(s.id);
        if (!cancel) setStatus('ready');
      } catch (e) {
        if (!cancel) { setError((e as Error).message); setStatus('ready'); }
      }
    })();
    return () => { cancel = true; };
  }, [refresh, t]);

  const stopAndSend = async () => {
    if (!recorder.current || !sessionId) return;
    setStatus('analyzing');
    try {
      const { blob, mimeType } = await recorder.current.stop();
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const form = new FormData();
      form.append('audio', blob, `turn.${ext}`);
      await apiUpload<VoiceTurnResponse>(`/tutor/sessions/${sessionId}/voice`, form);
      await refresh(sessionId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      recorder.current = null;
      setStatus('ready');
    }
  };

  const toggleRecord = async () => {
    if (status === 'analyzing' || status === 'init') return;
    if (status === 'recording') { await stopAndSend(); return; }
    if (!sessionId) return;
    setError(null);
    try {
      recorder.current = createRecorder();
      await recorder.current.start();
      setStatus('recording');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const statusKey: TranslationKey =
    status === 'recording' ? 'learn.oral.recording'
    : status === 'analyzing' ? 'learn.oral.analyzing'
    : status === 'init' ? 'learn.oral.starting'
    : 'learn.oral.ready';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackToLearn />
      <View style={styles.freeHead}>
        <Text style={styles.freeKicker}>🎙️ {t('learn.oral.kicker')}</Text>
        <Text style={styles.freeTitle}>{t('learn.oral.title')}</Text>
        <Text style={styles.freeSub}>{t('learn.oral.subtitle')}</Text>
      </View>
      {error ? <ErrorBanner message={error} /> : null}

      {!RECORDING_SUPPORTED ? (
        <Card><Text style={styles.freeSub}>{t('learn.oral.noVoice')}</Text></Card>
      ) : (
        <>
          {turns.map((turn, i) => (
            <View key={i} style={turn.role === 'you' ? styles.youBubble : styles.teacherBubble}>
              <Text style={styles.bubbleWho}>{turn.role === 'you' ? t('learn.oral.you') : t('learn.oral.teacher')}</Text>
              <Text style={styles.bubbleText}>{turn.text}</Text>
            </View>
          ))}

          <Card style={styles.studio}>
            <View style={[styles.statusPill, status === 'recording' && { borderColor: c.error }, status === 'analyzing' && { borderColor: c.primary }]}>
              <Text style={styles.statusText}>{t(statusKey)}</Text>
            </View>
            <Pressable
              onPress={toggleRecord}
              disabled={status === 'init' || status === 'analyzing'}
              accessibilityRole="button"
              accessibilityLabel={t(status === 'recording' ? 'learn.oral.stop' : 'learn.oral.record')}
              style={[styles.micButton, status === 'recording' && { backgroundColor: c.error, borderColor: c.error }, (status === 'init' || status === 'analyzing') && { opacity: 0.6 }]}
            >
              <Text style={styles.micIcon}>{status === 'recording' ? '⏹' : '🎙️'}</Text>
            </Pressable>
            <Text style={styles.micLabel}>{t(status === 'recording' ? 'learn.oral.stop' : 'learn.oral.record')}</Text>
          </Card>
        </>
      )}
    </ScrollView>
  );
}

/**
 * 🎓 Oral Exam (mode=oral_exam) — a voice exam simulation. The professor becomes
 * an examiner: before → a framed start; during → a running client-side timer,
 * the examiner's questions and voice answers (reusing the recorder + tutor
 * /voice); after → the examiner's qualitative evaluation (strengths, gaps,
 * recommendations). No fabricated numeric score — only what the examiner says.
 */
function OralExam() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [phase, setPhase] = useState<'setup' | 'starting' | 'exam' | 'evaluating' | 'result'>('setup');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [turns, setTurns] = useState<{ role: 'examiner' | 'you'; text: string }[]>([]);
  const [status, setStatus] = useState<'ready' | 'recording' | 'analyzing'>('ready');
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const recorder = useRef<Recorder | null>(null);

  useEffect(() => {
    if (phase !== 'exam') return;
    const timer = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, [phase]);

  const refresh = useCallback(async (sid: string) => {
    const detail = await api<TutorSessionDetail>(`/tutor/sessions/${sid}`);
    setTurns(
      detail.messages
        .slice(1)
        .map((m) => ({ role: (m.role === 'assistant' ? 'examiner' : 'you') as 'examiner' | 'you', text: m.content }))
        .filter((x) => x.text.trim()),
    );
  }, []);

  const startExam = async () => {
    setPhase('starting');
    setError(null);
    try {
      const s = await api<TutorSessionSummary>('/tutor/sessions', {
        method: 'POST',
        body: { objective: t('learn.exam.title'), intent: 'practice', mode: 'oral_exam', inputModality: 'voice' },
      });
      setSessionId(s.id);
      await api(`/tutor/sessions/${s.id}/messages`, { method: 'POST', body: { content: t('learn.exam.startFrame') } });
      await refresh(s.id);
      setPhase('exam');
    } catch (e) {
      setError((e as Error).message);
      setPhase('setup');
    }
  };

  const stopAndSend = async () => {
    if (!recorder.current || !sessionId) return;
    setStatus('analyzing');
    try {
      const { blob, mimeType } = await recorder.current.stop();
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const form = new FormData();
      form.append('audio', blob, `turn.${ext}`);
      await apiUpload<VoiceTurnResponse>(`/tutor/sessions/${sessionId}/voice`, form);
      await refresh(sessionId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      recorder.current = null;
      setStatus('ready');
    }
  };

  const toggleRecord = async () => {
    if (status === 'analyzing') return;
    if (status === 'recording') { await stopAndSend(); return; }
    if (!sessionId) return;
    setError(null);
    try {
      recorder.current = createRecorder();
      await recorder.current.start();
      setStatus('recording');
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const endExam = async () => {
    if (!sessionId) return;
    setPhase('evaluating');
    setError(null);
    try {
      await api(`/tutor/sessions/${sessionId}/messages`, { method: 'POST', body: { content: t('learn.exam.endFrame') } });
      await refresh(sessionId);
      setPhase('result');
    } catch (e) {
      setError((e as Error).message);
      setPhase('exam');
    }
  };

  const mmss = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  const statusKey: TranslationKey = status === 'recording' ? 'learn.oral.recording' : status === 'analyzing' ? 'learn.oral.analyzing' : 'learn.oral.ready';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackToLearn />
      <View style={styles.freeHead}>
        <Text style={styles.freeKicker}>🎓 {t('learn.exam.kicker')}</Text>
        <Text style={styles.freeTitle}>{t('learn.exam.title')}</Text>
        <Text style={styles.freeSub}>{t('learn.exam.subtitle')}</Text>
      </View>
      {error ? <ErrorBanner message={error} /> : null}

      {!RECORDING_SUPPORTED ? (
        <Card><Text style={styles.freeSub}>{t('learn.oral.noVoice')}</Text></Card>
      ) : phase === 'setup' ? (
        <Card style={{ gap: 12 }}>
          <Text style={styles.freeSub}>{t('learn.exam.consignes')}</Text>
          <Button label={t('learn.exam.start')} onPress={startExam} />
        </Card>
      ) : phase === 'starting' ? (
        <Loading label={t('learn.exam.starting')} />
      ) : (
        <>
          {(phase === 'exam' || phase === 'evaluating' || phase === 'result') ? (
            <View style={styles.examBar}>
              <Text style={styles.examTimerLabel}>{t('learn.exam.elapsed')}</Text>
              <Text style={styles.examTimer}>⏱ {mmss}</Text>
            </View>
          ) : null}

          {turns.map((turn, i) => (
            <View key={i} style={turn.role === 'you' ? styles.youBubble : styles.teacherBubble}>
              <Text style={styles.bubbleWho}>{turn.role === 'you' ? t('learn.oral.you') : t('learn.exam.examiner')}</Text>
              <Text style={styles.bubbleText}>{turn.text}</Text>
            </View>
          ))}

          {phase === 'exam' ? (
            <>
              <Card style={styles.studio}>
                <View style={[styles.statusPill, status === 'recording' && { borderColor: c.error }, status === 'analyzing' && { borderColor: c.primary }]}>
                  <Text style={styles.statusText}>{t(statusKey)}</Text>
                </View>
                <Pressable
                  onPress={toggleRecord}
                  disabled={status === 'analyzing'}
                  accessibilityRole="button"
                  accessibilityLabel={t(status === 'recording' ? 'learn.oral.stop' : 'learn.oral.record')}
                  style={[styles.micButton, status === 'recording' && { backgroundColor: c.error, borderColor: c.error }, status === 'analyzing' && { opacity: 0.6 }]}
                >
                  <Text style={styles.micIcon}>{status === 'recording' ? '⏹' : '🎙️'}</Text>
                </Pressable>
                <Text style={styles.micLabel}>{t(status === 'recording' ? 'learn.oral.stop' : 'learn.oral.record')}</Text>
              </Card>
              <Button variant="ghost" label={t('learn.exam.end')} onPress={endExam} />
            </>
          ) : phase === 'evaluating' ? (
            <Loading label={t('learn.exam.evaluating')} />
          ) : null}
        </>
      )}
    </ScrollView>
  );
}

/** Localised error for an unknown /tutor mode — never a blank page. */
function ModeError() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  return (
    <ScrollView contentContainerStyle={styles.container}>
      <BackToLearn />
      <View style={styles.freeHead}>
        <Text style={styles.freeTitle}>{t('learn.mode.errTitle')}</Text>
        <Text style={styles.freeSub}>{t('learn.mode.errDetail')}</Text>
      </View>
    </ScrollView>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 14, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  freeHead: { gap: 6 },
  freeKicker: { fontSize: 12, fontWeight: '800', color: c.aiAccent, textTransform: 'uppercase', letterSpacing: 1.2 },
  freeTitle: { fontSize: 26, fontWeight: '800', color: c.textPrimary },
  freeSub: { fontSize: 15, color: c.textSecondary, lineHeight: 22 },
  freeInput: { minHeight: 110, textAlignVertical: 'top', marginBottom: 12 },
  freeNote: { fontSize: 13, color: c.textMuted, fontStyle: 'italic', lineHeight: 19 },
  levelLabel: { fontSize: 11, fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 8 },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  levelPill: { borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 14, backgroundColor: c.surfaceElevated, minHeight: 40, justifyContent: 'center' },
  levelPillOn: { borderColor: c.aiAccent, backgroundColor: c.aiAccentSoft },
  levelPillText: { fontSize: 13, fontWeight: '700', color: c.textSecondary },
  levelPillTextOn: { color: c.aiAccent },
  studio: { alignItems: 'center', gap: 12 },
  statusPill: { borderWidth: 1, borderColor: c.border, borderRadius: 999, paddingVertical: 5, paddingHorizontal: 14, backgroundColor: c.surfaceElevated },
  statusText: { fontSize: 12, fontWeight: '800', color: c.textSecondary, textTransform: 'uppercase', letterSpacing: 1 },
  micButton: { width: 88, height: 88, borderRadius: 44, borderWidth: 2, borderColor: c.primary, backgroundColor: c.surfaceElevated, alignItems: 'center', justifyContent: 'center' },
  micIcon: { fontSize: 34 },
  micLabel: { fontSize: 14, fontWeight: '700', color: c.textPrimary },
  youBubble: { alignSelf: 'flex-end', maxWidth: '90%', backgroundColor: c.surfaceElevated, borderWidth: 1, borderColor: c.primary, borderRadius: 12, padding: 12, gap: 4 },
  teacherBubble: { alignSelf: 'flex-start', maxWidth: '90%', backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, borderRadius: 12, padding: 12, gap: 4 },
  bubbleWho: { fontSize: 11, fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.8 },
  bubbleText: { fontSize: 15, color: c.textPrimary, lineHeight: 22 },
  examBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: c.border, backgroundColor: c.surfaceElevated, borderRadius: 12, paddingVertical: 10, paddingHorizontal: 16 },
  examTimerLabel: { fontSize: 11, fontWeight: '800', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 1 },
  examTimer: { fontSize: 20, fontWeight: '800', color: c.textPrimary, fontVariant: ['tabular-nums'] },
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
  line: { fontSize: 17, color: c.textSecondary, lineHeight: 26 },
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
