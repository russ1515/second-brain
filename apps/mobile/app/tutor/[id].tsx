import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  ContextItem,
  ExperienceSession,
  QuotaErrorContract,
  RlleMissionEvaluation,
  RlleMissionTurnResponse,
  SendTutorMessageResponse,
  TeachingStrategy,
  TutorPace,
  TutorSessionDetail,
  TutorSessionSummary,
  TranscriptionResult,
} from '@second-brain/shared';
import { isQuotaError } from '@second-brain/shared';
import { useAuth } from '../../lib/auth-context';
import { ApiError, api, apiUpload } from '../../lib/client';
import { createRecorder, RECORDING_SUPPORTED, type Recorder, type Recording } from '../../lib/recorder';
import { useTokens } from '../../lib/design/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { useResponsive } from '../../lib/responsive';
import { actionDestinationHref } from '../../lib/action-destination';
import { sendRlleMissionTurn } from '../../lib/language-rll-client';
import {
  clearTutorSessionDraft,
  loadTutorSessionDraft,
  saveTutorSessionDraft,
} from '../../lib/tutor/session-draft';
import { teacherRoleLabel } from '../../lib/teacher-role';
import { Alert, Badge, Button, Card } from '../../components/ds/core';
import { Page } from '../../components/ds/layout';
import { Sheet } from '../../components/ds/overlays';
import { SmartErrorState, SmartLoadingState, SmartState } from '../../components/ds/states';
import { ContextBar } from '../../components/context/context-bar';
import { SpeakButton } from '../../components/speak-button';
import { VoiceState } from '../../components/ds/language';
import {
  ProgressNarrative,
  ResultActionBar,
  TutorAIState,
  TutorMessage,
  type ResultAction,
  type TutorWorkState,
} from '../../components/tutor/experience';

const STRATEGY_LABEL: Record<TeachingStrategy, TranslationKey> = {
  socratic: 'strategy.socratic',
  project_based: 'strategy.project_based',
  problem_solving: 'strategy.problem_solving',
  case_study: 'strategy.case_study',
  task_based: 'strategy.task_based',
  guided_demonstration: 'strategy.guided_demonstration',
  active_learning: 'strategy.active_learning',
  experiential: 'strategy.experiential',
};

type TurnFailure =
  | { kind: 'quota'; quota: QuotaErrorContract }
  | { kind: 'provider'; message: string }
  | { kind: 'generic'; message: string };

/** The Tutor is one resumable learning experience: objective and context stay
 * visible, the lesson can change shape, and the composer remains anchored. */
