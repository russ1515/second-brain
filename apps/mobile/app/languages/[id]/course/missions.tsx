import { useCallback, useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  RLLE_MISSION_CATEGORIES,
  RLLE_WORLD_MISSIONS,
  type InputModality,
  type LanguageProfileDetail,
  type RlleMissionCategory,
  type RlleWorldMissionTemplate,
} from '@second-brain/shared';
import { Alert, Badge, Button, Card, SegmentedControl } from '../../../../components/ds/core';
import { Page, PageHeader, ResponsiveSplit } from '../../../../components/ds/layout';
import { SmartErrorState, SmartLoadingState } from '../../../../components/ds/states';
import { MissionList } from '../../../../components/language/course-ui';
import { useTokens } from '../../../../lib/design/theme';
import { actionDestinationHref } from '../../../../lib/action-destination';
import { useRlleCopy } from '../../../../lib/language-rll-i18n';
import {
  loadLanguageProfile,
  loadRlleCourse,
  loadRlleMissions,
  startRlleMission,
  type RlleCourseLoad,
  type RlleMissionCatalog,
} from '../../../../lib/language-rll-client';

const MISSION_MODALITIES = ['text', 'voice', 'mixed'] as const satisfies readonly InputModality[];

export default function WorldMissionsScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  const [profile, setProfile] = useState<LanguageProfileDetail | null>(null);
  const [courseLoad, setCourseLoad] = useState<RlleCourseLoad | null>(null);
  const [catalog, setCatalog] = useState<RlleMissionCatalog | null>(null);
  const [category, setCategory] = useState<RlleMissionCategory | 'all'>('all');
  const [modality, setModality] = useState<(typeof MISSION_MODALITIES)[number]>('mixed');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    setError(null);
    try {
      const [nextProfile, nextCourse, nextCatalog] = await Promise.all([
        loadLanguageProfile(profileId),
        loadRlleCourse(profileId),
        loadRlleMissions(profileId),
      ]);
      setProfile(nextProfile);
      setCourseLoad(nextCourse);
      setCatalog(nextCatalog);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [profileId]);

  useEffect(() => { void load(); }, [load]);

  if (!profile || !catalog || !courseLoad) {
    if (error) return <SmartErrorState detail={error} retryable onRetry={() => void load()} />;
    return <SmartLoadingState title={copy('rlle.ui.course.loading')} />;
  }

  const course = courseLoad.kind === 'live' ? courseLoad.course : null;
  const currentMissionTemplate = course?.currentMission
    ? RLLE_WORLD_MISSIONS.find((mission) => mission.id === course.currentMission?.missionId)
    : null;

  const start = async (mission: RlleWorldMissionTemplate) => {
    setBusy(mission.id);
    setError(null);
    try {
      const response = await startRlleMission(profile.id, {
        missionId: mission.id,
        inputModality: modality,
        idempotencyKey: `mobile-mission:${profile.id}:${mission.id}`,
      });
      router.push(actionDestinationHref(response.destination) as never);
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
          eyebrow={copy('rlle.ui.mission.eyebrow')}
          title={copy('rlle.ui.mission.title')}
          description={copy('rlle.ui.mission.subtitle')}
          action={<Badge label={`${profile.language} · ${profile.cefrLevel}`} tone="info" />}
        />
        {error ? <SmartErrorState detail={error} retryable onRetry={() => void load()} /> : null}
        {!catalog.live ? <Alert tone="warning" title={copy('rlle.ui.mission.notAvailable')} /> : null}

        <ResponsiveSplit
          secondaryWidth={320}
          secondaryFirstOnCompact
          primary={<MissionList items={catalog.items} selectedCategory={category} onStart={(mission) => void start(mission)} />}
          secondary={
            <View style={{ gap: spacing.md }}>
              <Card style={{ gap: spacing.md }}>
                <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{copy('rlle.ui.mission.category')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  <Button size="sm" variant={category === 'all' ? 'primary' : 'secondary'} label={copy('rlle.ui.mission.all')} onPress={() => setCategory('all')} />
                  {RLLE_MISSION_CATEGORIES.map((item) => (
                    <Button key={item} size="sm" variant={category === item ? 'primary' : 'secondary'} label={copy(`rlle.ui.category.${item}`)} onPress={() => setCategory(item)} />
                  ))}
                </View>
              </Card>
              <Card style={{ gap: spacing.md }}>
                <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{copy('rlle.ui.mission.modality')}</Text>
                <SegmentedControl options={MISSION_MODALITIES} value={modality} onChange={setModality} labelFor={(value) => copy(`rlle.ui.modality.${value}`)} />
                <Text style={[typography.caption, { color: c.textSecondary }]}>{copy('rlle.ui.mission.dynamic')}</Text>
              </Card>
              {course?.currentMission ? (
                <Card style={{ gap: spacing.sm, borderColor: c.aiAccent }}>
                  <Badge label={copy('rlle.ui.mission.current')} tone="ai" />
                  <Text style={[typography.bodySmall, { color: c.textPrimary }]}>{currentMissionTemplate ? copy(currentMissionTemplate.titleCode) : course.currentMission.missionId}</Text>
                  <Text style={[typography.caption, { color: c.textSecondary }]}>
                    {copy(`rlle.ui.mission.status.${course.currentMission.status}`)} · {copy('rlle.ui.course.evidenceCount', { count: course.currentMission.evidenceIds.length })}
                  </Text>
                </Card>
              ) : null}
              {busy ? <Text accessibilityLiveRegion="polite" style={[typography.caption, { color: c.textMuted }]}>{copy('rlle.ui.mission.starting')}</Text> : null}
              <Button variant="ghost" label={copy('rlle.ui.common.backCourse')} onPress={() => router.replace(`/languages/${profile.id}/course` as never)} />
            </View>
          }
        />
      </Page>
    </ScrollView>
  );
}
