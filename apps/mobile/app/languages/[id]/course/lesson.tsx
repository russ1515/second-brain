import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { LanguageProfileDetail, LessonFlowProgress, RlleCourseView } from '@second-brain/shared';
import { Alert, Badge, Button, Card } from '../../../../components/ds/core';
import { Page, PageHeader, ResponsiveSplit, Section } from '../../../../components/ds/layout';
import { SmartErrorState, SmartLoadingState } from '../../../../components/ds/states';
import { ContextBar } from '../../../../components/context/context-bar';
import { LanguageMasteryBulletins, LessonStages } from '../../../../components/language/course-ui';
import { useTokens } from '../../../../lib/design/theme';
import { useRlleCopy } from '../../../../lib/language-rll-i18n';
import { useI18n } from '../../../../lib/i18n';
import { api } from '../../../../lib/client';
import { featureFlags } from '../../../../lib/feature-flags';
import {
  advanceRlleLesson,
  loadRlleAcousticMasteryPrompt,
  loadLanguageProfile,
  loadRlleCourse,
  pauseRlleSession,
  resumeRlleSession,
  startRlleAutonomy,
  startRlleLesson,
  startRlleRemediation,
  startRlleScopedMastery,
  submitRlleAcousticMastery,
  type RlleAcousticMasteryPrompt,
  type RlleCourseLoad,
} from '../../../../lib/language-rll-client';
import {
  createRecorder,
  RECORDING_SUPPORTED,
  type Recorder,
  type Recording,
} from '../../../../lib/recorder';

type AcousticRecordingSlot = 'scripted' | 'spontaneous';
type PreparedAcousticPrompt = RlleAcousticMasteryPrompt & { operationKey: string };

