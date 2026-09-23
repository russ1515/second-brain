import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  CEFR_LEVELS,
  IMMERSION_INTENSITIES,
  LANGUAGE_CORRECTION_INTENSITIES,
  RLLE_GOAL_DOMAINS,
  defaultImmersionForLevel,
  isCefrAtLeast,
  type CefrLevel,
  type ImmersionIntensity,
  type LanguageCorrectionIntensity,
  type LanguageProfileDetail,
  type RlleCourseView,
  type RlleCurriculumUnit,
  type RlleCurriculumUnitTemplate,
  type RlleGoalDomain,
} from '@second-brain/shared';
import { Alert, Badge, Button, Card, Progress, SegmentedControl } from '../../../../components/ds/core';
import { Page, PageHeader, ResponsiveSplit, Section } from '../../../../components/ds/layout';
import { SmartErrorState, SmartLoadingState } from '../../../../components/ds/states';
import { ContextBar } from '../../../../components/context/context-bar';
import { CurriculumMap, DimensionProgress, LevelSummary, RecoveryPanel } from '../../../../components/language/course-ui';
import { useTokens } from '../../../../lib/design/theme';
import { actionDestinationHref } from '../../../../lib/action-destination';
import { useRlleCopy } from '../../../../lib/language-rll-i18n';
import {
  loadLanguageProfile,
  loadRlleCourse,
  pauseRlleSession,
  resumeRlleSession,
  startRlleCourse,
  updateRlleCoursePreferences,
  type RlleCourseLoad,
} from '../../../../lib/language-rll-client';

const START_POINTS = ['zero', 'declared-level'] as const;

