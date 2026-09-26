import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View, type ViewStyle } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  CefrLevel,
  ExperienceSession,
  ExperienceSessionPage,
  ExtractVocabularyResponse,
  ImmersionIntensity,
  LanguageCorrectionIntensity,
  LanguageLessonResponse,
  LanguagePracticeFormat,
  LanguageProfileDetail,
  LanguageSkillResponse,
  PronunciationAssessment,
  PronunciationCoaching,
  StartConversationResponse,
  SpeechCapabilities,
} from '@second-brain/shared';
import {
  CEFR_LEVELS,
  IMMERSION_INTENSITIES,
  LANGUAGE_CORRECTION_INTENSITIES,
  LANGUAGE_PRACTICE_FORMATS,
  languageNextAction,
} from '@second-brain/shared';
import type {
  EssayCorrection as EssayCorrectionResult,
  LanguageDialogue,
} from '@second-brain/shared';
import { api, apiUpload } from '../../lib/client';
import { createRecorder, RECORDING_SUPPORTED, type Recorder } from '../../lib/recorder';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useResponsive } from '../../lib/responsive';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';
import { Markdown } from '../../components/markdown';
import { SpeakButton } from '../../components/speak-button';
import { Alert, Badge, Button as DsButton, Card as DsCard, Input, SegmentedControl } from '../../components/ds/core';
import { LanguageBadge } from '../../components/ds/language';
import { Page, PageHeader, ResponsiveSplit, Section as DsSection } from '../../components/ds/layout';
import { SmartErrorState, SmartLoadingState } from '../../components/ds/states';
import { ContextBar } from '../../components/context/context-bar';
import { useAuth } from '../../lib/auth-context';
import { CourseEntryCard } from '../../components/language/course-ui';
import { loadRlleCourse, type RlleCourseLoad } from '../../lib/language-rll-client';

