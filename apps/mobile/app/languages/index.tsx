import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  CEFR_LEVELS,
  LANGUAGE_MODES,
  SUPPORTED_LANGUAGES,
  languageNextAction,
  type CefrLevel,
  type ExperienceSession,
  type ExperienceSessionPage,
  type LanguageMode,
  type LanguageProfileSummary,
  type SupportedLanguageCode,
} from '@second-brain/shared';
import { api } from '../../lib/client';
import { useAuth } from '../../lib/auth-context';
import { useTokens } from '../../lib/design/theme';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { actionDestinationHref } from '../../lib/action-destination';
import {
  loadActiveLanguage,
  loadRecentLanguageCodes,
  rememberLanguageCode,
  saveActiveLanguage,
} from '../../lib/language-preferences';
import { Alert, Badge, Button, Card, Input, SegmentedControl } from '../../components/ds/core';
import { LanguageBadge, LanguageSelector } from '../../components/ds/language';
import { Page, PageHeader, ResponsiveSplit, Section } from '../../components/ds/layout';
import { SmartEmptyState, SmartErrorState, SmartLoadingState } from '../../components/ds/states';
import { CourseEntryCard } from '../../components/language/course-ui';
import { loadRlleCourse, type RlleCourseLoad } from '../../lib/language-rll-client';

