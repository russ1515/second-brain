import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  CefrLevel,
  ExtractVocabularyResponse,
  LanguageLessonResponse,
  LanguageProfileDetail,
  LanguageSkillResponse,
  PronunciationAssessment,
  PronunciationCoaching,
  StartConversationResponse,
} from '@second-brain/shared';
import { CEFR_LEVELS } from '@second-brain/shared';
import type {
  EssayCorrection as EssayCorrectionResult,
  LanguageDialogue,
} from '@second-brain/shared';
import { api, apiUpload } from '../../lib/client';
import { createRecorder, RECORDING_SUPPORTED, type Recorder } from '../../lib/recorder';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';
import { Markdown } from '../../components/markdown';
import { SpeakButton } from '../../components/speak-button';

export default function LanguageScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
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

      <Section title={t('lang.skills')}>
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

      <Section title={t('lang.conversation')}>
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

      <Section title={t('lang.vocabulary')}>
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

      <Section title={t('lang.lesson')}>
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

      <Dialogue profileId={id} />

      <EssayCorrection profileId={id} />

      <Pronunciation profileId={id} />

      <PronunciationCoach profileId={id} />

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

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <Card>{children}</Card>
    </View>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 10, maxWidth: 720, width: '100%', alignSelf: 'center' },
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