function firstParam(value?: string | string[]): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default function LanguageExperienceScreen() {
  const params = useLocalSearchParams<{
    id: string;
    practice?: string | string[];
    courseSessionId?: string | string[];
    unitId?: string | string[];
    lessonId?: string | string[];
    stage?: string | string[];
  }>();
  const profileId = Array.isArray(params.id) ? params.id[0] : params.id;
  const practiceParam = Array.isArray(params.practice) ? params.practice[0] : params.practice;
  const requestedPractice = LANGUAGE_PRACTICE_FORMATS.includes(practiceParam as LanguagePracticeFormat)
    ? practiceParam as LanguagePracticeFormat
    : null;
  const courseContext: CoursePracticeContext | null = firstParam(params.courseSessionId)
    ? {
        courseSessionId: firstParam(params.courseSessionId)!,
        unitId: firstParam(params.unitId),
        lessonId: firstParam(params.lessonId),
        courseStage: firstParam(params.stage),
      }
    : null;
  const router = useRouter();
  const { offline } = useAuth();
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const [profile, setProfile] = useState<LanguageProfileDetail | null>(null);
  const [sessions, setSessions] = useState<ExperienceSession[]>([]);
  const [format, setFormat] = useState<LanguagePracticeFormat>(requestedPractice ?? 'conversation');
  const [error, setError] = useState<string | null>(null);
  const [capabilities, setCapabilities] = useState<SpeechCapabilities | null>(null);
  const [course, setCourse] = useState<RlleCourseLoad | null>(null);

  const load = useCallback(async () => {
    if (!profileId) return;
    setError(null);
    try {
      const [nextProfile, recent, speech, nextCourse] = await Promise.all([
        api<LanguageProfileDetail>(`/languages/${profileId}`),
        api<ExperienceSessionPage>('/experience-sessions/recent?limit=20').catch(() => ({ items: [], nextCursor: null })),
        api<SpeechCapabilities>('/speech/capabilities').catch(() => null),
        loadRlleCourse(profileId).catch(() => null),
      ]);
      setProfile(nextProfile);
      setSessions(recent.items.filter((session) => session.type === 'language' && session.links.languageProfileId === profileId));
      setCapabilities(speech);
      setCourse(nextCourse);
      if (!requestedPractice && nextProfile.vocabDue > 0) setFormat('vocabulary');
    } catch (cause) {
      setError((cause as Error).message);
    }
  }, [profileId, requestedPractice]);

  useEffect(() => { void load(); }, [load]);
  if (!profile && !error) return <SmartLoadingState />;
  if (!profile) return <SmartErrorState detail={error ?? undefined} retryable onRetry={() => void load()} />;

  const activeSession = sessions.find((session) => session.status === 'active' || session.status === 'paused') ?? sessions[0] ?? null;
  const recommendation = languageNextAction(profile);
  const open = (href: string) => router.push(href as never);

  return (
    <ScrollView contentContainerStyle={{ paddingBottom: spacing.xxl }}>
      <Page width="wide">
        <PageHeader
          eyebrow={t('languages11.space.eyebrow')}
          title={profile.language}
          description={profile.goal || t('languages11.goal.empty')}
          action={profile.languageCode ? <LanguageBadge code={profile.languageCode} /> : undefined}
        />
        {offline ? <Alert tone="warning" title={t('languages11.offline.title')} detail={t('languages11.offline.detail')} /> : null}
        {activeSession ? <ContextBar items={activeSession.activeContexts.items} /> : null}
        {error ? <SmartErrorState detail={error} retryable onRetry={() => void load()} /> : null}

        <ResponsiveSplit
          secondaryWidth={320}
          primary={
            <View style={{ gap: spacing.md }}>
              <CourseEntryCard
                profile={profile}
                course={course}
                onOpen={() => open(`/languages/${profile.id}/course`)}
              />

              <DsCard elevated style={{ gap: spacing.sm, borderColor: c.aiAccent }}>
                <Badge label={t('languages11.nba.badge')} tone="ai" />
                <Text style={[typography.h2, { color: c.textPrimary }]}>
                  {t(recommendation.messageCode as TranslationKey).replace('{count}', String(recommendation.count ?? ''))}
                </Text>
                <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{t(recommendation.reasonCode as TranslationKey)}</Text>
                <DsButton label={t('languages11.nba.start')} variant="ai" onPress={() => {
                  if (recommendation.kind === 'review-vocabulary') open(`/revision?languageProfileId=${profile.id}`);
                  else setFormat(recommendation.kind === 'create-lesson' ? 'grammar' : 'conversation');
                }} />
              </DsCard>

              <DsSection title={t(`languages11.practice.${format}` as TranslationKey)} description={t('languages11.practice.focused')}>
                <Practice
                  format={format}
                  profile={profile}
                  capabilities={capabilities}
                  courseContext={courseContext}
                  coursePreferences={course?.kind === 'live' ? {
                    immersionIntensity: course.course.immersionIntensity,
                    correctionIntensity: course.course.correctionIntensity,
                  } : null}
                  onChanged={() => void load()}
                />
              </DsSection>
            </View>
          }
          secondary={
            <View style={{ gap: spacing.md }}>
              <DsCard style={{ gap: spacing.sm }}>
                <Text style={[typography.title, { color: c.textPrimary }]}>{t('languages11.level.title')}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
                  <Badge label={profile.cefrLevel} tone="info" />
                  <Text style={[typography.caption, { color: c.textMuted }]}>{t('languages11.level.declared')}</Text>
                </View>
                <Text style={[typography.caption, { color: c.textSecondary }]}>{t('languages11.level.notEvaluated')}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  <Badge label={`${profile.vocabCount} ${t('languages11.metric.words')}`} />
                  <Badge label={`${profile.vocabDue} ${t('languages11.metric.due')}`} tone={profile.vocabDue ? 'warning' : 'success'} />
                  <Badge label={`${profile.sessionCount} ${t('languages11.metric.sessions')}`} />
                </View>
              </DsCard>

              <DsSection title={t('languages11.formats.title')} description={t('languages11.formats.detail')}>
                <View accessibilityRole="tablist" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
                  {LANGUAGE_PRACTICE_FORMATS.map((item) => (
                    <DsButton
                      key={item}
                      size="sm"
                      variant={format === item ? 'primary' : 'secondary'}
                      label={t(`languages11.practice.${item}` as TranslationKey)}
                      onPress={() => setFormat(item)}
                    />
                  ))}
                </View>
              </DsSection>

              {activeSession?.resumeTarget?.path ? (
                <DsCard style={{ gap: spacing.sm }}>
                  <Text style={[typography.title, { color: c.textPrimary }]}>{t('languages11.resume.title')}</Text>
                  <Text style={[typography.caption, { color: c.textSecondary }]}>{activeSession.title ?? profile.language}</Text>
                  <DsButton label={t('languages11.resume.action')} variant="secondary" onPress={() => open(activeSession.resumeTarget!.path!)} />
                </DsCard>
              ) : null}
            </View>
          }
        />
      </Page>
    </ScrollView>
  );
}

type CoursePracticeContext = {
  courseSessionId: string;
  unitId?: string;
  lessonId?: string;
  courseStage?: string;
};

