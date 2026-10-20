import { useCallback, useRef, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import {
  LANGUAGE_TEACHING_SOURCES,
  LANGUAGE_MODES,
  SUPPORTED_LANGUAGES,
  languageNextAction,
  toSupportedLanguage,
  type ExperienceSession,
  type ExperienceSessionPage,
  type LanguageMode,
  type LanguageProfileSummary,
  type LanguageTeachingSource,
  type LearnerPassportView,
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
import { languagePlacementLevelLabel } from '../../lib/language-placement-presentation';

export default function LanguagesScreen() {
  const { user, offline, setInterfaceLanguage } = useAuth();
  const { locale, formatLocale, setLocale, t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const router = useRouter();
  const [profiles, setProfiles] = useState<LanguageProfileSummary[] | null>(null);
  const [sessions, setSessions] = useState<ExperienceSession[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [recentCodes, setRecentCodes] = useState<string[]>([]);
  const [learningCode, setLearningCode] = useState<string | null>(null);
  const [registeredNativeCode, setRegisteredNativeCode] = useState<SupportedLanguageCode | null>(null);
  const [nativeCode, setNativeCode] = useState<string | null>(null);
  const [teachingSource, setTeachingSource] = useState<LanguageTeachingSource>('interface');
  const [interfaceLocaleSaving, setInterfaceLocaleSaving] = useState(false);
  const [mode, setMode] = useState<LanguageMode>('beginner');
  const [goal, setGoal] = useState('');
  const [creating, setCreating] = useState(false);
  const [savingTeachingSource, setSavingTeachingSource] = useState(false);
  const [teachingSourceSaved, setTeachingSourceSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [course, setCourse] = useState<RlleCourseLoad | null>(null);
  const loadRevision = useRef(0);
  const selectionRevision = useRef(0);
  const teachingSaveRevision = useRef(0);
  const selectionPersistence = useRef<Promise<void>>(Promise.resolve());
  const activeIdRef = useRef<string | null>(activeId);
  const teachingSourceRef = useRef<LanguageTeachingSource>(teachingSource);
  activeIdRef.current = activeId;
  teachingSourceRef.current = teachingSource;

  const load = useCallback(async () => {
    if (!user) return;
    const revision = ++loadRevision.current;
    setError(null);
    try {
      const [nextProfiles, resumable, savedActive, recent, passport] = await Promise.all([
        api<LanguageProfileSummary[]>('/languages'),
        api<ExperienceSessionPage>('/experience-sessions/resumable?limit=20').catch(() => ({ items: [], nextCursor: null })),
        loadActiveLanguage(user.id),
        loadRecentLanguageCodes(user.id),
        api<LearnerPassportView>('/learner-passport').catch(() => null),
      ]);
      const registeredNative = passport?.declared.nativeOrPrimaryLanguage ?? null;
      const selected = nextProfiles.find((profile) => profile.id === savedActive) ?? nextProfiles[0] ?? null;
      const nextCourse = selected ? await loadRlleCourse(selected.id).catch(() => null) : null;
      if (revision !== loadRevision.current) return;
      setProfiles(nextProfiles);
      setSessions(resumable.items.filter((session) => session.type === 'language'));
      setRecentCodes(recent);
      activeIdRef.current = selected?.id ?? null;
      setActiveId(selected?.id ?? null);
      setLearningCode(selected?.languageCode ?? null);
      setRegisteredNativeCode(registeredNative);
      setNativeCode(selected?.nativeLanguageCode ?? registeredNative);
      teachingSourceRef.current = selected?.teachingLanguageSource ?? 'interface';
      setTeachingSource(teachingSourceRef.current);
      setTeachingSourceSaved(false);
      setCourse(nextCourse);
    } catch (cause) {
      if (revision === loadRevision.current) setError((cause as Error).message);
    }
  }, [user]);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const active = profiles?.find((profile) => profile.id === activeId) ?? null;
  const activeSessions = sessions.filter((session) => session.links.languageProfileId === active?.id);
  const recommendation = active ? languageNextAction(active) : null;
  const selectedExists = learningCode
    ? profiles?.find((profile) => profile.languageCode === learningCode) ?? null
    : null;

  const selectLearning = async (code: string) => {
    const revision = ++selectionRevision.current;
    ++loadRevision.current;
    ++teachingSaveRevision.current;
    setSavingTeachingSource(false);
    setLearningCode(code);
    const existing = profiles?.find((profile) => profile.languageCode === code);
    if (existing && user) {
      activeIdRef.current = existing.id;
      setActiveId(existing.id);
      setNativeCode(existing.nativeLanguageCode ?? registeredNativeCode);
      teachingSourceRef.current = existing.teachingLanguageSource;
      setTeachingSource(existing.teachingLanguageSource);
      setTeachingSourceSaved(false);
      setCourse(null);
    } else {
      // A new target is a new path. Never leak the previous path's course,
      // native language or teaching-source choice into its creation form.
      activeIdRef.current = null;
      setActiveId(null);
      setCourse(null);
      setNativeCode(registeredNativeCode);
      teachingSourceRef.current = 'interface';
      setTeachingSource('interface');
      setTeachingSourceSaved(false);
    }
    if (!user) return;
    const persist = selectionPersistence.current.then(async () => {
      await rememberLanguageCode(user.id, code);
      if (existing) await saveActiveLanguage(user.id, existing.id);
    });
    selectionPersistence.current = persist.catch(() => undefined);
    try {
      await persist;
      const [recent, nextCourse] = await Promise.all([
        loadRecentLanguageCodes(user.id),
        existing ? loadRlleCourse(existing.id).catch(() => null) : Promise.resolve(null),
      ]);
      if (revision !== selectionRevision.current) return;
      setRecentCodes(recent);
      setCourse(nextCourse);
    } catch (cause) {
      if (revision === selectionRevision.current) setError((cause as Error).message);
    }
  };

  const changeInterfaceLocale = async (next: SupportedLanguageCode) => {
    if (interfaceLocaleSaving) return;
    const previous = locale;
    setInterfaceLocaleSaving(true);
    setError(null);
    setLocale(next);
    try {
      // I18n updates optimistically; await the same authoritative account
      // contract before course generation can resolve an interface source.
      await setInterfaceLanguage(next);
    } catch (cause) {
      setLocale(previous);
      setError((cause as Error).message);
    } finally {
      setInterfaceLocaleSaving(false);
    }
  };

  const create = async () => {
    if (!learningCode || !user) return;
    setCreating(true);
    setError(null);
    const requestedGoal = goal.trim();
    try {
      const created = await api<LanguageProfileSummary>('/languages', {
        method: 'POST',
        body: {
          language: learningCode,
          ...(nativeCode ? { nativeLanguage: nativeCode } : {}),
          teachingLanguageSource: teachingSource,
          mode,
          // Compatibility value only; the server's diagnostic, not this
          // declared baseline, determines the first course's starting level.
          cefrLevel: 'A1',
          ...(requestedGoal ? { goal: requestedGoal } : {}),
        },
      });
      await saveActiveLanguage(user.id, created.id);
      activeIdRef.current = created.id;
      setActiveId(created.id);
      setGoal('');
      // A declared CEFR level is not diagnostic evidence. Keep the profile and
      // goal, then establish the starting level before generating a first course.
      router.push(`/languages/${encodeURIComponent(created.id)}/course` as never);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setCreating(false);
    }
  };

  const saveTeachingLanguage = async () => {
    if (!active) return;
    const revision = ++teachingSaveRevision.current;
    const profileId = active.id;
    const requestedSource = teachingSource;
    setSavingTeachingSource(true);
    setTeachingSourceSaved(false);
    setError(null);
    try {
      const updated = await api<LanguageProfileSummary>(`/languages/${encodeURIComponent(active.id)}`, {
        method: 'PATCH',
        body: { teachingLanguageSource: teachingSource },
      });
      setProfiles((current) => current?.map((profile) => profile.id === updated.id ? updated : profile) ?? null);
      if (
        revision !== teachingSaveRevision.current
        || activeIdRef.current !== profileId
        || teachingSourceRef.current !== requestedSource
      ) return;
      teachingSourceRef.current = updated.teachingLanguageSource;
      setTeachingSource(updated.teachingLanguageSource);
      setTeachingSourceSaved(true);
    } catch (cause) {
      if (revision === teachingSaveRevision.current && activeIdRef.current === profileId) {
        setError((cause as Error).message);
      }
    } finally {
      if (revision === teachingSaveRevision.current) setSavingTeachingSource(false);
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
                      <Badge label={languagePlacementLevelLabel(course?.kind === 'live' ? course.course.placement ?? active.placement : active.placement, (key) => t(key as TranslationKey), active.cefrLevel, course?.kind === 'live' && course.course.status === 'not-started')} tone="info" />
                    </View>
                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
                      <Metric value={active.vocabCount} label={t('languages11.metric.words')} />
                      <Metric value={active.vocabDue} label={t('languages11.metric.due')} />
                      <Metric value={active.sessionCount} label={t('languages11.metric.sessions')} />
                      <Metric value={active.lessonCount} label={t('languages11.metric.lessons')} />
                    </View>
                    <Text style={[typography.caption, { color: c.textMuted }]}>
                      {active.lastActivityAt
                        ? t('languages11.lastActivity').replace('{date}', new Intl.DateTimeFormat(formatLocale, { dateStyle: 'medium' }).format(new Date(active.lastActivityAt)))
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
                        {t(recommendation.reasonCode as TranslationKey)}{recommendation.durationMinutes ? ` · ${recommendation.durationMinutes} ${t('h.hero.min')}` : ''}
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
                <LanguageSelector
                  value={locale}
                  onChange={(code) => {
                    const supported = toSupportedLanguage(code);
                    if (supported) void changeInterfaceLocale(supported);
                  }}
                  mode="ui"
                />
                <LanguageSelector value={learningCode} onChange={(code) => void selectLearning(code)} mode="learning" recentCodes={recentCodes} />
                {active ? (
                  <>
                    <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('passport.teachingLanguage')}</Text>
                    <SegmentedControl
                      testID="language-teaching-source"
                      options={active.nativeLanguageCode ? LANGUAGE_TEACHING_SOURCES : ['interface'] as const}
                      value={teachingSource}
                      onChange={(source) => {
                        ++teachingSaveRevision.current;
                        teachingSourceRef.current = source;
                        setTeachingSource(source);
                        setSavingTeachingSource(false);
                        setTeachingSourceSaved(false);
                      }}
                      labelFor={(source) => source === 'native'
                        ? `${t('profile.card.nativeLanguage')} · ${active.nativeLanguageCode ? SUPPORTED_LANGUAGES[active.nativeLanguageCode].name : ''}`
                        : `${t('onb.languages.interface')} · ${SUPPORTED_LANGUAGES[locale as SupportedLanguageCode]?.name ?? locale}`}
                    />
                    <Text style={[typography.caption, { color: c.textMuted }]}>{t('rlle.ui.teachingLanguage.detail')}</Text>
                    <Button
                      testID="language-teaching-source-save"
                      label={t('rlle.ui.course.preferences.save')}
                      variant="secondary"
                      loading={savingTeachingSource}
                      disabled={interfaceLocaleSaving}
                      onPress={() => void saveTeachingLanguage()}
                    />
                    {teachingSourceSaved ? (
                      <Alert
                        tone="success"
                        title={t('rlle.ui.course.preferences.saved')}
                        detail={t('rlle.ui.teachingLanguage.existingCourse')}
                      />
                    ) : null}
                  </>
                ) : null}
              </Card>
              {learningCode && !selectedExists ? (
                <Card style={{ gap: spacing.md }}>
                  <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{t('languages11.create.title').replace('{language}', SUPPORTED_LANGUAGES[learningCode as SupportedLanguageCode]?.name ?? learningCode)}</Text>
                  <LanguageSelector value={nativeCode} onChange={setNativeCode} mode="learning" label={t('languageSelector.nativeLabel')} />
                  <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t('passport.teachingLanguage')}</Text>
                  <SegmentedControl
                    testID="language-create-teaching-source"
                    options={nativeCode ? LANGUAGE_TEACHING_SOURCES : ['interface'] as const}
                    value={teachingSource}
                    onChange={setTeachingSource}
                    labelFor={(source) => source === 'native'
                      ? `${t('profile.card.nativeLanguage')} · ${nativeCode ? SUPPORTED_LANGUAGES[nativeCode as SupportedLanguageCode]?.name ?? nativeCode : ''}`
                      : `${t('onb.languages.interface')} · ${SUPPORTED_LANGUAGES[locale as SupportedLanguageCode]?.name ?? locale}`}
                  />
                  <Text style={[typography.caption, { color: c.textMuted }]}>{t('rlle.ui.teachingLanguage.detail')}</Text>
                  <SegmentedControl options={LANGUAGE_MODES.slice(0, 3)} value={mode} onChange={setMode} labelFor={(value) => t(`langmode.${value}` as TranslationKey)} />
                  <Input testID="language-course-goal" label={t('languages11.goal.label')} value={goal} onChangeText={setGoal} placeholder={t('languages11.goal.placeholder')} maxLength={300} />
                  <Button testID="language-generate-course" label={t('placement.ui.start' as TranslationKey)} loading={creating} disabled={interfaceLocaleSaving} onPress={() => void create()} />
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
