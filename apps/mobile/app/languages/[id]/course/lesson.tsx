import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type { LanguageProfileDetail, RlleCourseView, RlleLessonStageKind } from '@second-brain/shared';
import { Alert, Badge, Button, Card } from '../../../../components/ds/core';
import { Page, PageHeader, ResponsiveSplit, Section } from '../../../../components/ds/layout';
import { SmartErrorState, SmartLoadingState } from '../../../../components/ds/states';
import { ContextBar } from '../../../../components/context/context-bar';
import { LessonStages } from '../../../../components/language/course-ui';
import { useTokens } from '../../../../lib/design/theme';
import { useRlleCopy } from '../../../../lib/language-rll-i18n';
import {
  advanceRlleLesson,
  loadLanguageProfile,
  loadRlleCourse,
  pauseRlleSession,
  resumeRlleSession,
  startRlleLesson,
  type RlleCourseLoad,
} from '../../../../lib/language-rll-client';

export default function StructuredLanguageLessonScreen() {
  const params = useLocalSearchParams<{ id: string | string[]; unitId?: string | string[] }>();
  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;
  const unitId = Array.isArray(params.unitId) ? params.unitId[0] : params.unitId;
  const router = useRouter();
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  const [profile, setProfile] = useState<LanguageProfileDetail | null>(null);
  const [courseLoad, setCourseLoad] = useState<RlleCourseLoad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

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
  const open = (href: string) => router.push(href as never);

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

  const completeStage = async () => {
    if (!outline?.lessonId || !course?.experienceSession) return;
    const activeStage = outline.stages.find((stage) => stage.status === 'active');
    if (!activeStage) return;
    setBusy('complete');
    setError(null);
    try {
      const nextCourse = await advanceRlleLesson(
        profile.id,
        course.experienceSession.id,
        outline.lessonId,
        activeStage.kind,
      );
      setCourseLoad({ kind: 'live', course: nextCourse });
      if (nextCourse.currentLesson?.status === 'completed') {
        setNotice(copy('rlle.ui.lesson.completed'));
      }
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

  const openStage = (kind: RlleLessonStageKind) => {
    if (!course?.experienceSession) return;
    const query = `courseSessionId=${encodeURIComponent(course.experienceSession.id)}`;
    const formatByStage: Partial<Record<RlleLessonStageKind, string>> = {
      vocabulary: 'vocabulary',
      'grammar-verbs': 'grammar',
      comprehension: 'comprehension',
      oral: 'oral',
      writing: 'writing',
      review: 'review',
    };
    const format = formatByStage[kind] ?? 'conversation';
    const courseContext = `${query}&unitId=${encodeURIComponent(outline?.unitId ?? requestedUnit?.id ?? '')}&lessonId=${encodeURIComponent(outline?.lessonId ?? '')}&stage=${encodeURIComponent(kind)}`;
    if (format === 'review') open(`/revision?languageProfileId=${profile.id}&returnTo=course&sourceSessionId=${encodeURIComponent(course.experienceSession.id)}`);
    else open(`/languages/${profile.id}?practice=${format}&${courseContext}`);
  };
  const activeStageIndex = outline?.stages.findIndex((stage) => stage.status === 'active') ?? -1;
  const isLastStage = Boolean(outline && activeStageIndex === outline.stages.length - 1);

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
        {error ? <SmartErrorState detail={error} retryable onRetry={() => void load()} /> : null}
        {notice ? <Alert tone="success" title={notice} /> : null}
        {course?.experienceSession ? <ContextBar items={course.experienceSession.activeContexts.items} /> : null}

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
                <LessonStages outline={outline} onStage={openStage} />
              </Section>
            }
            secondary={
              <View style={{ gap: spacing.md }}>
                <Card style={{ gap: spacing.sm }}>
                  <Badge label={copy(`rlle.ui.course.status.${outline.status === 'active' ? 'in-progress' : outline.status}`)} tone={outline.status === 'completed' ? 'success' : 'ai'} />
                  <Text style={[typography.title, { color: c.textPrimary }]}>{outline.title}</Text>
                  <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{outline.communicativeObjective}</Text>
                  {outline.lessonId ? <Button variant="secondary" label={copy('rlle.ui.lesson.openGenerated')} onPress={() => open(`/lesson/${encodeURIComponent(outline.lessonId!)}`)} /> : null}
                  {outline.status !== 'completed' ? <Button variant="ghost" label={copy(outline.status === 'paused' ? 'rlle.ui.lesson.resume' : 'rlle.ui.course.pause')} loading={busy === 'pause'} onPress={() => void togglePause()} /> : null}
                </Card>
                {outline.status === 'active' && activeStageIndex >= 0 ? (
                  <Button
                    label={copy(isLastStage ? 'rlle.ui.lesson.complete' : 'rlle.ui.lesson.completeStage')}
                    loading={busy === 'complete'}
                    onPress={() => void completeStage()}
                  />
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