function Practice({ format, profile, capabilities, courseContext, coursePreferences, onChanged }: {
  format: LanguagePracticeFormat;
  profile: LanguageProfileDetail;
  capabilities: SpeechCapabilities | null;
  courseContext: CoursePracticeContext | null;
  coursePreferences: {
    immersionIntensity: ImmersionIntensity;
    correctionIntensity: LanguageCorrectionIntensity;
  } | null;
  onChanged: () => void;
}) {
  const { t } = useI18n();
  const { spacing } = useTokens();
  const router = useRouter();
  const writingInstruction = [
    t('languages11.writing.instruction', { language: profile.language }),
    profile.goal,
  ].filter(Boolean).join(' ');
  if (format === 'conversation') return <ConversationSetup profile={profile} voice={false} courseContext={courseContext} coursePreferences={coursePreferences} onChanged={onChanged} />;
  if (format === 'oral') return <ConversationSetup profile={profile} voice courseContext={courseContext} coursePreferences={coursePreferences} onChanged={onChanged} />;
  if (format === 'vocabulary') return <VocabularyPractice profileId={profile.id} courseContext={courseContext} onChanged={onChanged} />;
  if (format === 'grammar' || format === 'conjugation' || format === 'comprehension') return <SkillPractice profile={profile} kind={format} />;
  if (format === 'reading') return (
    <View style={{ gap: spacing.md }}>
      <SkillPractice profile={profile} kind="comprehension" />
      <DsButton label={t('languages11.reading.history')} variant="ghost" onPress={() => router.push('/reading' as never)} />
    </View>
  );
  if (format === 'writing') return (
    <View style={{ gap: spacing.md }}>
      <EssayCorrection profileId={profile.id} />
      <DsButton
        label={t('languages11.writing.workspace')}
        variant="ghost"
        onPress={() => router.push(`/writing?type=redaction&instructions=${encodeURIComponent(writingInstruction)}` as never)}
      />
    </View>
  );
  if (format === 'pronunciation') {
    return (
      <View style={{ gap: spacing.md }}>
        <Pronunciation profileId={profile.id} />
        {capabilities?.audioAnalysis ? <PronunciationCoach profileId={profile.id} /> : null}
      </View>
    );
  }
  return (
    <DsCard style={{ gap: spacing.sm }}>
      <Text>{t('languages11.quiz.detail')}</Text>
      <DsButton label={t('languages11.quiz.action')} onPress={() => router.push(`/revision?languageProfileId=${profile.id}${courseContext ? `&returnTo=course&sourceSessionId=${encodeURIComponent(courseContext.courseSessionId)}` : ''}` as never)} />
    </DsCard>
  );
}

function ConversationSetup({ profile, voice, courseContext, coursePreferences, onChanged }: { profile: LanguageProfileDetail; voice: boolean; courseContext: CoursePracticeContext | null; coursePreferences: { immersionIntensity: ImmersionIntensity; correctionIntensity: LanguageCorrectionIntensity } | null; onChanged: () => void }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const router = useRouter();
  const [scenario, setScenario] = useState('');
  const [immersion, setImmersion] = useState<ImmersionIntensity>(coursePreferences?.immersionIntensity ?? 'mixed');
  const [correction, setCorrection] = useState<LanguageCorrectionIntensity>(coursePreferences?.correctionIntensity ?? 'balanced');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api<StartConversationResponse>(`/languages/${profile.id}/conversation`, {
        method: 'POST',
        body: {
          ...(scenario.trim() ? { scenario: scenario.trim() } : {}),
          immersionIntensity: immersion,
          correctionIntensity: correction,
          inputModality: voice ? 'voice' : 'text',
          ...(courseContext ?? {}),
        },
      });
      onChanged();
      router.push(`/tutor/${result.session.id}${voice ? '?voice=1' : ''}` as never);
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <DsCard style={{ gap: spacing.md }}>
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{voice ? t('languages11.oral.detail') : t('languages11.conversation.detail')}</Text>
      <Input label={t('languages11.scenario.label')} value={scenario} onChangeText={setScenario} placeholder={t('languages11.scenario.placeholder')} maxLength={200} />
      <Text style={[typography.label, { color: c.textMuted }]}>{t('languages11.immersion.title')}</Text>
      <SegmentedControl options={IMMERSION_INTENSITIES} value={immersion} onChange={setImmersion} labelFor={(value) => t(`languages11.immersion.${value}` as TranslationKey)} />
      <Text style={[typography.label, { color: c.textMuted }]}>{t('languages11.correction.title')}</Text>
      <SegmentedControl options={LANGUAGE_CORRECTION_INTENSITIES} value={correction} onChange={setCorrection} labelFor={(value) => t(`languages11.correction.${value}` as TranslationKey)} />
      {error ? <SmartErrorState detail={error} retryable onRetry={() => void start()} /> : null}
      <DsButton label={voice ? t('languages11.oral.start') : t('languages11.conversation.start')} icon={voice ? '🎤' : undefined} loading={busy} onPress={() => void start()} />
    </DsCard>
  );
}