export default function TutorSessionScreen() {
  const params = useLocalSearchParams<{
    id: string | string[];
    voice?: string | string[];
    languageProfileId?: string | string[];
    missionId?: string | string[];
    experienceSessionId?: string | string[];
  }>();
  const id = Array.isArray(params.id) ? params.id[0] : params.id;
  const voiceParam = Array.isArray(params.voice) ? params.voice[0] : params.voice;
  const languageProfileId = Array.isArray(params.languageProfileId) ? params.languageProfileId[0] : params.languageProfileId;
  const missionId = Array.isArray(params.missionId) ? params.missionId[0] : params.missionId;
  const missionExperienceSessionId = Array.isArray(params.experienceSessionId)
    ? params.experienceSessionId[0]
    : params.experienceSessionId;
  const missionContext = languageProfileId && missionId && missionExperienceSessionId
    ? { languageProfileId, missionId, experienceSessionId: missionExperienceSessionId }
    : null;
  const voiceFocused = voiceParam === '1';
  const { user, offline } = useAuth();
  const router = useRouter();
  const { t, locale } = useI18n();
  const { colors: c, radius, spacing, typography, elevation } = useTokens();
  const { mode } = useResponsive();
  const compact = mode === 'compact';
  const [session, setSession] = useState<TutorSessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [draftReady, setDraftReady] = useState(false);
  const [workState, setWorkState] = useState<TutorWorkState>('READY');
  const [failure, setFailure] = useState<TurnFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [missionFeedback, setMissionFeedback] = useState<RlleMissionEvaluation | null>(null);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const recorder = useRef<Recorder | null>(null);
  const lastRecording = useRef<Recording | null>(null);
  const recordingStartedAt = useRef(0);
  const pausedStartedAt = useRef(0);
  const pausedDuration = useRef(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [voiceDraft, setVoiceDraft] = useState(false);
  const scroll = useRef<ScrollView | null>(null);
  const busy = workState === 'THINKING' || workState === 'TRANSCRIPTION';
  const recording = workState === 'LISTENING' || workState === 'PAUSED';

  useEffect(() => {
    if (workState !== 'LISTENING') return;
    const update = () => setElapsedSeconds(Math.max(0, Math.floor((Date.now() - recordingStartedAt.current - pausedDuration.current) / 1000)));
    update();
    const timer = setInterval(update, 250);
    return () => clearInterval(timer);
  }, [workState]);

  const load = useCallback(async (showLoading = true, preserveFailure = false) => {
    if (!id) return;
    if (showLoading) setLoading(true);
    if (!preserveFailure) setFailure(null);
    try {
      let detail = await api<TutorSessionDetail>(`/tutor/sessions/${id}`);
      if (detail.experienceSession?.status === 'paused') {
        const resumed = await api<ExperienceSession>(
          `/experience-sessions/${detail.experienceSession.id}/resume`,
          { method: 'POST' },
        );
        detail = { ...detail, experienceSession: resumed };
      }
      setSession(detail);
      const persistedMissionFeedback = readMissionEvaluation(
        detail.experienceSession?.currentStep?.metadata?.lastEvaluation,
      );
      if (persistedMissionFeedback) setMissionFeedback(persistedMissionFeedback);
    } catch (error) {
      setFailure(toFailure(error));
    } finally {
      if (showLoading) setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!user?.id || !id) return;
    let active = true;
    void loadTutorSessionDraft(user.id, id).then((saved) => {
      if (active && saved?.text) setDraft(saved.text);
      if (active) setDraftReady(true);
    });
    return () => { active = false; };
  }, [id, user?.id]);

  useEffect(() => {
    if (!draftReady || !user?.id || !id) return;
    const timer = setTimeout(() => {
      void saveTutorSessionDraft(user.id, id, draft);
    }, 350);
    return () => clearTimeout(timer);
  }, [draft, draftReady, id, user?.id]);

  const postTurn = async (content: string, pace?: TutorPace, viaVoice = false) => {
    if (!id) return;
    setWorkState('THINKING');
    setFailure(null);
    setNotice(null);
    try {
      if (missionContext) {
        const result: RlleMissionTurnResponse = await sendRlleMissionTurn(
          missionContext.languageProfileId,
          missionContext.missionId,
          {
            experienceSessionId: missionContext.experienceSessionId,
            message: content,
            ...(viaVoice ? { viaVoice: true } : {}),
          },
        );
        setMissionFeedback(result.evaluation);
        if (result.evaluation?.outcome === 'demonstrated') setNotice(t('rlle.ui.mission.feedback.succeeded'));
        else if (result.evaluation?.outcome === 'needs-repair') setNotice(t('rlle.ui.mission.feedback.repair'));
      } else {
        await api<SendTutorMessageResponse>(`/tutor/sessions/${id}/messages`, {
          method: 'POST',
          body: { content, ...(pace ? { pace } : {}), ...(viaVoice ? { viaVoice: true } : {}) },
        });
      }
      setDraft('');
      setVoiceDraft(false);
      lastRecording.current = null;
      if (user?.id) await clearTutorSessionDraft(user.id, id);
      setWorkState('RESPONSE');
      await load(false);
      if (!viaVoice && !voiceFocused) setWorkState('READY');
      requestAnimationFrame(() => scroll.current?.scrollToEnd({ animated: true }));
    } catch (error) {
      setFailure(toFailure(error));
      setWorkState('ERROR');
    }
  };

  const send = () => {
    const content = draft.trim();
    if (content) void postTurn(content, undefined, voiceDraft);
  };

  const sendPace = (pace: TutorPace) => {
    setOptionsOpen(false);
    void postTurn(t(pace === 'slower' ? 'tutor.slowerMsg' : 'tutor.fasterMsg'), pace);
  };

  const startRecording = async () => {
    setFailure(null);
    setNotice(null);
    try {
      recorder.current = createRecorder();
      await recorder.current.start();
      lastRecording.current = null;
      recordingStartedAt.current = Date.now();
      pausedStartedAt.current = 0;
      pausedDuration.current = 0;
      setElapsedSeconds(0);
      setWorkState('LISTENING');
    } catch (error) {
      setFailure(toFailure(error));
      setWorkState('ERROR');
    }
  };

  const transcribeRecording = async (recording: Recording) => {
    setWorkState('TRANSCRIPTION');
    setFailure(null);
    try {
      const form = new FormData();
      const ext = recording.mimeType.includes('mp4') ? 'mp4' : recording.mimeType.includes('ogg') ? 'ogg' : 'webm';
      form.append('audio', recording.blob, `turn.${ext}`);
      const language = session?.experienceSession?.currentStep?.metadata?.language;
      if (typeof language === 'string') form.append('language', language);
      const transcript = await apiUpload<TranscriptionResult>('/speech/stt', form);
      setDraft(transcript.text);
      setVoiceDraft(true);
      setNotice(t('voice11.transcript.edit'));
      setWorkState('READY');
    } catch (error) {
      setFailure(toFailure(error));
      setWorkState('ERROR');
    }
  };

  const stopAndTranscribe = async () => {
    if (!recorder.current) return;
    setWorkState('TRANSCRIPTION');
    setFailure(null);
    try {
      const captured = await recorder.current.stop();
      lastRecording.current = captured;
      if (captured.durationMs !== undefined) setElapsedSeconds(Math.round(captured.durationMs / 1000));
      await transcribeRecording(captured);
    } catch (error) {
      setFailure(toFailure(error));
      setWorkState('ERROR');
    } finally {
      recorder.current = null;
    }
  };

  const pauseRecording = async () => {
    if (!recorder.current || workState !== 'LISTENING') return;
    try {
      await recorder.current.pause();
      pausedStartedAt.current = Date.now();
      setWorkState('PAUSED');
    } catch (error) {
      setFailure(toFailure(error));
      setWorkState('ERROR');
    }
  };

  const resumeRecording = async () => {
    if (!recorder.current || workState !== 'PAUSED') return;
    try {
      await recorder.current.resume();
      pausedDuration.current += Date.now() - pausedStartedAt.current;
      pausedStartedAt.current = 0;
      setWorkState('LISTENING');
    } catch (error) {
      setFailure(toFailure(error));
      setWorkState('ERROR');
    }
  };

  const cancelRecording = () => {
    recorder.current?.cancel();
    recorder.current = null;
    lastRecording.current = null;
    pausedStartedAt.current = 0;
    pausedDuration.current = 0;
    setElapsedSeconds(0);
    setWorkState('READY');
  };

  const removeContext = async (item: ContextItem) => {
    const experience = session?.experienceSession;
    if (!experience) return;
    const activeContexts = experience.activeContexts.items.filter(
      (current) => current.id !== item.id || current.kind !== item.kind,
    );
    try {
      const updated = await api<ExperienceSession>(`/experience-sessions/${experience.id}`, {
        method: 'PATCH',
        body: { activeContexts },
      });
      setSession((current) => current ? { ...current, experienceSession: updated } : current);
    } catch (error) {
      setFailure(toFailure(error));
    }
  };

  const pauseAndLeave = async () => {
    const experience = session?.experienceSession;
    if (experience?.status === 'active') {
      await api(`/experience-sessions/${experience.id}/pause`, { method: 'POST' }).catch(() => undefined);
    }
    router.replace('/tutor');
  };

  const complete = async () => {
    const experience = session?.experienceSession;
    if (!experience || experience.status !== 'active') return;
    setOptionsOpen(false);
    try {
      const completed = await api<ExperienceSession>(`/experience-sessions/${experience.id}/complete`, { method: 'POST' });
      setSession((current) => current ? { ...current, experienceSession: completed } : current);
    } catch (error) {
      setFailure(toFailure(error));
    }
  };

  if (loading && !session) {
    return <SmartLoadingState title={t('tutor.opening')} detail={t('tutor6.loading.detail')} />;
  }

  if (!session) {
    return (
      <Page width="reading">
        <SmartErrorState
          title={t('tutor.loadFailed')}
          detail={failure && failure.kind !== 'quota' ? failure.message : undefined}
          retryable
          onRetry={() => void load()}
        />
        <Button label={t('tutor6.backTutor')} variant="ghost" onPress={() => router.replace('/tutor')} />
      </Page>
    );
  }

  const experience = session.experienceSession ?? null;
  const objective = experience?.currentStep?.label ?? experience?.intent ?? session.title ?? t('tutor.discussion');
  const contexts = experience?.activeContexts.items ?? [];
  const targetLanguage = typeof experience?.currentStep?.metadata?.language === 'string'
    ? experience.currentStep.metadata.language
    : undefined;
  const canPace = session.messages.some((message) => message.role === 'assistant') && !recording;
  const continueCompleted = () => {
    if (!experience) return;
    const document = contexts.find((item) => item.kind === 'document' && item.referenceId);
    const goal = contexts.find((item) => item.kind === 'goal' && item.referenceId);
    const language = contexts.find((item) => item.kind === 'language' && item.referenceId);
    void api<TutorSessionSummary>('/tutor/sessions', {
      method: 'POST',
      body: {
        title: session.title ?? objective.slice(0, 120),
        objective: objective.slice(0, 500),
        intent: experience.intent ?? 'learn',
        mode: experience.currentStep?.id ?? 'conversation',
        inputModality: 'text',
        activeContexts: contexts,
        ...(session.focusConceptId ? { focusConceptId: session.focusConceptId } : {}),
        ...(document?.referenceId ? { documentId: document.referenceId } : {}),
        ...(goal?.referenceId ? { goalId: goal.referenceId } : {}),
        ...(language?.referenceId ? { languageProfileId: language.referenceId } : {}),
      },
    }).then((created) => router.push(`/tutor/${created.id}`)).catch((error) => setFailure(toFailure(error)));
  };
  const actions = experience?.status === 'completed'
    ? resultActions(session, experience, t, (href) => router.push(href), continueCompleted)
    : [];

  const strategy = session.strategy ? (
    <Card style={{ gap: spacing.xs }}>
      <Text style={[typography.label, { color: c.aiAccent }]}>{t('tutor6.strategy')}</Text>
      <Text style={[typography.title, { color: c.textPrimary }]}>{t(STRATEGY_LABEL[session.strategy])}</Text>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
        {session.strategyReasonCode
          ? t(session.strategyReasonCode as TranslationKey)
          : session.strategyReason}
      </Text>
    </Card>
  ) : null;

  const secondaryActions = (
    <>
      {canPace ? (
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <Button label={t('tutor.slower')} variant="secondary" onPress={() => sendPace('slower')} disabled={busy} />
          <Button label={t('tutor.faster')} variant="secondary" onPress={() => sendPace('faster')} disabled={busy} />
        </View>
      ) : null}
      {!missionContext && experience?.status === 'active' ? <Button label={t('tutor6.complete')} variant="ghost" onPress={() => void complete()} /> : null}
      <Button label={t('tutor6.pause')} variant="ghost" onPress={() => void pauseAndLeave()} />
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: c.background }} testID="tutor-session-experience">
      <ScrollView
        ref={scroll}
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <Page width="wide" style={{ paddingBottom: spacing.xl }}>
          <View style={{ gap: spacing.sm }}>
            <Button label={t('tutor6.backTutor')} variant="ghost" size="sm" onPress={() => void pauseAndLeave()} />
            <Text style={[typography.label, { color: c.aiAccent }]}>{t('tutor6.objective')}</Text>
            <Text accessibilityRole="header" style={[typography.h1, { color: c.textPrimary, maxWidth: 860 }]}>{objective}</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
              {session.role.kind !== 'general' ? <Badge label={`${session.role.emoji} ${teacherRoleLabel(session.role, locale)}`} tone="ai" /> : null}
              {session.focusConceptName ? <Badge label={session.focusConceptName} tone="warning" /> : null}
              <TutorAIState state={workState} />
            </View>
            <ContextBar items={contexts} onRemove={(item) => void removeContext(item)} />
            {offline ? <Alert tone="warning" title={t('languages11.offline.title')} detail={t('languages11.offline.detail')} /> : null}
          </View>

          {failure ? (
            failure.kind === 'quota' ? (
              <SmartState
                state="quota-limited"
                title={t('tutor6.quota.title')}
                detail={quotaDetail(failure.quota, locale, t)}
              >
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                  <Button label={t('tutor6.quota.usage')} variant="secondary" onPress={() => router.push('/usage')} />
                  <Button label={t('tutor6.quota.library')} variant="ghost" onPress={() => router.push('/library')} />
                </View>
              </SmartState>
            ) : (
              <SmartErrorState
                title={failure.kind === 'provider' ? t('tutor6.error.provider') : t('state.error')}
                detail={`${failure.message} ${t('tutor6.error.preserved')}`}
                retryable={Boolean(lastRecording.current || draft.trim())}
                onRetry={lastRecording.current ? () => void transcribeRecording(lastRecording.current!) : draft.trim() ? send : undefined}
                retryLabel={t('tutor6.error.retry')}
                compact
              />
            )
          ) : null}
          {notice ? <Alert tone={voiceDraft ? 'info' : 'success'} title={notice} /> : null}
          {missionFeedback ? (
            <Card style={{ gap: spacing.sm, borderColor: missionFeedback.outcome === 'demonstrated' ? c.success : c.warning }} testID="rlle-mission-feedback">
              <Badge
                label={t(missionFeedback.outcome === 'demonstrated' ? 'rlle.ui.mission.feedback.proof' : 'rlle.ui.mission.feedback.microLesson')}
                tone={missionFeedback.outcome === 'demonstrated' ? 'success' : 'warning'}
              />
              <Text style={[typography.bodySmall, { color: c.textPrimary }]}>{missionFeedback.observation}</Text>
              {missionFeedback.microLesson ? (
                <View style={{ gap: spacing.xs }}>
                  <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{missionFeedback.microLesson.explanation}</Text>
                  <Text style={[typography.bodySmall, { color: c.textPrimary }]}>{t('rlle.ui.mission.feedback.example')}: {missionFeedback.microLesson.example}</Text>
                  <Text style={[typography.label, { color: c.aiAccent }]}>{missionFeedback.microLesson.practicePrompt}</Text>
                </View>
              ) : null}
              {missionContext ? (
                <Button
                  size="sm"
                  variant="secondary"
                  label={t('rlle.ui.common.backCourse')}
                  onPress={() => router.push(`/languages/${missionContext.languageProfileId}/course` as never)}
                />
              ) : null}
            </Card>
          ) : null}

          <View style={mode === 'wide' ? { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xl } : { gap: spacing.lg }}>
            <View style={{ flex: 1, minWidth: 0, gap: spacing.lg }}>
              {compact ? strategy : null}
              {session.messages.length === 0 ? (
                <Card>
                  <Text style={[typography.body, { color: c.textSecondary }]}>{t('tutor6.empty')}</Text>
                </Card>
              ) : session.messages.map((message) => (
                <TutorMessage
                  key={message.id}
                  message={message}
                  onOpenSource={(documentId) => router.push(`/library/${documentId}`)}
                  trailing={message.role === 'assistant' ? <SpeakButton text={message.content} language={targetLanguage} /> : undefined}
                />
              ))}
              {experience ? <ProgressNarrative session={experience} /> : null}
              <ResultActionBar actions={actions} />
            </View>
            {mode === 'wide' ? (
              <View style={{ width: 300, flexShrink: 0, gap: spacing.md }}>
                {strategy}
                {secondaryActions}
              </View>
            ) : null}
          </View>
        </Page>
      </ScrollView>

      {experience?.status !== 'completed' ? (
        <View
          style={[
            {
              borderTopWidth: 1,
              borderTopColor: c.border,
              backgroundColor: c.surfaceElevated,
              paddingHorizontal: compact ? spacing.md : spacing.xl,
              paddingVertical: spacing.sm,
            },
            elevation.low,
          ]}
        >
          <View style={{ width: '100%', maxWidth: 980, alignSelf: 'center', gap: spacing.sm }}>
            {voiceFocused || recording || voiceDraft || lastRecording.current ? (
              <VoiceState state={workState} elapsedSeconds={recording || elapsedSeconds ? elapsedSeconds : undefined} transcript={voiceDraft ? draft : undefined} />
            ) : null}
            <TextInput
              style={{
                minHeight: 56,
                maxHeight: 150,
                borderWidth: 1,
                borderColor: c.border,
                borderRadius: radius.md,
                backgroundColor: c.surface,
                color: c.textPrimary,
                paddingHorizontal: spacing.md,
                paddingVertical: spacing.sm,
                textAlignVertical: 'top',
              }}
              placeholder={t('tutor.placeholder')}
              placeholderTextColor={c.textMuted}
              value={draft}
              onChangeText={setDraft}
              multiline
              editable={!busy && !recording}
              maxLength={4_000}
              testID="tutor-input"
            />
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm }}>
              <Button label={t('tutor.send')} onPress={send} loading={workState === 'THINKING'} disabled={!draft.trim() || recording} />
              {RECORDING_SUPPORTED ? (
                recording ? (
                  <>
                    <Button label={t('voice11.transcribe')} variant="ai" onPress={() => void stopAndTranscribe()} />
                    {workState === 'PAUSED'
                      ? <Button label={t('voice11.resume')} variant="secondary" onPress={() => void resumeRecording()} />
                      : <Button label={t('voice11.pause')} variant="secondary" onPress={() => void pauseRecording()} />}
                    <Button label={t('tutor.cancel')} variant="ghost" onPress={cancelRecording} />
                  </>
                ) : (
                  <Button label={t('tutor.speak')} variant="secondary" onPress={() => void startRecording()} disabled={busy} />
                )
              ) : null}
              {mode !== 'wide' ? <Button label={t('tutor6.options')} variant="ghost" onPress={() => setOptionsOpen(true)} /> : null}
            </View>
          </View>
        </View>
      ) : null}

      <Sheet visible={optionsOpen} onClose={() => setOptionsOpen(false)} title={t('tutor6.options')}>
        {secondaryActions}
        <Button label={t('tutor.cancel')} variant="ghost" onPress={() => setOptionsOpen(false)} />
      </Sheet>
    </View>
  );
}