export default function StructuredLanguageLessonScreen() {
  const params = useLocalSearchParams<{
    id: string | string[];
    unitId?: string | string[];
    lessonFlowCompleted?: string | string[];
    completedLessonId?: string | string[];
  }>();
  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;
  const unitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const lessonFlowCompleted = Array.isArray(params.lessonFlowCompleted)
    ? params.lessonFlowCompleted[0]
    : params.lessonFlowCompleted;
  const completedLessonId = Array.isArray(params.completedLessonId)
    ? params.completedLessonId[0]
    : params.completedLessonId;
  const router = useRouter();
  const { copy } = useRlleCopy();
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const [profile, setProfile] = useState<LanguageProfileDetail | null>(null);
  const [courseLoad, setCourseLoad] = useState<RlleCourseLoad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const reconciledLessonFlow = useRef<string | null>(null);
  const acousticRecorder = useRef<Recorder | null>(null);
  const [acousticPrompt, setAcousticPrompt] = useState<PreparedAcousticPrompt | null>(null);
  const [acousticRecordingSlot, setAcousticRecordingSlot] = useState<AcousticRecordingSlot | null>(null);
  const [acousticRecordings, setAcousticRecordings] = useState<Partial<Record<AcousticRecordingSlot, Recording>>>({});
  const [acousticFeedback, setAcousticFeedback] = useState<{
    tone: 'success' | 'warning';
    title: string;
  } | null>(null);
  const [acousticRetryPending, setAcousticRetryPending] = useState(false);

  const load = useCallback(async () => {
    if (!profileId) return;
    setError(null);
    try {
      const [nextProfile, nextCourse] = await Promise.all([loadLanguageProfile(profileId), loadRlleCourse(profileId)]);
      setProfile(nextProfile);
      setCourseLoad(nextCourse);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [profileId]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => () => acousticRecorder.current?.cancel(), []);

  useEffect(() => {
    if (lessonFlowCompleted !== '1') {
      // Removing the return marker ends this reconciliation attempt. A later
      // explicit return from the same lesson may retry after a transient error.
      reconciledLessonFlow.current = null;
      return;
    }
    if (
      !profile
      || courseLoad?.kind !== 'live'
      || !courseLoad.course.experienceSession
    ) return;
    const currentCourse = courseLoad.course;
    const courseSession = currentCourse.experienceSession;
    const currentLesson = currentCourse.currentLesson;
    if (!courseSession || !currentLesson?.lessonId || (unitId && currentLesson.unitId !== unitId)) return;
    const cleanRoute = `/languages/${profile.id}/course/lesson?unitId=${encodeURIComponent(currentLesson.unitId)}` as never;
    // A remediation lesson uses the same guided Lesson UI but must never
    // advance the canonical course lesson. Its own evidence is persisted by
    // the remediation endpoint; returning here only refreshes the course view.
    if (!completedLessonId || completedLessonId !== currentLesson.lessonId) {
      router.replace(cleanRoute);
      return;
    }
    const lessonId = completedLessonId;
    const reconciliationKey = `${courseSession.id}:${lessonId}`;
    if (reconciledLessonFlow.current === reconciliationKey) return;
    reconciledLessonFlow.current = reconciliationKey;

    const reconcile = async () => {
      setBusy('lesson-flow');
      setError(null);
      let nextCourse = currentCourse;
      try {
        const completedFlow = await api<LessonFlowProgress>(
          `/lessons/${encodeURIComponent(lessonId)}/flow`,
        );
        if (!completedFlow.completed) {
          throw new Error(t('error.detail'));
        }
        // The generated lesson flow has already validated its own ordered
        // activities. Mirror that server-authoritative completion into the
        // structured course projection. `advanceRlleLesson` remains the gate:
        // verification refuses missing evidence and no call grants mastery.
        for (let index = 0; index < currentLesson.stages.length; index += 1) {
          const activeLesson = nextCourse.currentLesson;
          const activeStage = activeLesson?.stages.find((stage) => stage.status === 'active');
          // Reconcile only the lesson whose completed flow was verified above.
          // Once the server advances to the next lesson, the remaining loop
          // iterations must not consume any of its stages.
          if (
            !activeLesson?.lessonId
            || activeLesson.lessonId !== lessonId
            || activeLesson.unitId !== currentLesson.unitId
            || !activeStage
          ) break;
          nextCourse = await advanceRlleLesson(
            profile.id,
            courseSession.id,
            activeLesson.lessonId,
            activeStage.kind,
          );
        }
        setCourseLoad({ kind: 'live', course: nextCourse });
      } catch (cause) {
        setError((cause as Error).message);
        setCourseLoad({ kind: 'live', course: nextCourse });
      } finally {
        setBusy(null);
        router.replace(cleanRoute);
      }
    };
    void reconcile();
  }, [completedLessonId, courseLoad, lessonFlowCompleted, profile, router, t, unitId]);

  if (!profile || !courseLoad) {
    if (error) return <SmartErrorState detail={error} retryable onRetry={() => void load()} />;
    return <SmartLoadingState title={copy('rlle.ui.course.loading')} />;
  }

  const course = courseLoad.kind === 'live' ? courseLoad.course : null;
  const units = courseLoad.kind === 'live' ? courseLoad.course.units : courseLoad.units;
  const requestedUnit = units.find((unit) => unit.id === unitId)
    ?? (course ? course.units.find((unit) => unit.status === 'in-progress') : undefined)
    ?? units[0]
    ?? null;
  const outline = course?.currentLesson?.unitId === requestedUnit?.id ? course.currentLesson : null;
  const mastery = course?.milestoneMastery.find((item) => item.unitId === requestedUnit?.id) ?? null;
  const nextMasteryTarget = featureFlags.languageMasteryV1
    ? course?.nextMasteryTarget ?? null
    : null;
  const open = (href: string) => router.push(href as never);
  const lessonRoute = (lessonId: string) => {
    const returnTo = `/languages/${profile.id}/course/lesson?unitId=${encodeURIComponent(outline?.unitId ?? requestedUnit?.id ?? '')}&lessonFlowCompleted=1&completedLessonId=${encodeURIComponent(lessonId)}`;
    const query = [
      course?.experienceSession?.id
        ? `session=${encodeURIComponent(course.experienceSession.id)}`
        : null,
      `returnTo=${encodeURIComponent(returnTo)}`,
    ];
    const remediation = mastery?.remediation;
    if (
      featureFlags.languageMasteryV1
      && remediation?.planId
      && remediation.lessonId === lessonId
    ) {
      query.push(
        `languageProfileId=${encodeURIComponent(profile.id)}`,
        `remediationPlanId=${encodeURIComponent(remediation.planId)}`,
        `failedAttemptId=${encodeURIComponent(remediation.sourceAttemptId)}`,
      );
    }
    return `/lesson/${encodeURIComponent(lessonId)}?${query.filter(Boolean).join('&')}`;
  };

  const start = async () => {
    if (!requestedUnit) return;
    setBusy('start');
    setError(null);
    try {
      const response = await startRlleLesson(profile.id, {
        unitId: requestedUnit.id,
        inputModality: 'mixed',
        idempotencyKey: `mobile-lesson:${profile.id}:${requestedUnit.id}`,
      });
      setCourseLoad({ kind: 'live', course: response.course });
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const togglePause = async () => {
    if (!outline || !course?.experienceSession) return;
    const shouldResume = outline.status === 'paused';
    setBusy('pause');
    setError(null);
    try {
      if (shouldResume) await resumeRlleSession(course.experienceSession.id);
      else await pauseRlleSession(course.experienceSession.id);
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const openScopedMasteryAssessment = (
    assessmentId: string,
    attemptId: string,
    scopeKind: 'milestone' | 'pillar_exam',
  ) => {
    if (!outline?.lessonId || !course?.experienceSession) return;
    const query = [
      'mastery=1',
      `languageProfileId=${encodeURIComponent(profile.id)}`,
      `experienceSessionId=${encodeURIComponent(course.experienceSession.id)}`,
      `lessonId=${encodeURIComponent(outline.lessonId)}`,
      `masteryAttemptId=${encodeURIComponent(attemptId)}`,
      `masteryScopeKind=${encodeURIComponent(scopeKind)}`,
    ].join('&');
    open(`/examiner/${encodeURIComponent(assessmentId)}?${query}`);
  };

  const startLegacyAutonomyAssessment = async () => {
    if (!outline?.lessonId || !course?.experienceSession || !mastery) return;
    setBusy('autonomy');
    setError(null);
    try {
      const response = await startRlleAutonomy(profile.id, {
        experienceSessionId: course.experienceSession.id,
        lessonId: outline.lessonId,
        idempotencyKey: `mobile-autonomy:${outline.lessonId}:${mastery.attempts.length + 1}`,
      });
      const query = [
        'autonomy=1',
        `languageProfileId=${encodeURIComponent(profile.id)}`,
        `experienceSessionId=${encodeURIComponent(course.experienceSession.id)}`,
        `lessonId=${encodeURIComponent(outline.lessonId)}`,
      ].join('&');
      open(`/examiner/${encodeURIComponent(response.assessment.id)}?${query}`);
    } catch (cause) {
      setError((cause as Error).message);
      await load().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };

  const startScopedMasteryAssessment = async () => {
    if (
      !outline?.lessonId
      || !course?.experienceSession
      || !nextMasteryTarget?.eligible
    ) return;
    setBusy('autonomy');
    setError(null);
    try {
      const response = await startRlleScopedMastery(profile.id, {
        experienceSessionId: course.experienceSession.id,
        lessonId: outline.lessonId,
        scopeKind: nextMasteryTarget.scopeKind,
        targetId: nextMasteryTarget.targetId,
        idempotencyKey: nextMasteryTarget.operationKey,
        remediationPlanId: nextMasteryTarget.remediationPlanId ?? undefined,
      });
      setCourseLoad({ kind: 'live', course: response.course });
      openScopedMasteryAssessment(
        response.assessment.id,
        response.attemptId,
        response.scopeKind,
      );
    } catch (cause) {
      setError((cause as Error).message);
      await load().catch(() => undefined);
    } finally {
      setBusy(null);
    }
  };

  const prepareAcousticMastery = async () => {
    if (
      !outline?.lessonId
      || !nextMasteryTarget
      || nextMasteryTarget.assessmentMode !== 'acoustic'
    ) return;
    setBusy('acoustic-prepare');
    setError(null);
    setAcousticFeedback(null);
    setAcousticRetryPending(false);
    try {
      const prompt = await loadRlleAcousticMasteryPrompt(outline.lessonId);
      if (!prompt) {
        setError(copy('rlle.ui.capabilities.blockedDetail'));
        return;
      }
      setAcousticPrompt({ ...prompt, operationKey: nextMasteryTarget.operationKey });
      setAcousticRecordings({});
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const toggleAcousticRecording = async (slot: AcousticRecordingSlot) => {
    if (busy === 'acoustic-submit') return;
    setError(null);
    setAcousticFeedback(null);
    if (acousticRecordingSlot) {
      if (acousticRecordingSlot !== slot) return;
      setBusy('acoustic-recording');
      try {
        const active = acousticRecorder.current;
        if (!active) throw new Error(copy('voice.error.notRecording'));
        const recording = await active.stop();
        setAcousticRecordings((current) => ({ ...current, [slot]: recording }));
        acousticRecorder.current = null;
        setAcousticRecordingSlot(null);
      } catch (cause) {
        acousticRecorder.current?.cancel();
        acousticRecorder.current = null;
        setAcousticRecordingSlot(null);
        setError((cause as Error).message);
      } finally {
        setBusy(null);
      }
      return;
    }
    setBusy('acoustic-recording');
    try {
      acousticRecorder.current = createRecorder();
      await acousticRecorder.current.start();
      setAcousticRecordingSlot(slot);
    } catch (cause) {
      acousticRecorder.current?.cancel();
      acousticRecorder.current = null;
      setError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const submitAcousticMastery = async () => {
    if (
      !outline?.lessonId
      || !course?.experienceSession
      || !nextMasteryTarget
      || nextMasteryTarget.assessmentMode !== 'acoustic'
      || !acousticPrompt
      || acousticPrompt.operationKey !== nextMasteryTarget.operationKey
      || !acousticRecordings.scripted
      || !acousticRecordings.spontaneous
    ) return;
    setBusy('acoustic-submit');
    setError(null);
    setAcousticFeedback(null);
    setAcousticRetryPending(false);
    try {
      const response = await submitRlleAcousticMastery(profile.id, {
        experienceSessionId: course.experienceSession.id,
        lessonId: outline.lessonId,
        targetId: nextMasteryTarget.targetId,
        idempotencyKey: nextMasteryTarget.operationKey,
        exerciseIndex: acousticPrompt.exerciseIndex,
        scriptedRecording: acousticRecordings.scripted,
        spontaneousRecording: acousticRecordings.spontaneous,
        remediationPlanId: nextMasteryTarget.remediationPlanId ?? undefined,
      });
      const evaluable = response.outcome === 'evaluated';
      setAcousticFeedback({
        tone: evaluable && response.decision.verdict === 'mastered' ? 'success' : 'warning',
        title: copy(`rlle.ui.autonomy.verdict.${response.decision.verdict}`),
      });
      setAcousticRecordings({});
      setAcousticPrompt(null);
      await load();
    } catch (cause) {
      // Keep both blobs and the stable operation key so a transient network
      // failure can be retried without recording or charging twice.
      setAcousticRetryPending(true);
      setError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const resumeScopedMasteryAssessment = () => {
    if (
      !nextMasteryTarget?.activeAttemptId
      || !nextMasteryTarget.assessmentId
    ) return;
    openScopedMasteryAssessment(
      nextMasteryTarget.assessmentId,
      nextMasteryTarget.activeAttemptId,
      nextMasteryTarget.scopeKind,
    );
  };

  const resumeLegacyAutonomyAssessment = () => {
    if (!outline?.lessonId || !course?.experienceSession || !course.latestAssessment) return;
    const query = [
      'autonomy=1',
      `languageProfileId=${encodeURIComponent(profile.id)}`,
      `experienceSessionId=${encodeURIComponent(course.experienceSession.id)}`,
      `lessonId=${encodeURIComponent(outline.lessonId)}`,
    ].join('&');
    open(`/examiner/${encodeURIComponent(course.latestAssessment.id)}?${query}`);
  };

  const startTargetedRemediation = async () => {
    if (!outline?.lessonId || !course?.experienceSession || !mastery?.remediation) return;
    setBusy('remediation');
    setError(null);
    try {
      const response = await startRlleRemediation(profile.id, {
        experienceSessionId: course.experienceSession.id,
        lessonId: outline.lessonId,
        idempotencyKey: `mobile-remediation:${profile.id}:${outline.unitId}:${mastery.remediation.sourceAttemptId}`,
        failedAttemptId: mastery.remediation.sourceAttemptId,
      });
      setCourseLoad({ kind: 'live', course: response.course });
      setNotice(copy('rlle.ui.remediation.ready'));
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const activeStageIndex = outline?.stages.findIndex((stage) => stage.status === 'active') ?? -1;
  const acousticAssessmentOwnsAction = nextMasteryTarget?.assessmentMode === 'acoustic'
    && (nextMasteryTarget.eligible || nextMasteryTarget.blockedReason === 'capability-unavailable');
  const hasContinueAction = outline?.status === 'active'
    && !acousticAssessmentOwnsAction
    && (
      activeStageIndex >= 0
      || Boolean(nextMasteryTarget?.activeAttemptId && nextMasteryTarget.assessmentId)
      || Boolean(nextMasteryTarget?.eligible)
      || (!featureFlags.languageMasteryV1
        && ['autonomy-ready', 'autonomy-active', 'autonomy-grading'].includes(mastery?.status ?? ''))
      || mastery?.status === 'remediation'
    );
  const continueLesson = () => {
    if (
      nextMasteryTarget?.assessmentMode !== 'acoustic'
      && nextMasteryTarget?.activeAttemptId
      && nextMasteryTarget.assessmentId
    ) {
      resumeScopedMasteryAssessment();
      return;
    }
    if (nextMasteryTarget?.eligible && nextMasteryTarget.assessmentMode !== 'acoustic') {
      void startScopedMasteryAssessment();
      return;
    }
    if (!featureFlags.languageMasteryV1 && mastery?.status === 'autonomy-ready') {
      void startLegacyAutonomyAssessment();
      return;
    }
    if (
      !featureFlags.languageMasteryV1
      && ['autonomy-active', 'autonomy-grading'].includes(mastery?.status ?? '')
      && course?.latestAssessment
    ) {
      resumeLegacyAutonomyAssessment();
      return;
    }
    if (mastery?.status === 'remediation' && !mastery.remediation?.lessonId) {
      void startTargetedRemediation();
      return;
    }
    if (mastery?.status === 'remediation' && mastery.remediation?.lessonId) {
      open(lessonRoute(mastery.remediation.lessonId));
      return;
    }
    if (outline?.lessonId) open(lessonRoute(outline.lessonId));
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Page width="wide">
        <PageHeader
          eyebrow={copy('rlle.ui.lesson.eyebrow')}
          title={outline?.title ?? (requestedUnit ? copy(requestedUnit.titleCode) : copy('rlle.ui.lesson.title'))}
          description={outline?.communicativeObjective ?? (requestedUnit ? copy(requestedUnit.objectiveCode) : copy('rlle.ui.lesson.noActive'))}
          action={requestedUnit ? <Badge label={requestedUnit.level} tone="info" /> : undefined}
        />
        {courseLoad.kind === 'preview' ? <Alert tone="warning" title={copy('rlle.ui.hub.courseUnavailable')} /> : null}
        {error ? (
          <SmartErrorState
            detail={error}
            retryable
            onRetry={acousticRetryPending
              ? () => void submitAcousticMastery()
              : () => void load()}
          />
        ) : null}
        {notice ? <Alert tone="success" title={notice} /> : null}
        {acousticFeedback ? <Alert tone={acousticFeedback.tone} title={acousticFeedback.title} /> : null}
        {course?.experienceSession ? <ContextBar items={course.experienceSession.activeContexts.items} /> : null}
        {course ? (
          <LanguageMasteryBulletins
            bulletins={course.masteryBulletins}
            units={course.units}
            language={profile.language}
          />
        ) : null}

        {!outline ? (
          <Card elevated style={{ gap: spacing.md, borderColor: c.aiAccent }}>
            <Badge label={copy('rlle.ui.lesson.intro')} tone="ai" />
            <Text style={[typography.h2, { color: c.textPrimary }]}>{requestedUnit ? copy(requestedUnit.titleCode) : copy('rlle.ui.lesson.title')}</Text>
            <Text style={[typography.body, { color: c.textSecondary }]}>{requestedUnit ? copy(requestedUnit.objectiveCode) : copy('rlle.ui.lesson.noActive')}</Text>
            <Text style={[typography.caption, { color: c.textMuted }]}>{copy('rlle.ui.lesson.proofNote')}</Text>
            <Button label={copy('rlle.ui.lesson.start')} variant="ai" loading={busy === 'start'} disabled={!course || !requestedUnit} onPress={() => void start()} />
          </Card>
        ) : (
          <ResponsiveSplit
            secondaryWidth={320}
            primary={
              <Section title={copy('rlle.ui.lesson.path')} description={copy('rlle.ui.lesson.proofNote')}>
                <LessonStages outline={outline} />
              </Section>
            }
            secondary={
              <View style={{ gap: spacing.md }}>
                <Card style={{ gap: spacing.sm }}>
                  <Badge label={copy(`rlle.ui.course.status.${outline.status === 'active' ? 'in-progress' : outline.status}`)} tone={outline.status === 'completed' ? 'success' : 'ai'} />
                  <Text style={[typography.title, { color: c.textPrimary }]}>{outline.title}</Text>
                  <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{outline.communicativeObjective}</Text>
                  {outline.status !== 'completed' ? <Button variant="ghost" label={copy(outline.status === 'paused' ? 'rlle.ui.lesson.resume' : 'rlle.ui.course.pause')} loading={busy === 'pause'} onPress={() => void togglePause()} /> : null}
                </Card>
                {hasContinueAction ? (
                  <Button
                    testID="language-lesson-continue"
                    label={t('lesson.continue')}
                    loading={Boolean(busy)}
                    disabled={Boolean(busy)}
                    onPress={continueLesson}
                  />
                ) : null}
                {outline.status === 'active'
                  && nextMasteryTarget?.assessmentMode === 'acoustic'
                  && !nextMasteryTarget.eligible
                  && nextMasteryTarget.blockedReason === 'capability-unavailable' ? (
                    <Card
                      testID="language-acoustic-capability-blocked"
                      style={{ gap: spacing.sm, borderColor: c.warning }}
                    >
                      <Badge
                        label={copy('rlle.ui.capabilities.notEvaluable')}
                        tone="warning"
                      />
                      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
                        {copy('rlle.ui.capabilities.blockedDetail')}
                      </Text>
                    </Card>
                  ) : null}
                {outline.status === 'active'
                  && nextMasteryTarget?.eligible
                  && nextMasteryTarget.assessmentMode === 'acoustic' ? (
                    <Card testID="language-acoustic-mastery" style={{ gap: spacing.sm }}>
                      <Badge label={copy('rlle.ui.training.format.voice-pronunciation')} tone="ai" />
                      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
                        {copy('rlle.ui.capabilities.detail')}
                      </Text>
                      {!RECORDING_SUPPORTED ? (
                        <Alert tone="warning" title={copy('learn.oral.noVoice')} />
                      ) : !acousticPrompt
                        || acousticPrompt.operationKey !== nextMasteryTarget.operationKey ? (
                          <Button
                            testID="language-acoustic-prepare"
                            variant="ai"
                            label={copy('rlle.ui.autonomy.start')}
                            loading={busy === 'acoustic-prepare'}
                            onPress={() => void prepareAcousticMastery()}
                          />
                        ) : (
                          <>
                            <View style={{ gap: spacing.xs }}>
                              <Text style={[typography.label, { color: c.textPrimary }]}>
                                {copy('lesson.readAloud')}
                              </Text>
                              <Text style={[typography.body, { color: c.textPrimary }]}>
                                {acousticPrompt.referenceText}
                              </Text>
                              {acousticRecordings.scripted ? (
                                <Badge label={copy('learn.oral.ready')} tone="success" />
                              ) : null}
                              <Button
                                testID="language-acoustic-scripted-record"
                                variant="secondary"
                                icon={acousticRecordingSlot === 'scripted' ? '■' : '🎙'}
                                label={acousticRecordingSlot === 'scripted'
                                  ? copy('learn.oral.stop')
                                  : acousticRecordings.scripted
                                    ? copy('rlle.ui.common.retry')
                                    : copy('lang.record')}
                                disabled={Boolean(acousticRecordingSlot && acousticRecordingSlot !== 'scripted')}
                                onPress={() => void toggleAcousticRecording('scripted')}
                              />
                            </View>
                            <View style={{ gap: spacing.xs }}>
                              <Text style={[typography.label, { color: c.textPrimary }]}>
                                {copy('lang.speakFreely')}
                              </Text>
                              <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
                                {acousticPrompt.spontaneousPrompt}
                              </Text>
                              {acousticRecordings.spontaneous ? (
                                <Badge label={copy('learn.oral.ready')} tone="success" />
                              ) : null}
                              <Button
                                testID="language-acoustic-spontaneous-record"
                                variant="secondary"
                                icon={acousticRecordingSlot === 'spontaneous' ? '■' : '🎙'}
                                label={acousticRecordingSlot === 'spontaneous'
                                  ? copy('learn.oral.stop')
                                  : acousticRecordings.spontaneous
                                    ? copy('rlle.ui.common.retry')
                                    : copy('lang.record')}
                                disabled={Boolean(acousticRecordingSlot && acousticRecordingSlot !== 'spontaneous')}
                                onPress={() => void toggleAcousticRecording('spontaneous')}
                              />
                            </View>
                            <Button
                              testID="language-acoustic-submit"
                              variant="ai"
                              label={copy(acousticRetryPending
                                ? 'rlle.ui.common.retry'
                                : 'rlle.ui.autonomy.start')}
                              loading={busy === 'acoustic-submit'}
                              disabled={Boolean(
                                acousticRecordingSlot
                                || !acousticRecordings.scripted
                                || !acousticRecordings.spontaneous
                              )}
                              onPress={() => void submitAcousticMastery()}
                            />
                          </>
                        )}
                    </Card>
                  ) : null}
                <Button variant="ghost" label={copy('rlle.ui.common.backCourse')} onPress={() => router.replace(`/languages/${profile.id}/course` as never)} />
              </View>
            }
          />
        )}
      </Page>
    </ScrollView>
  );
}