function VocabularyPractice({ profileId, courseContext, onChanged }: { profileId: string; courseContext: CoursePracticeContext | null; onChanged: () => void }) {
  const { t } = useI18n();
  const { spacing } = useTokens();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await api<ExtractVocabularyResponse>(`/languages/${profileId}/vocabulary`, { method: 'POST', body: { text: text.trim(), sourcePhrase: text.trim().slice(0, 120), ...(courseContext ? { experienceSessionId: courseContext.courseSessionId } : {}) } });
      setNotice(t('lang.vocabResult').replace('{n}', String(result.created)).replace('{had}', result.skipped ? t('lang.vocabHad').replace('{n}', String(result.skipped)) : ''));
      setText('');
      onChanged();
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  return (
    <DsCard style={{ gap: spacing.sm }}>
      <Input multiline label={t('lang.vocabulary')} value={text} onChangeText={setText} placeholder={t('lang.vocabPlaceholder')} />
      {notice ? <Text>{notice}</Text> : null}
      {error ? <SmartErrorState detail={error} /> : null}
      <DsButton label={t('lang.mineVocab')} loading={busy} disabled={!text.trim()} onPress={() => void create()} />
    </DsCard>
  );
}

function SkillPractice({ profile, kind }: { profile: LanguageProfileDetail; kind: 'grammar' | 'conjugation' | 'comprehension' }) {
  const { t } = useI18n();
  const { colors: c, spacing, typography } = useTokens();
  const [topic, setTopic] = useState('');
  const [result, setResult] = useState<LanguageSkillResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const run = async () => {
    setBusy(true); setError(null);
    try {
      setResult(await api<LanguageSkillResponse>(`/languages/${profile.id}/${kind}`, { method: 'POST', body: kind === 'conjugation' ? { verb: topic.trim() || undefined } : { topic: topic.trim() || undefined } }));
    } catch (cause) { setError((cause as Error).message); } finally { setBusy(false); }
  };
  return (
    <DsCard style={{ gap: spacing.sm }}>
      <Input value={topic} onChangeText={setTopic} label={t(`languages11.practice.${kind}` as TranslationKey)} placeholder={t('lang.skillPlaceholder')} />
      {error ? <SmartErrorState detail={error} /> : null}
      <DsButton label={t('languages11.generate')} loading={busy} onPress={() => void run()} />
      {result ? <View style={{ gap: spacing.sm }}><Text style={[typography.title, { color: c.textPrimary }]}>{result.title}</Text><SpeakButton text={result.content} language={profile.language} label={t('lang.listen')} /><Markdown text={result.content} /></View> : null}
    </DsCard>
  );
}

function LegacyLanguageScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const { width } = useResponsive();
  const wide = width >= 1024;
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [profile, setProfile] = useState<LanguageProfileDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [source, setSource] = useState('');
  const [topic, setTopic] = useState('');
  const [scenario, setScenario] = useState('');
  // Sprint 7.3: CEFR + skills
  const [skillTopic, setSkillTopic] = useState('');
  const [skill, setSkill] = useState<LanguageSkillResponse | null>(null);

  const load = useCallback(async () => {
    try {
      setProfile(await api<LanguageProfileDetail>(`/languages/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const run = async (key: string, fn: () => Promise<string | null>) => {
    setBusy(key);
    setError(null);
    setNotice(null);
    try {
      const message = await fn();
      if (message) setNotice(message);
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(null);
    }
  };

  const mineVocabulary = () =>
    run('vocab', async () => {
      const res = await api<ExtractVocabularyResponse>(`/languages/${id}/vocabulary`, {
        method: 'POST',
        body: { text: source.trim() },
      });
      setSource('');
      const had =
        res.skipped > 0
          ? t('lang.vocabHad').replace('{n}', String(res.skipped))
          : '';
      return t('lang.vocabResult')
        .replace('{n}', String(res.created))
        .replace('{had}', had);
    });

  const makeLesson = () =>
    run('lesson', async () => {
      const res = await api<LanguageLessonResponse>(`/languages/${id}/lesson`, {
        method: 'POST',
        body: { topic: topic.trim() },
      });
      setTopic('');
      router.push(`/lesson/${res.lesson.id}`);
      return null;
    });

  const converse = () =>
    run('convo', async () => {
      const res = await api<StartConversationResponse>(`/languages/${id}/conversation`, {
        method: 'POST',
        body: { ...(scenario.trim() ? { scenario: scenario.trim() } : {}) },
      });
      setScenario('');
      router.push(`/tutor/${res.session.id}`);
      return null;
    });

  const setCefr = (level: CefrLevel) =>
    run(`cefr-${level}`, async () => {
      await api<LanguageProfileDetail>(`/languages/${id}`, {
        method: 'PATCH',
        body: { cefrLevel: level },
      });
      return null;
    });

  const runSkill = (path: 'grammar' | 'conjugation' | 'comprehension') =>
    run(`skill-${path}`, async () => {
      const body =
        path === 'conjugation'
          ? { verb: skillTopic.trim() || undefined }
          : { topic: skillTopic.trim() || undefined };
      setSkill(await api<LanguageSkillResponse>(`/languages/${id}/${path}`, {
        method: 'POST',
        body,
      }));
      return null;
    });

  if (!profile && !error) return <Loading />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {error ? <ErrorBanner message={error} /> : null}
      {notice ? (
        <Card style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </Card>
      ) : null}

      <Text style={styles.title}>{profile?.language}</Text>
      <Text style={styles.meta}>
        {profile ? t(`langmode.${profile.mode}` as TranslationKey) : ''} ·{' '}
        {profile?.vocabCount} {t('lang.metaWords')} · {profile?.vocabDue}{' '}
        {t('lang.metaDue')} · {profile?.lessonCount} {t('lang.metaLessons')}
      </Text>

      {/* CEFR / CECRL level (Sprint 7.3) */}
      <View style={styles.cefrRow}>
        <Text style={styles.cefrLabel}>CEFR</Text>
        {CEFR_LEVELS.map((lvl) => (
          <Button
            key={lvl}
            label={lvl}
            variant={profile?.cefrLevel === lvl ? 'primary' : 'ghost'}
            busy={busy === `cefr-${lvl}`}
            onPress={() => setCefr(lvl)}
          />
        ))}
      </View>

      {/* Immersion mode (Sprint 7.8 ⭐) */}
      {profile?.mode === 'immersion' && profile.immersionRatio != null ? (
        <Card style={styles.immersionCard}>
          <Text style={styles.immersionText}>
            {t('lang.immersionBadge')
              .replace('{pct}', String(Math.round(profile.immersionRatio * 100)))
              .replace('{lang}', profile.language)}
          </Text>
          <Text style={styles.help}>
            {t('lang.immersionHelp').replace(/\{lang\}/g, profile.language)}
          </Text>
        </Card>
      ) : null}

      <View style={wide ? styles.grid : undefined}>
      <Section title={t('lang.skills')} cellStyle={wide ? styles.cell : undefined}>
        <Text style={styles.help}>
          {t('lang.skillsHelp').replace('{level}', profile?.cefrLevel ?? '')}
        </Text>
        <TextInput
          style={styles.input}
          placeholder={t('lang.skillPlaceholder')}
          placeholderTextColor={c.textMuted}
          value={skillTopic}
          onChangeText={setSkillTopic}
          testID="skill-topic"
        />
        <View style={styles.skillRow}>
          <Button label={t('lang.grammar')} variant="ghost" busy={busy === 'skill-grammar'} onPress={() => runSkill('grammar')} />
          <Button label={t('lang.conjugation')} variant="ghost" busy={busy === 'skill-conjugation'} onPress={() => runSkill('conjugation')} />
          <Button label={t('lang.comprehension')} variant="ghost" busy={busy === 'skill-comprehension'} onPress={() => runSkill('comprehension')} />
        </View>
        {skill ? (
          <Card style={styles.skillCard}>
            <Text style={styles.skillTitle}>{skill.title}</Text>
            <SpeakButton text={skill.content} language={profile?.language} label={t('lang.listen')} />
            <Markdown text={skill.content} />
          </Card>
        ) : null}
      </Section>

      <Section title={t('lang.conversation')} cellStyle={wide ? styles.cell : undefined}>
        <Text style={styles.help}>{t('lang.conversationHelp')}</Text>
        <TextInput
          style={styles.input}
          placeholder={t('lang.scenarioConvo')}
          placeholderTextColor={c.textMuted}
          value={scenario}
          onChangeText={setScenario}
          testID="scenario"
        />
        <Button label={t('lang.startTalking')} onPress={converse} busy={busy === 'convo'} />
      </Section>

      <Section title={t('lang.vocabulary')} cellStyle={wide ? styles.cell : undefined}>
        <Text style={styles.help}>{t('lang.vocabularyHelp')}</Text>
        <TextInput
          style={[styles.input, styles.tall]}
          placeholder={t('lang.vocabPlaceholder')}
          placeholderTextColor={c.textMuted}
          value={source}
          onChangeText={setSource}
          multiline
          testID="vocab-source"
        />
        <Button
          label={t('lang.mineVocab')}
          onPress={mineVocabulary}
          busy={busy === 'vocab'}
          disabled={!source.trim()}
        />
      </Section>

      <Section title={t('lang.lesson')} cellStyle={wide ? styles.cell : undefined}>
        <TextInput
          style={styles.input}
          placeholder={t('lang.lessonPlaceholder')}
          placeholderTextColor={c.textMuted}
          value={topic}
          onChangeText={setTopic}
          testID="lesson-topic"
        />
        <Button
          label={t('lang.writeLesson')}
          onPress={makeLesson}
          busy={busy === 'lesson'}
          disabled={!topic.trim()}
        />
      </Section>

        <View style={wide ? styles.cell : undefined}><Dialogue profileId={id} /></View>
        <View style={wide ? styles.cell : undefined}><EssayCorrection profileId={id} /></View>
        <View style={wide ? styles.cell : undefined}><Pronunciation profileId={id} /></View>
        <View style={wide ? styles.cell : undefined}><PronunciationCoach profileId={id} /></View>
      </View>

      <Button variant="ghost" label={t('app.back')} onPress={() => router.replace('/')} />
    </ScrollView>
  );
}

/** Generate a written dialogue to study in the target language. */
function Dialogue({ profileId }: { profileId: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [scenario, setScenario] = useState('');
  const [dialogue, setDialogue] = useState<LanguageDialogue | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setBusy(true);
    setError(null);
    try {
      setDialogue(
        await api<LanguageDialogue>(`/languages/${profileId}/dialogue`, {
          method: 'POST',
          body: { ...(scenario.trim() ? { scenario: scenario.trim() } : {}) },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={t('lang.dialogue')}>
      <Text style={styles.help}>{t('lang.dialogueHelp')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('lang.scenarioPlaceholder')}
        placeholderTextColor={c.textMuted}
        value={scenario}
        onChangeText={setScenario}
        testID="dialogue-scenario"
      />
      {error ? <ErrorBanner message={error} /> : null}
      <Button label={t('lang.generateDialogue')} onPress={generate} busy={busy} />

      {dialogue ? (
        <View style={styles.dialogue} testID="dialogue-result">
          <Text style={styles.dialogueTitle}>{dialogue.title}</Text>
          {dialogue.lines.map((line, i) => (
            <View key={i} style={styles.turn}>
              <Text style={styles.speaker}>{line.speaker}</Text>
              <Text style={styles.dialogueText}>{line.text}</Text>
              {line.translation ? (
                <Text style={styles.dialogueGloss}>{line.translation}</Text>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </Section>
  );
}

/** Correct the learner's written text like a teacher marking a rédaction. */
function EssayCorrection({ profileId }: { profileId: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [text, setText] = useState('');
  const [result, setResult] = useState<EssayCorrectionResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const correct = async () => {
    setBusy(true);
    setError(null);
    try {
      setResult(
        await api<EssayCorrectionResult>(`/languages/${profileId}/essay`, {
          method: 'POST',
          body: { text: text.trim() },
        }),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Section title={t('lang.essay')}>
      <Text style={styles.help}>{t('lang.essayHelp')}</Text>
      <TextInput
        style={[styles.input, styles.tall]}
        placeholder={t('lang.essayPlaceholder')}
        placeholderTextColor={c.textMuted}
        value={text}
        onChangeText={setText}
        multiline
        testID="essay-text"
      />
      {error ? <ErrorBanner message={error} /> : null}
      <Button label={t('lang.correctEssay')} onPress={correct} busy={busy} disabled={!text.trim()} />

      {result ? (
        <View style={styles.essay} testID="essay-result">
          {result.assessment ? (
            <>
              <Text style={styles.essayLabel}>{t('lang.assessment')}</Text>
              <Text style={styles.help}>{result.assessment}</Text>
            </>
          ) : null}

          {result.corrections.length > 0 ? (
            result.corrections.map((c, i) => (
              <View key={i} style={styles.correctionItem}>
                <Text style={styles.wrong}>{c.original}</Text>
                <Text style={styles.right}>{c.correction}</Text>
                {c.explanation ? <Text style={styles.explain}>{c.explanation}</Text> : null}
              </View>
            ))
          ) : (
            <Text style={styles.noMistakes}>{t('lang.noMistakes')}</Text>
          )}

          <Text style={styles.essayLabel}>{t('lang.correctedVersion')}</Text>
          <Text style={styles.corrected}>{result.correctedText}</Text>

          {result.feedback ? <Text style={styles.help}>{result.feedback}</Text> : null}
        </View>
      ) : null}
    </Section>
  );
}

/** Read a phrase aloud and see how much of it was actually understood. */
function Pronunciation({ profileId }: { profileId: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [phrase, setPhrase] = useState('');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PronunciationAssessment | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<Recorder | null>(null);

  const start = async () => {
    setError(null);
    setResult(null);
    try {
      recorder.current = createRecorder();
      await recorder.current.start();
      setRecording(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stop = async () => {
    if (!recorder.current) return;
    setRecording(false);
    setBusy(true);
    try {
      const { blob, mimeType } = await recorder.current.stop();
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const form = new FormData();
      form.append('audio', blob, `say.${ext}`);
      form.append('targetPhrase', phrase.trim());
      setResult(
        await apiUpload<PronunciationAssessment>(`/languages/${profileId}/pronounce`, form),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      recorder.current = null;
      setBusy(false);
    }
  };

  return (
    <Section title={t('lang.sayOutLoud')}>
      <Text style={styles.help}>{t('lang.sayHelp')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('lang.phrasePlaceholder')}
        placeholderTextColor={c.textMuted}
        value={phrase}
        onChangeText={setPhrase}
        testID="target-phrase"
      />
      {error ? <ErrorBanner message={error} /> : null}

      {!RECORDING_SUPPORTED ? (
        <Text style={styles.help}>{t('lang.needsMic')}</Text>
      ) : recording ? (
        <Button label={t('lang.stopScore')} onPress={stop} />
      ) : (
        <Button
          label={t('lang.record')}
          onPress={start}
          busy={busy}
          disabled={!phrase.trim()}
        />
      )}

      {result ? (
        <View style={styles.score} testID="pron-result">
          <Text style={styles.scoreHead}>
            {t('lang.understoodPct').replace(
              '{pct}',
              String(Math.round(result.accuracy * 100)),
            )}
          </Text>
          <Text style={styles.heard}>{t('lang.heard').replace('{text}', result.heard)}</Text>
          <View style={styles.words}>
            {result.words.map((w, i) => (
              <Text key={i} style={[styles.word, w.correct ? styles.wordOk : styles.wordBad]}>
                {w.expected}
              </Text>
            ))}
          </View>
          <Text style={styles.feedback}>{result.feedback}</Text>
        </View>
      ) : null}
    </Section>
  );
}

/** Pronunciation coach (7.5): speak freely, the teacher listens and coaches
 *  across pronunciation, accent, rhythm, fluency and intonation. */
function PronunciationCoach({ profileId }: { profileId: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [context, setContext] = useState('');
  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<PronunciationCoaching | null>(null);
  const [error, setError] = useState<string | null>(null);
  const recorder = useRef<Recorder | null>(null);

  const start = async () => {
    setError(null);
    setResult(null);
    try {
      recorder.current = createRecorder();
      await recorder.current.start();
      setRecording(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stop = async () => {
    if (!recorder.current) return;
    setRecording(false);
    setBusy(true);
    try {
      const { blob, mimeType } = await recorder.current.stop();
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const form = new FormData();
      form.append('audio', blob, `speak.${ext}`);
      if (context.trim()) form.append('context', context.trim());
      setResult(
        await apiUpload<PronunciationCoaching>(
          `/languages/${profileId}/pronunciation-coach`,
          form,
        ),
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      recorder.current = null;
      setBusy(false);
    }
  };

  const badge = (r: PronunciationCoaching['dimensions'][number]['rating']) =>
    r === 'good' ? styles.rateGood : r === 'fair' ? styles.rateFair : styles.rateBad;

  return (
    <Section title={t('lang.pronCoach')}>
      <Text style={styles.help}>{t('lang.pronCoachHelp')}</Text>
      <TextInput
        style={styles.input}
        placeholder={t('lang.coachContextPlaceholder')}
        placeholderTextColor={c.textMuted}
        value={context}
        onChangeText={setContext}
        testID="coach-context"
      />
      {error ? <ErrorBanner message={error} /> : null}

      {!RECORDING_SUPPORTED ? (
        <Text style={styles.help}>{t('lang.needsMic')}</Text>
      ) : recording ? (
        <Button label={t('lang.stopCoaching')} onPress={stop} />
      ) : (
        <Button label={t('lang.speakFreely')} onPress={start} busy={busy} />
      )}

      {result ? (
        <View style={styles.coach} testID="coach-result">
          <Text style={styles.heard}>{t('lang.heard').replace('{text}', result.transcript)}</Text>
          {result.summary ? <Text style={styles.coachSummary}>{result.summary}</Text> : null}

          {result.dimensions.map((d) => (
            <View key={d.kind} style={styles.dim}>
              <View style={styles.dimHead}>
                <Text style={styles.dimName}>{t(`lang.d.${d.kind}` as TranslationKey)}</Text>
                <Text style={[styles.dimBadge, badge(d.rating)]}>
                  {t(`rating.${d.rating}` as TranslationKey)}
                </Text>
              </View>
              {d.observation ? <Text style={styles.help}>{d.observation}</Text> : null}
            </View>
          ))}

          {result.why ? (
            <>
              <Text style={styles.coachLabel}>{t('lang.whyMatters')}</Text>
              <Text style={styles.help}>{result.why}</Text>
            </>
          ) : null}
          {result.howToImprove ? (
            <>
              <Text style={styles.coachLabel}>{t('lang.howImprove')}</Text>
              <Text style={styles.help}>{result.howToImprove}</Text>
            </>
          ) : null}
          {result.exercises.length > 0 ? (
            <>
              <Text style={styles.coachLabel}>{t('lang.coachExercises')}</Text>
              {result.exercises.map((ex, i) => (
                <View key={i} style={styles.exercise}>
                  <Text style={styles.exerciseTitle}>{ex.title}</Text>
                  <Text style={styles.help}>{ex.instructions}</Text>
                </View>
              ))}
            </>
          ) : null}
        </View>
      ) : null}
    </Section>
  );
}

function Section({ title, children, cellStyle }: { title: string; children: React.ReactNode; cellStyle?: ViewStyle }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={[styles.section, cellStyle]}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 10, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, alignItems: 'flex-start' },
  cell: { width: '48%', flexGrow: 1, minWidth: 320 },
  title: { fontSize: 26, fontWeight: '700', color: c.textPrimary },
  meta: { fontSize: 13, color: c.textSecondary, textTransform: 'capitalize', marginBottom: 6 },
  notice: { backgroundColor: c.successSoft, borderColor: c.success },
  noticeText: { color: c.success, fontSize: 14, lineHeight: 20 },
  section: { gap: 8, marginTop: 8 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  help: { fontSize: 13, color: c.textSecondary, lineHeight: 19, marginBottom: 10 },
  cefrRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center', marginBottom: 12 },
  cefrLabel: { fontSize: 12, fontWeight: '700', color: c.textMuted, marginRight: 4 },
  immersionCard: { borderColor: c.primary, gap: 6, marginBottom: 8 },
  immersionText: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
  skillRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 },
  skillCard: { marginTop: 12, gap: 8, borderColor: c.primary },
  skillTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
  coach: { marginTop: 12, gap: 8 },
  coachSummary: { fontSize: 14, color: c.textPrimary, lineHeight: 20, marginBottom: 4 },
  coachLabel: { fontSize: 12, fontWeight: '700', color: c.textMuted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 6 },
  dim: { borderTopWidth: 1, borderTopColor: c.border, paddingTop: 8, gap: 2 },
  dimHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dimName: { fontSize: 14, fontWeight: '700', color: c.textPrimary, textTransform: 'capitalize' },
  dimBadge: { fontSize: 11, fontWeight: '700', paddingVertical: 2, paddingHorizontal: 8, borderRadius: 999, overflow: 'hidden', textTransform: 'capitalize' },
  rateGood: { backgroundColor: c.successSoft, color: c.success },
  rateFair: { backgroundColor: c.warningSoft, color: c.warning },
  rateBad: { backgroundColor: c.errorSoft, color: c.error },
  exercise: { marginTop: 4, gap: 2 },
  exerciseTitle: { fontSize: 14, fontWeight: '600', color: c.textPrimary },
  dialogue: { marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, gap: 10 },
  dialogueTitle: { fontSize: 15, fontWeight: '700', color: c.textPrimary },
  turn: { gap: 2 },
  speaker: { fontSize: 12, fontWeight: '700', color: c.primary },
  dialogueText: { fontSize: 15, color: c.textPrimary, lineHeight: 22 },
  dialogueGloss: { fontSize: 13, color: c.textSecondary, fontStyle: 'italic' },
  essay: { marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10, gap: 8 },
  essayLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 6,
  },
  correctionItem: {
    backgroundColor: c.surfaceElevated,
    borderRadius: 8,
    padding: 10,
    gap: 3,
  },
  wrong: { fontSize: 14, color: c.error, textDecorationLine: 'line-through' },
  right: { fontSize: 14, color: c.success, fontWeight: '600' },
  explain: { fontSize: 13, color: c.textSecondary, marginTop: 2 },
  noMistakes: { fontSize: 14, color: c.success, fontWeight: '600' },
  corrected: { fontSize: 15, color: c.textSecondary, lineHeight: 22 },
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
  tall: { minHeight: 90, textAlignVertical: 'top' },
  score: { marginTop: 12, borderTopWidth: 1, borderTopColor: c.border, paddingTop: 10 },
  scoreHead: { fontSize: 16, fontWeight: '700', color: c.textPrimary },
  heard: { fontSize: 14, color: c.textSecondary, marginTop: 4 },
  words: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  word: { fontSize: 14, paddingVertical: 4, paddingHorizontal: 8, borderRadius: 6 },
  wordOk: { backgroundColor: c.successSoft, color: c.success },
  wordBad: { backgroundColor: c.errorSoft, color: c.error },
  feedback: { fontSize: 14, color: c.textSecondary, marginTop: 12, lineHeight: 21 },
});