export default function LanguageCourseScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  const [profile, setProfile] = useState<LanguageProfileDetail | null>(null);
  const [courseLoad, setCourseLoad] = useState<RlleCourseLoad | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    setError(null);
    try {
      const [nextProfile, nextCourse] = await Promise.all([
        loadLanguageProfile(profileId),
        loadRlleCourse(profileId),
      ]);
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
  const open = (href: string) => router.push(href as never);
  const openUnit = (unit: RlleCurriculumUnit | RlleCurriculumUnitTemplate) => {
    open(`/languages/${encodeURIComponent(profile.id)}/course/lesson?unitId=${encodeURIComponent(unit.id)}`);
  };
  const actionCopy = course?.nextBestAction
    ? localizedCourseAction(course, profile, copy)
    : null;
  const hasBrainEvidence = Boolean(
    course?.canDoMap.some((item) => item.evidence.length > 0) ||
    course?.progress.dimensions.some((item) => item.evidenceCount > 0),
  );

  const resume = async () => {
    if (!course?.experienceSession) return;
    setBusy('resume');
    setError(null);
    try {
      await resumeRlleSession(course.experienceSession.id);
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const pause = async () => {
    if (!course?.experienceSession) return;
    setBusy('pause');
    setError(null);
    try {
      await pauseRlleSession(course.experienceSession.id);
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Page width="wide">
        <PageHeader
          eyebrow={copy('rlle.ui.course.eyebrow')}
          title={copy('rlle.ui.course.title', { language: profile.language })}
          description={copy('rlle.ui.course.subtitle')}
          action={<Badge label={`${profile.cefrLevel} · ${copy('rlle.ui.cefr')}`} tone="info" />}
        />
        {error ? <SmartErrorState detail={error} retryable onRetry={() => void load()} /> : null}
        {courseLoad.kind === 'preview' ? <Alert tone="warning" title={copy('rlle.ui.hub.courseUnavailable')} detail={copy('rlle.ui.course.offline')} /> : null}
        {course?.experienceSession ? <ContextBar items={course.experienceSession.activeContexts.items} /> : null}

        {course?.status === 'not-started' ? (
          <StartCourseCard profile={profile} onStarted={(next) => setCourseLoad({ kind: 'live', course: next })} />
        ) : null}

        {course && course.status !== 'not-started' ? (
          <View style={{ gap: spacing.md }}>
            <Card elevated style={{ gap: spacing.md, borderColor: c.aiAccent }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm, flexWrap: 'wrap' }}>
                <Badge label={copy(`rlle.ui.course.status.${course.status === 'active' ? 'in-progress' : course.status}`)} tone={course.status === 'completed' ? 'success' : 'ai'} />
                {course.progress.percent != null ? <Text style={[typography.h3, { color: c.textPrimary }]}>{course.progress.percent}%</Text> : null}
              </View>
              {course.progress.percent != null ? <Progress value={course.progress.percent} tone="ai" /> : null}
              <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
                {course.progress.totalUnits > 0
                  ? copy('rlle.ui.course.progressUnits', { done: course.progress.completedUnits, total: course.progress.totalUnits })
                  : copy('rlle.ui.course.progressUnknown')}
              </Text>
              {course.currentLesson ? (
                <View style={{ gap: spacing.xs }}>
                  <Text style={[typography.label, { color: c.textMuted }]}>{copy('rlle.ui.lesson.title')}</Text>
                  <Text style={[typography.h3, { color: c.textPrimary }]}>{course.currentLesson.title}</Text>
                  <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{course.currentLesson.communicativeObjective}</Text>
                  <Button label={copy('rlle.ui.course.current')} variant="ai" onPress={() => open(`/languages/${profile.id}/course/lesson?unitId=${encodeURIComponent(course.currentLesson!.unitId)}`)} />
                </View>
              ) : null}
              {course.status === 'paused' ? <Button label={copy('rlle.ui.course.resume')} loading={busy === 'resume'} onPress={() => void resume()} /> : null}
              {course.status === 'active' && course.experienceSession ? <Button label={copy('rlle.ui.course.pause')} variant="ghost" loading={busy === 'pause'} onPress={() => void pause()} /> : null}
            </Card>

            {course.nextBestAction ? (
              <Card style={{ gap: spacing.sm, borderColor: c.aiAccent }}>
                <Badge label={copy('rlle.ui.nba.badge')} tone="ai" />
                <Text style={[typography.h3, { color: c.textPrimary }]}>{actionCopy?.title}</Text>
                <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{actionCopy?.reason}</Text>
                <Button label={actionCopy?.action ?? course.nextBestAction.primaryAction.label} variant="ai" onPress={() => open(actionDestinationHref(course.nextBestAction!.destination))} />
              </Card>
            ) : null}
          </View>
        ) : null}

        <ResponsiveSplit
          secondaryWidth={340}
          primary={
            <Section title={copy('rlle.ui.course.curriculum')} description={copy('rlle.ui.course.curriculumDetail')}>
              <CurriculumMap units={units} tracked={Boolean(course && course.status !== 'not-started')} onOpenUnit={openUnit} />
            </Section>
          }
          secondary={
            <View style={{ gap: spacing.md }}>
              {course ? <LevelSummary course={course} /> : (
                <Card style={{ gap: spacing.sm }}>
                  <Text style={[typography.title, { color: c.textPrimary }]}>{copy('rlle.ui.course.levels')}</Text>
                  <Badge label={`${profile.cefrLevel} · ${copy('rlle.ui.course.level.declared')}`} tone="info" />
                  <Text style={[typography.caption, { color: c.textSecondary }]}>{copy('rlle.ui.course.declaredWarning', { level: profile.cefrLevel })}</Text>
                </Card>
              )}
              {course && course.status !== 'not-started' && course.status !== 'completed' ? (
                <CoursePreferencesCard
                  course={course}
                  onUpdated={(next) => setCourseLoad({ kind: 'live', course: next })}
                />
              ) : null}
              {course ? <DimensionProgress course={course} /> : null}
              {course ? <RecoveryPanel course={course} /> : null}
              <Card style={{ gap: spacing.sm }}>
                <Button variant="secondary" label={copy('rlle.ui.mission.title')} onPress={() => open(`/languages/${profile.id}/course/missions`)} />
                <Button variant="secondary" label={copy('rlle.ui.cando.open')} onPress={() => open(`/languages/${profile.id}/course/can-do`)} />
                <Button variant="ghost" label={copy('rlle.ui.course.professor')} onPress={() => open(`/languages/${profile.id}?practice=conversation`)} />
                <Button variant="ghost" label={copy('rlle.ui.course.review')} onPress={() => open(`/revision?languageProfileId=${profile.id}&returnTo=course${course?.experienceSession ? `&sourceSessionId=${encodeURIComponent(course.experienceSession.id)}` : ''}`)} />
                {hasBrainEvidence ? <Button variant="ghost" label={copy('rlle.ui.course.brain')} onPress={() => open(`/brain?languageProfileId=${profile.id}`)} /> : null}
              </Card>
            </View>
          }
        />
      </Page>
    </ScrollView>
  );
}

function StartCourseCard({ profile, onStarted }: { profile: LanguageProfileDetail; onStarted: (course: RlleCourseView) => void }) {
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  const [startFrom, setStartFrom] = useState<(typeof START_POINTS)[number]>('declared-level');
  const [targetLevel, setTargetLevel] = useState<CefrLevel>(profile.cefrLevel);
  const [goalDomain, setGoalDomain] = useState<RlleGoalDomain>('general');
  const startLevel = startFrom === 'zero' ? 'A1' : profile.cefrLevel;
  const [immersion, setImmersion] = useState<ImmersionIntensity>(
    defaultImmersionForLevel(startLevel),
  );
  const [correction, setCorrection] = useState<LanguageCorrectionIntensity>('balanced');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const targetOptions = CEFR_LEVELS.filter((level) => isCefrAtLeast(level, startLevel));
  const effectiveTargetLevel = isCefrAtLeast(targetLevel, startLevel) ? targetLevel : startLevel;

  useEffect(() => {
    setImmersion(defaultImmersionForLevel(startLevel));
  }, [startLevel]);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await startRlleCourse(profile.id, {
        startFrom,
        targetLevel: effectiveTargetLevel,
        goalDomain,
        ...(profile.goal ? { goal: profile.goal } : {}),
        immersionIntensity: immersion,
        correctionIntensity: correction,
        idempotencyKey: `mobile-course:${profile.id}:${startFrom}:${effectiveTargetLevel}:${goalDomain}`,
      });
      onStarted(response.course);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card elevated style={{ gap: spacing.md, borderColor: c.aiAccent }} testID="rll-start-course">
      <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{copy('rlle.ui.course.notStarted')}</Text>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy('rlle.ui.course.notStartedDetail')}</Text>
      <SegmentedControl options={START_POINTS} value={startFrom} onChange={setStartFrom} labelFor={(value) => copy(value === 'zero' ? 'rlle.ui.course.startZero' : 'rlle.ui.course.startDeclared')} />
      {startFrom === 'declared-level' ? <Alert tone="info" title={copy('rlle.ui.course.declaredWarning', { level: profile.cefrLevel })} /> : null}
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.label, { color: c.textMuted }]}>{copy('rlle.ui.course.targetLevel')}</Text>
        <SegmentedControl
          options={targetOptions}
          value={effectiveTargetLevel}
          onChange={setTargetLevel}
        />
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.label, { color: c.textMuted }]}>{copy('rlle.ui.course.goalDomain')}</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
          {RLLE_GOAL_DOMAINS.map((domain) => (
            <Button key={domain} size="sm" variant={goalDomain === domain ? 'primary' : 'secondary'} label={copy(`rlle.ui.course.goal.${domain}`)} onPress={() => setGoalDomain(domain)} />
          ))}
        </View>
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.label, { color: c.textMuted }]}>{copy('languages11.immersion.title')}</Text>
        <SegmentedControl options={IMMERSION_INTENSITIES} value={immersion} onChange={setImmersion} labelFor={(value) => copy(`languages11.immersion.${value}`)} />
      </View>
      <View style={{ gap: spacing.xs }}>
        <Text style={[typography.label, { color: c.textMuted }]}>{copy('languages11.correction.title')}</Text>
        <SegmentedControl options={LANGUAGE_CORRECTION_INTENSITIES} value={correction} onChange={setCorrection} labelFor={(value) => copy(`languages11.correction.${value}`)} />
      </View>
      {error ? <SmartErrorState detail={error} retryable onRetry={() => void start()} /> : null}
      <Button label={copy('rlle.ui.course.start')} variant="ai" loading={busy} onPress={() => void start()} />
    </Card>
  );
}