function toFailure(error: unknown): TurnFailure {
  if (error instanceof ApiError) {
    const payload = quotaPayload(error.payload);
    if (payload) return { kind: 'quota', quota: payload };
    if (error.status === 0 || error.status >= 500) return { kind: 'provider', message: error.message };
    return { kind: 'generic', message: error.message };
  }
  return { kind: 'generic', message: (error as Error).message };
}

function readMissionEvaluation(value: unknown): RlleMissionEvaluation | null {
  if (!value || typeof value !== 'object') return null;
  const candidate = value as Partial<RlleMissionEvaluation>;
  if (!['continue', 'needs-repair', 'demonstrated'].includes(String(candidate.outcome))) return null;
  if (typeof candidate.observation !== 'string' || !candidate.observation.trim()) return null;
  return candidate as RlleMissionEvaluation;
}

function quotaPayload(payload: unknown): QuotaErrorContract | null {
  if (isQuotaError(payload)) return payload;
  if (payload && typeof payload === 'object' && 'message' in payload) {
    const message = (payload as { message: unknown }).message;
    if (isQuotaError(message)) return message;
  }
  return null;
}

function transcriptFrom(error: unknown): string | null {
  if (!(error instanceof ApiError) || !error.payload || typeof error.payload !== 'object') return null;
  const transcript = (error.payload as { transcript?: unknown }).transcript;
  return typeof transcript === 'string' ? transcript : null;
}

