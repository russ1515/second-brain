import { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  RLLE_MISSION_CATEGORIES,
  type LanguageProfileDetail,
  type RlleCanDoCapability,
  type RlleMissionCategory,
} from '@second-brain/shared';
import { Alert, Badge, Button, Card, Progress } from '../../../../components/ds/core';
import { Page, PageHeader, ResponsiveSplit, Section } from '../../../../components/ds/layout';
import { SmartErrorState, SmartLoadingState } from '../../../../components/ds/states';
import { CanDoList } from '../../../../components/language/course-ui';
import { useTokens } from '../../../../lib/design/theme';
import { useRlleCopy } from '../../../../lib/language-rll-i18n';
import { loadLanguageProfile, loadRlleCanDo, loadRlleCourse } from '../../../../lib/language-rll-client';

export default function LanguageCanDoScreen() {
  const params = useLocalSearchParams<{ id: string | string[] }>();
  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;
  const router = useRouter();
  const { copy } = useRlleCopy();
  const { colors: c, spacing, typography } = useTokens();
  const [profile, setProfile] = useState<LanguageProfileDetail | null>(null);
  const [items, setItems] = useState<RlleCanDoCapability[] | null>(null);
  const [live, setLive] = useState(true);
  const [category, setCategory] = useState<RlleMissionCategory | 'all'>('all');
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    setError(null);
    try {
      const [nextProfile, canDo, courseLoad] = await Promise.all([
        loadLanguageProfile(profileId),
        loadRlleCanDo(profileId),
        loadRlleCourse(profileId),
      ]);
      setProfile(nextProfile);
      setLive(canDo.live || courseLoad.kind === 'live');
      setItems(canDo.items.length ? canDo.items : courseLoad.kind === 'live' ? courseLoad.course.canDoMap : []);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [profileId]);

  useEffect(() => { void load(); }, [load]);

  const visible = useMemo(() => items?.filter((item) => category === 'all' || item.category === category) ?? [], [category, items]);
  const validated = items?.filter((item) => item.status === 'validated').length ?? 0;
  const measured = items?.filter((item) => item.status !== 'not-evaluated').length ?? 0;
  const percent = items?.length ? Math.round((validated / items.length) * 100) : null;

  if (!profile || items === null) {
    if (error) return <SmartErrorState detail={error} retryable onRetry={() => void load()} />;
    return <SmartLoadingState title={copy('rlle.ui.course.loading')} />;
  }

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Page width="wide">
        <PageHeader
          eyebrow={copy('rlle.ui.cando.eyebrow')}
          title={copy('rlle.ui.cando.title')}
          description={copy('rlle.ui.cando.subtitle')}
          action={<Badge label={`${profile.language} · ${profile.cefrLevel}`} tone="info" />}
        />
        {error ? <SmartErrorState detail={error} retryable onRetry={() => void load()} /> : null}
        {!live ? <Alert tone="warning" title={copy('rlle.ui.cando.notAvailable')} detail={copy('rlle.ui.cando.noEvidence')} /> : null}

        <ResponsiveSplit
          secondaryWidth={320}
          primary={
            <Section title={copy(category === 'all' ? 'rlle.ui.cando.all' : `rlle.ui.category.${category}`)}>
              {visible.length ? <CanDoList items={visible} /> : <Alert tone="info" title={copy('rlle.ui.cando.noEvidence')} />}
            </Section>
          }
          secondary={
            <View style={{ gap: spacing.md }}>
              <Card elevated style={{ gap: spacing.sm }}>
                <Text accessibilityRole="header" style={[typography.title, { color: c.textPrimary }]}>{copy('rlle.ui.cando.summary')}</Text>
                {percent != null ? <Progress value={percent} tone="success" /> : null}
                <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{copy('rlle.ui.cando.validatedCount', { validated, total: items.length })}</Text>
                <Text style={[typography.caption, { color: c.textMuted }]}>{copy('rlle.ui.cando.measuredCount', { count: measured })}</Text>
              </Card>
              <Card style={{ gap: spacing.sm }}>
                <Button size="sm" variant={category === 'all' ? 'primary' : 'secondary'} label={copy('rlle.ui.mission.all')} onPress={() => setCategory('all')} />
                {RLLE_MISSION_CATEGORIES.map((item) => (
                  <Button key={item} size="sm" variant={category === item ? 'primary' : 'secondary'} label={copy(`rlle.ui.category.${item}`)} onPress={() => setCategory(item)} />
                ))}
              </Card>
              <Button variant="secondary" label={copy('rlle.ui.mission.title')} onPress={() => router.push(`/languages/${profile.id}/course/missions` as never)} />
              <Button variant="ghost" label={copy('rlle.ui.common.backCourse')} onPress={() => router.replace(`/languages/${profile.id}/course` as never)} />
            </View>
          }
        />
      </Page>
    </ScrollView>
  );
}