function CoursePreferencesCard({
  course,
  onUpdated,
}: {
  course: RlleCourseView;
  onUpdated: (course: RlleCourseView) => void;
}) {
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  const [immersion, setImmersion] = useState(course.immersionIntensity);
  const [correction, setCorrection] = useState(course.correctionIntensity);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setImmersion(course.immersionIntensity);
    setCorrection(course.correctionIntensity);
  }, [course.correctionIntensity, course.immersionIntensity]);

  const changed = immersion !== course.immersionIntensity || correction !== course.correctionIntensity;
  const save = async () => {
    if (!changed) return;
    setBusy(true);
    setNotice(false);
    setError(null);
    try {
      onUpdated(await updateRlleCoursePreferences(course.profileId, {
        immersionIntensity: immersion,
        correctionIntensity: correction,
      }));
      setNotice(true);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={{ gap: spacing.sm }} testID="rlle-course-preferences">
      <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{copy('rlle.ui.course.preferences.title')}</Text>
      <Text style={[typography.caption, { color: c.textSecondary }]}>{copy('rlle.ui.course.preferences.detail')}</Text>
      <Text style={[typography.label, { color: c.textMuted }]}>{copy('languages11.immersion.title')}</Text>
      <SegmentedControl options={IMMERSION_INTENSITIES} value={immersion} onChange={setImmersion} labelFor={(value) => copy(`languages11.immersion.${value}`)} />
      <Text style={[typography.label, { color: c.textMuted }]}>{copy('languages11.correction.title')}</Text>
      <SegmentedControl options={LANGUAGE_CORRECTION_INTENSITIES} value={correction} onChange={setCorrection} labelFor={(value) => copy(`languages11.correction.${value}`)} />
      {notice ? <Alert tone="success" title={copy('rlle.ui.course.preferences.saved')} /> : null}
      {error ? <Alert tone="error" title={copy('rlle.ui.course.preferences.error')} detail={error} /> : null}
      <Button label={copy('rlle.ui.course.preferences.save')} variant="secondary" loading={busy} disabled={!changed} onPress={() => void save()} />
    </Card>
  );
}