function quotaDetail(
  quota: QuotaErrorContract,
  locale: string,
  t: (key: TranslationKey) => string,
): string {
  if (!quota.resetAt) return t('tutor6.quota.detail');
  const reset = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(quota.resetAt));
  return t('tutor6.quota.reset').replace('{date}', reset);
}

function resultActions(
  session: TutorSessionDetail,
  experience: ExperienceSession,
  t: (key: TranslationKey) => string,
  navigate: (href: never) => void,
  continueSession: () => void,
): ResultAction[] {
  const actions: ResultAction[] = [];
  if (experience.nextBestAction) {
    actions.push({
      id: 'next-best-action',
      label: experience.nextBestAction.primaryAction.label,
      onPress: () => navigate(actionDestinationHref(experience.nextBestAction!.primaryAction.destination) as never),
    });
  } else {
    actions.push({
      id: 'continue',
      label: t('tutor6.result.continue'),
      onPress: continueSession,
    });
  }
  if ((experience.twinImpact?.changes.length ?? 0) > 0) {
    const concept = experience.activeContexts.items.find((item) => item.kind === 'concept' && item.referenceId);
    const document = experience.activeContexts.items.find((item) => item.kind === 'document' && item.referenceId);
    const goal = experience.activeContexts.items.find((item) => item.kind === 'goal' && item.referenceId);
    const query = new URLSearchParams({
      sessionId: experience.id,
      ...(concept?.referenceId ? { conceptId: concept.referenceId } : {}),
      ...(document?.referenceId ? { documentId: document.referenceId } : {}),
      ...(goal?.referenceId ? { goalId: goal.referenceId } : {}),
    }).toString();
    actions.push({
      id: 'brain-impact',
      label: t('tutor6.result.brain'),
      variant: 'secondary',
      onPress: () => navigate(`/brain?${query}` as never),
    });
  }
  actions.push({
    id: 'consolidate',
    label: t('tutor6.result.consolidate'),
    variant: 'secondary',
    onPress: () => navigate(`/examiner?type=exercise&topic=${encodeURIComponent(session.title ?? '')}` as never),
  });
  const origin = experience.activeContexts.items.find((item) => item.referenceId && ['document', 'concept', 'goal', 'exam', 'language'].includes(item.kind));
  if (origin) {
    const path = origin.kind === 'document'
      ? `/library/${origin.referenceId}`
      : origin.kind === 'language'
        ? `/languages/${origin.referenceId}`
        : origin.kind === 'goal'
          ? '/goals'
          : origin.kind === 'exam'
            ? '/exams'
          : '/brain';
    actions.push({
      id: 'origin',
      label: t('tutor6.result.origin'),
      variant: 'ghost',
      onPress: () => navigate(path as never),
    });
  }
  return actions.slice(0, 3);
}