export default function LanguagesScreen() {
  const { user, offline } = useAuth();
  const { locale, setLocale, t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const router = useRouter();
  const [profiles, setProfiles] = useState<LanguageProfileSummary[] | null>(null);
  const [sessions, setSessions] = useState<ExperienceSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const [learningCode, setLearningCode] = useState<string | null>(null);
  const [nativeCode, setNativeCode] = useState<string | null>(locale);
  const [mode, setMode] = useState<LanguageMode>('beginner');
  const [level, setLevel] = useState<CefrLevel>('A1');
  const [goal, setGoal] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<RlleCourseLoad | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const [nextProfiles, resumable, savedActive, recent] = await Promise.all([
        api<LanguageProfileSummary[]>('/languages'),
        api<ExperienceSessionPage>('/experience-sessions/resumable?limit=20').catch(() => ({ items: [], nextCursor: null })),
        loadActiveLanguage(user.id),
        loadRecentLanguageCodes(user.id),
      ]);
      setProfiles(nextProfiles);
      setSessions(resumable.items.filter((session) => session.type === 'language'));
      setRecentCodes(recent);
      const selected = nextProfiles.find((profile) => profile.id === savedActive) ?? nextProfiles[0] ?? null;
      setActiveId(selected?.id ?? null);
      setLearningCode(selected?.languageCode ?? null);
      setNativeCode(selected?.nativeLanguageCode ?? locale);
      setCourse(selected ? await loadRlleCourse(selected.id).catch(() => null) : null);
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [locale, user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const active = profiles?.find((profile) => profile.id === activeId) ?? null;
  const activeSessions = sessions.filter((session) => session.links.languageProfileId === active?.id);
  const recommendation = active ? languageNextAction(active) : null;
  const selectedExists = learningCode
    ? profiles?.find((profile) => profile.languageCode === learningCode) ?? null
    : null;

  const selectLearning = async (code: string) => {
    setLearningCode(code);
    if (user) {
      await rememberLanguageCode(user.id, code);
      setRecentCodes(await loadRecentLanguageCodes(user.id));
    }
    const existing = profiles?.find((profile) => profile.languageCode === code);
    if (existing && user) {
      setActiveId(existing.id);
      await saveActiveLanguage(user.id, existing.id);
      setNativeCode(existing.nativeLanguageCode ?? locale);
      setCourse(await loadRlleCourse(existing.id).catch(() => null));
    }
  };

  const create = async () => {
    if (!learningCode || !user) return;
    setCreating(true);
    setError(null);
    try {
      const created = await api<LanguageProfileSummary>('/languages', {
        method: 'POST',
        body: {
          language: learningCode,
          ...(nativeCode ? { nativeLanguage: nativeCode } : {}),
          mode,
          cefrLevel: level,
          ...(goal.trim() ? { goal: goal.trim() } : {}),
        },
      });
      await saveActiveLanguage(user.id, created.id);
      setActiveId(created.id);
      setGoal('');
      await load();
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const open = (href: string) => router.push(href as never);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Page width="wide">
        <PageHeader eyebrow={t('languages11.eyebrow')} title={t('languages11.title')} description={t('languages11.description')} />
        {offline ? <Alert tone="warning" title={t('languages11.offline.title')} detail={t('languages11.offline.detail')} /> : null}
        {error ? <SmartErrorState detail={error} retryable onRetry={() => void load()} /> : null}

        <ResponsiveSplit
          secondaryWidth={340}
          primary={
            <View style={{ gap: spacing.md }}>
              {profiles === null ? <SmartLoadingState /> : active ? (
                <>
                  <Card elevated style={{ gap: spacing.md }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' }}>
                      <View style={{ gap: spacing.xs, flex: 1 }}>
                        {active.languageCode ? <LanguageBadge code={active.languageCode} /> : null}
                        <Text accessibilityRole="header" style={[typography.h2, { color: c.textPrimary }]}>{active.language}</Text>
                        <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{active.goal || t('languages11.goal.empty')}</Text>
                      </View>
                      <Badge label={`${active.cefrLevel} · ${t('languages11.level.declared')}`} tone="info" />
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                      <Metric value={active.vocabCount} label={t('languages11.metric.words')} />
                      <Metric value={active.vocabDue} label={t('languages11.metric.due')} />
                      <Metric value={active.sessionCount} label={t('languages11.metric.sessions')} />
                      <Metric value={active.lessonCount} label={t('languages11.metric.lessons')} />
                    </View>
                    <Text style={[typography.caption, { color: c.textMuted }]}>
                      {active.lastActivityAt
                        ? t('languages11.lastActivity').replace('{date}', new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(new Date(active.lastActivityAt)))
                        : t('languages11.lastActivity.none')}
                    </Text>
                  </Card>

                  <CourseEntryCard
                    profile={active}
                    course={course}
                    onOpen={() => open(`/languages/${active.id}/course`)}
                  />

                  {recommendation ? (
                    <Card style={{ gap: spacing.sm, borderColor: c.aiAccent }}>
                      <Badge label={t('languages11.nba.badge')} tone="ai" />
                      <Text style={[typography.h3, { color: c.textPrimary }]}>{t(recommendation.messageCode as TranslationKey).replace('{count}', String(recommendation.count ?? ''))}</Text>
                      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>
                        {t(recommendation.reasonCode as TranslationKey)}{recommendation.durationMinutes ? ` · ${recommendation.durationMinutes} min` : ''}
                      </Text>
                      <Button label={t('languages11.nba.start')} variant="ai" onPress={() => open(actionDestinationHref(recommendation.destination))} />
                    </Card>
                  ) : null}

                  <Section title={t('languages11.resume.title')}>
                    {activeSessions.length ? activeSessions.slice(0, 3).map((session) => (
                      <Card key={session.id} style={{ gap: spacing.sm }}>
                        <Text style={[typography.title, { color: c.textPrimary }]}>{session.title ?? active.language}</Text>
                        <Text style={[typography.caption, { color: c.textMuted }]}>{session.currentStep?.label ?? t('languages11.practice.conversation')} · {session.status}</Text>
                        {session.resumeTarget?.path ? <Button label={t('languages11.resume.action')} variant="secondary" onPress={() => open(actionDestinationHref(session.resumeTarget!))} /> : null}
                      </Card>
                    )) : <SmartEmptyState title={t('languages11.resume.empty')} detail={t('languages11.resume.emptyDetail')} />}
                  </Section>
                  <Button label={t('languages11.openSpace')} onPress={() => open(`/languages/${active.id}`)} />
                </>
              ) : <SmartEmptyState icon="◎" title={t('languages11.empty.title')} detail={t('languages11.empty.detail')} />}
            </View>
          }
          secondary={
            <View style={{ gap: spacing.md }}>
              <Card style={{ gap: spacing.md }}>
                <Text style={[typography.title, { color: c.textPrimary }]}>{t('languages11.preferences')}</Text>
                <LanguageSelector value={locale} onChange={setLocale} mode="ui" />
                <LanguageSelector value={learningCode} onChange={(code) => void selectLearning(code)} mode="learning" recentCodes={recentCodes} />
              </Card>
              {learningCode && !selectedExists ? (
                <Card style={{ gap: spacing.md }}>
                  <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('languages11.create.title').replace('{language}', SUPPORTED_LANGUAGES[learningCode as SupportedLanguageCode]?.name ?? learningCode)}</Text>
                  <LanguageSelector value={nativeCode} onChange={setNativeCode} mode="ui" label={t('languageSelector.nativeLabel')} />
                  <SegmentedControl options={CEFR_LEVELS} value={level} onChange={setLevel} />
                  <SegmentedControl options={LANGUAGE_MODES.slice(0, 3)} value={mode} onChange={setMode} labelFor={(value) => t(`langmode.${value}` as TranslationKey)} />
                  <Input label={t('languages11.goal.label')} value={goal} onChangeText={setGoal} placeholder={t('languages11.goal.placeholder')} maxLength={300} />
                  <Button label={t('languages11.create.action')} loading={creating} onPress={() => void create()} />
                </Card>
              ) : null}
              {profiles && profiles.length > 1 ? (
                <Section title={t('languages11.other.title')}>
                  {profiles.filter((profile) => profile.id !== active?.id).map((profile) => (
                    <Button key={profile.id} variant="ghost" label={`${profile.language} · ${profile.cefrLevel}`} onPress={() => void selectLearning(profile.languageCode ?? profile.language)} />
                  ))}
                </Section>
              ) : null}
            </View>
          }
        />
      </Page>
    </ScrollView>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  const { colors: c, typography } = useTokens();
  return (
    <View style={{ minWidth: 92, gap: 2 }}>
      <Text style={[typography.h3, { color: c.textPrimary }]}>{value}</Text>
      <Text style={[typography.caption, { color: c.textMuted }]}>{label}</Text>
    </View>
  );
}