function localizedCourseAction(
  course: RlleCourseView,
  profile: LanguageProfileDetail,
  copy: (key: string, values?: Record<string, string | number>) => string,
): { title: string; reason: string; action: string } {
  const signal = course.nextBestAction?.signalsUsed[0]?.signal;
  if (signal === 'language-fsrs-due') {
    return {
      title: copy('rlle.ui.nba.review', { count: profile.vocabDue }),
      reason: copy('rlle.ui.nba.reviewReason', { count: profile.vocabDue }),
      action: copy('rlle.ui.nba.reviewAction'),
    };
  }
  if (signal === 'active-language-mission') {
    const retry = course.currentMission?.status === 'needs-retry';
    return {
      title: copy(retry ? 'rlle.ui.nba.retryMission' : 'rlle.ui.nba.resumeMission'),
      reason: copy(retry ? 'rlle.ui.nba.retryMissionReason' : 'rlle.ui.nba.resumeMissionReason'),
      action: copy('rlle.ui.course.resume'),
    };
  }
  if (signal === 'active-language-lesson') {
    return {
      title: copy('rlle.ui.nba.resumeLesson'),
      reason: copy('rlle.ui.nba.resumeLessonReason'),
      action: copy('rlle.ui.course.resume'),
    };
  }
  return {
    title: copy('rlle.ui.nba.nextLesson'),
    reason: copy('rlle.ui.nba.nextLessonReason'),
    action: copy('rlle.ui.nba.nextLessonAction'),
  };
}
