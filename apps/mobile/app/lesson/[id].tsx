import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  CardView,
  LessonExercise,
  LessonFlowProgress,
  LessonFlowStepKey,
  LessonView,
  RecordRlleRemediationExerciseRequest,
  SubmitAttemptResponse,
  TranscriptionResult,
} from '@second-brain/shared';
import { api, apiUpload } from '../../lib/client';
import { saveLessonAsPdf } from '../../lib/lesson-pdf';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';
import { Markdown } from '../../components/markdown';
import { ExerciseCard } from '../../components/exercise-card';
import { SpeakButton } from '../../components/speak-button';
import { LanguagePracticeRunner } from '../../components/language/practice-runner';
import { createRecorder, type Recorder, type Recording } from '../../lib/recorder';
import { recordRlleRemediationExercise } from '../../lib/language-rll-client';
import { featureFlags } from '../../lib/feature-flags';
import { useTeachingSpeechLanguage } from '../../lib/language-teaching';
import {
  classifySpeechInputFailure,
  speechInputError,
  type SpeechInputFailure,
  type SpeechInputPhase,
} from '../../lib/speech-input-error';

/** One step of the pedagogical flow. */
interface FlowStep {
  key: LessonFlowStepKey;
  title: string;
  /** Emoji shown in the section header — gives each step a textbook identity. */
  icon: string;
  node: React.ReactNode;
}

/**
 * A lesson, delivered as a GUIDED, step-by-step pedagogical flow — the teacher
 * walks the learner through the same cycle every time, one step at a time, with
 * no shortcuts: Introduction → Explanation → Examples → Questions → Exercises →
 * Correction → Summary → Flashcards → Revision.
 *
 * Every step stays mounted (only the current one is shown) so an answered
 * exercise keeps its verdict when the learner steps back to review. You advance
 * with "Continue"; there is no way to jump to the end.
 */
export default function LessonScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const {
    id,
    session,
    returnTo,
    languageProfileId,
    remediationPlanId,
    failedAttemptId,
  } = useLocalSearchParams<{
    id: string;
    session?: string;
    returnTo?: string;
    languageProfileId?: string;
    remediationPlanId?: string;
    failedAttemptId?: string;
  }>();
  const router = useRouter();
  const { t, formatLocale } = useI18n();
  const [lesson, setLesson] = useState<LessonView | null>(null);
  const [cards, setCards] = useState<CardView[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState(0);
  const [flow, setFlow] = useState<LessonFlowProgress | null>(null);
  const [flowBusy, setFlowBusy] = useState(false);
  const emptyFlashcardSkip = useRef<string | null>(null);
  const teachingSpeechLanguage = useTeachingSpeechLanguage(
    lesson?.languageProfileId ?? languageProfileId,
  );

  const load = useCallback(async () => {
    try {
      const [l, c, f] = await Promise.all([
        api<LessonView>(`/lessons/${id}`),
        api<CardView[]>(`/lessons/${id}/flashcards`),
        api<LessonFlowProgress>(`/lessons/${id}/flow`),
      ]);
      setLesson(l);
      setCards(c);
      setFlow(f);
      setStep(visibleFlowIndex(f, c.length > 0));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  // The ordered flow — only steps with content, but always in this exact order.
  const steps: FlowStep[] = useMemo(() => {
    if (!lesson) return [];
    const s: FlowStep[] = [];

    // 1 · Introduction (objective banner + intro)
    s.push({
      key: 'intro',
      title: t('lesson.introduction'),
      icon: '📘',
      node: (
        <>
          <ObjectiveBanner objective={lesson.objective} />
          {lesson.intro ? <Markdown text={lesson.intro} /> : null}
        </>
      ),
    });

    // 2 · Concept (the course)
    s.push({
      key: 'explanation',
      title: t('lesson.concept'),
      icon: '💡',
      node: (
        <>
          <Markdown text={lesson.explanation} />
          <SpeakButton
            text={lesson.explanation}
            language={teachingSpeechLanguage}
            label={t('lesson.readAloud')}
          />
        </>
      ),
    });

    // 3 · Examples — each in its own worked-example callout.
    if (lesson.examples.length > 0) {
      s.push({
        key: 'examples',
        title: t('lesson.examples'),
        icon: '🧩',
        node: lesson.examples.map((example, i) => (
          <ExampleCard key={i} index={i} text={example} />
        )),
      });
    }

    // 4 · Questions (guided, not graded)
    if (lesson.questions.length > 0) {
      s.push({
        key: 'questions',
        title: t('lesson.questions'),
        icon: '🤔',
        node: (
          <>
            <Text style={styles.reflect}>{t('lesson.reflect')}</Text>
            {lesson.questions.map((q, i) => (
              <Text key={i} style={styles.question}>
                {i + 1}. {q}
              </Text>
            ))}
          </>
        ),
      });
    }

    // 5 · Exercises (interactive — marked by the Examiner)
    if (lesson.exercises.length > 0) {
      s.push({
        key: 'exercises',
        title: t('lesson.exercises'),
        icon: '✍️',
        node: lesson.exercises.map((exercise, index) =>
          featureFlags.languageMasteryV1 && exercise.languageFormat ? (
          <LanguageTrainingExercise
            key={index}
            exercise={exercise}
            index={index}
            lesson={lesson}
            remediationEvidence={
              featureFlags.languageMasteryV1
              && lesson.languageProfileId
              && languageProfileId === lesson.languageProfileId
              && remediationPlanId
              && failedAttemptId
                ? {
                    failedAttemptId,
                    profileId: lesson.languageProfileId,
                    remediationPlanId,
                  }
                : undefined
            }
          />
        ) : (
          <ExerciseCard
            key={index}
            attemptUrl={`/lessons/${lesson.id}/exercises/${index}/attempt`}
            index={index}
            exercise={exercise}
            onAttempt={() => setError(null)}
          />
        )),
      });

      // 6 · Correction (model answers)
      s.push({
        key: 'correction',
        title: t('lesson.correction'),
        icon: '🔑',
        node: <Corrections exercises={lesson.exercises} />,
      });
    }

    // 7 · Summary (+ homework, as a bonus)
    if (lesson.summary || lesson.homework) {
      s.push({
        key: 'summary',
        title: t('lesson.summary'),
        icon: '📝',
        node: (
          <>
            {lesson.summary ? <Markdown text={lesson.summary} /> : null}
            {lesson.homework ? (
              <>
                <Label t="lesson.homework" />
                <Markdown text={lesson.homework} />
              </>
            ) : null}
          </>
        ),
      });
    }

    // 8 · Key takeaways ("Points clés") — the essentials, as a checklist.
    if (lesson.keyPoints.length > 0) {
      s.push({
        key: 'keyPoints',
        title: t('lesson.keyPoints'),
        icon: '⭐',
        node: <KeyTakeaways points={lesson.keyPoints} />,
      });
    }

    // 9 · Flashcards — optional in the visible flow. The persisted server step
    // is advanced automatically below when there are no cards to show.
    if (cards.length > 0) {
      s.push({
        key: 'flashcards',
        title: t('lesson.flashcards'),
        icon: '🗂️',
        node: (
          <>
            {cards.map((c) => (
              <Flashcard key={c.id} card={c} />
            ))}
            <Text style={styles.foot}>
              {cards.length} {t('lesson.cardsScheduled')}
            </Text>
          </>
        ),
      });
    }

    // 10 · Revision (scheduling promise + review + PDF)
    s.push({
      key: 'revision',
      title: t('lesson.revision'),
      icon: '🔁',
      node: (
        <>
          {lesson.revisionSheet ? <Markdown text={lesson.revisionSheet} /> : null}
          <View style={styles.schedule}>
            <Text style={styles.scheduleText}>{scheduleMessage(cards, t)}</Text>
          </View>
          <Button
            label={t('lesson.doHomework')}
            onPress={() => router.push(`/homework/${lesson.id}`)}
          />
          <Button
            variant="ghost"
            label={t('lesson.reviewNow')}
            onPress={() => router.push('/revision')}
          />
          <Button
            variant="ghost"
            label={t('lesson.savePdf')}
            onPress={() => {
              saveLessonAsPdf(lesson, formatLocale).catch((e) => setError((e as Error).message));
            }}
          />
        </>
      ),
    });

    return s;
  }, [
    cards,
    failedAttemptId,
    languageProfileId,
    lesson,
    remediationPlanId,
    router,
    session,
    t,
    teachingSpeechLanguage,
  ]);

  useEffect(() => {
    if (
      !lesson
      || !flow
      || cards.length > 0
      || flow.completed
      || flow.activeStepKey !== 'flashcards'
    ) return;
    const lockKey = `${id}:${flow.updatedAt}`;
    if (emptyFlashcardSkip.current === lockKey) return;
    emptyFlashcardSkip.current = lockKey;
    let cancelled = false;

    const skip = async () => {
      setFlowBusy(true);
      setError(null);
      try {
        let current = flow;
        if (!current.validatedStepKeys.includes('flashcards')) {
          current = await api<LessonFlowProgress>(
            `/lessons/${id}/flow/flashcards/validate`,
            { method: 'POST' },
          );
        }
        const nextKey = current.stepKeys[current.activeIndex + 1];
        if (!current.completed && nextKey) {
          current = await api<LessonFlowProgress>(
            `/lessons/${id}/flow/${nextKey}/enter`,
            { method: 'POST' },
          );
        }
        if (!cancelled) {
          setFlow(current);
          setStep(visibleFlowIndex(current, false));
        }
      } catch (cause) {
        emptyFlashcardSkip.current = null;
        if (!cancelled) setError((cause as Error).message);
      } finally {
        if (!cancelled) setFlowBusy(false);
      }
    };
    void skip();
    return () => { cancelled = true; };
  }, [cards.length, flow, id, lesson]);

  if (error && !lesson) {
    return (
      <ScrollView contentContainerStyle={styles.container}>
        <ErrorBanner message={error} />
      </ScrollView>
    );
  }
  if (!lesson || !flow) return <Loading label={t('lesson.opening')} />;

  const total = steps.length;
  const clamped = Math.min(step, total - 1);
  const isLast = clamped === total - 1;
  const activeValidated = flow.validatedStepKeys.includes(flow.activeStepKey);
  const activeVisibleIndex = visibleFlowIndex(flow, cards.length > 0);
  const viewingPast = clamped < activeVisibleIndex;
  const canGoBack = clamped > 0 && (flow.completed || activeValidated);

  const continueFlow = async () => {
    if (viewingPast) {
      setStep((current) => Math.min(current + 1, activeVisibleIndex));
      return;
    }
    if (flow.completed) {
      router.replace((
        returnTo?.startsWith('/') && !returnTo.startsWith('//')
          ? returnTo
          : session
            ? `/session/${session}?phase=end`
            : '/'
      ) as never);
      return;
    }
    setFlowBusy(true);
    setError(null);
    try {
      let current = flow;
      if (!activeValidated) {
        current = await api<LessonFlowProgress>(
          `/lessons/${id}/flow/${flow.activeStepKey}/validate`,
          { method: 'POST' },
        );
        setFlow(current);
      }
      if (current.completed) {
        await load();
        return;
      }
      const nextKey = current.stepKeys[current.activeIndex + 1];
      if (!nextKey) return;
      const next = await api<LessonFlowProgress>(
        `/lessons/${id}/flow/${nextKey}/enter`,
        { method: 'POST' },
      );
      setFlow(next);
      setStep(visibleFlowIndex(next, cards.length > 0));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setFlowBusy(false);
    }
  };

  return (
    <View style={styles.flex}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.masthead}>
          <Text style={styles.kicker}>{t('app.today')}</Text>
          <Text style={styles.topic} testID="lesson-topic">
            {lesson.topic}
          </Text>
          {lesson.level ? (
            <View style={styles.levelChip}>
              <Text style={styles.levelChipText}>
                {lesson.level} {t('lesson.pitchedAt')}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Progress — where you are in the flow. */}
        <View style={styles.progressBlock} testID="lesson-progress">
          <View style={styles.dots}>
            {steps.map((s, i) => (
              <View
                key={s.key}
                style={[
                  styles.dot,
                  flow.validatedStepKeys.includes(s.key) && styles.dotDone,
                  i === clamped && styles.dotCurrent,
                ]}
              />
            ))}
          </View>
          <Text style={styles.progressLabel}>
            {t('lesson.step')} {clamped + 1} {t('lesson.of')} {total} · {steps[clamped].title}
          </Text>
        </View>

        {error ? <ErrorBanner message={error} /> : null}

        {/* All steps stay mounted; only the current one is shown, so exercise
            answers survive stepping back to review. */}
        {steps.map((s, i) => (
          <View key={s.key} style={i === clamped ? styles.stepCard : styles.hidden}>
            <Card>
              <SectionHeader
                icon={s.icon}
                kicker={`${t('lesson.step')} ${i + 1} · ${total}`}
                title={s.title}
              />
              <View style={styles.stepBody}>{s.node}</View>
            </Card>
          </View>
        ))}
      </ScrollView>

      {/* Guided navigation — advance one step at a time; no jumping ahead. */}
      <View style={styles.nav}>
        {canGoBack ? (
          <View style={styles.flex}>
            <Button variant="ghost" label={t('lesson.previous')} onPress={() => setStep(clamped - 1)} />
          </View>
        ) : (
          <View style={styles.flex} />
        )}
        <View style={styles.flex}>
          <Button
            label={flow.completed
              ? (session && !returnTo ? t('lesson.finishSession') : t('lesson.finish'))
              : isLast ? t('lesson.finish') : t('lesson.continue')}
            onPress={() => void continueFlow()}
            busy={flowBusy}
          />
        </View>
      </View>
    </View>
  );
}

function visibleFlowIndex(flow: LessonFlowProgress, hasCards: boolean): number {
  const visibleKeys = hasCards
    ? flow.stepKeys
    : flow.stepKeys.filter((key) => key !== 'flashcards');
  const direct = visibleKeys.indexOf(flow.activeStepKey);
  if (direct >= 0) return direct;
  return Math.max(0, Math.min(flow.activeIndex, visibleKeys.length - 1));
}

/**
 * The teacher's scheduling promise (predictive revision), built from the
 * lesson's real flashcard due dates. New cards are due now, so we frame the
 * FSRS promise; once reviewed, FSRS pushes the next review out and we say when.
 */
function LanguageTrainingExercise({
  exercise,
  index,
  lesson,
  remediationEvidence,
}: {
  exercise: LessonExercise;
  index: number;
  lesson: LessonView;
  remediationEvidence?: {
    failedAttemptId: string;
    profileId: string;
    remediationPlanId: string;
  };
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const recorder = useRef<Recorder | null>(null);
  const writtenSubmissionInFlight = useRef(false);
  const [busy, setBusy] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [speechFailure, setSpeechFailure] = useState<SpeechInputFailure | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [result, setResult] = useState<SubmitAttemptResponse | null>(null);
  const [pendingEvidence, setPendingEvidence] =
    useState<RecordRlleRemediationExerciseRequest | null>(null);

  useEffect(() => () => recorder.current?.cancel(), []);

  const recordRemediationEvidence = async (
    request: RecordRlleRemediationExerciseRequest,
  ) => {
    if (!remediationEvidence) {
      throw new Error(t('rlle.ui.capabilities.blockedDetail' as TranslationKey));
    }
    await recordRlleRemediationExercise(remediationEvidence.profileId, request);
    setPendingEvidence(null);
  };

  const submitWritten = async (answer: string) => {
    if (writtenSubmissionInFlight.current || result) return;
    writtenSubmissionInFlight.current = true;
    setBusy(true);
    setError(null);
    try {
      const response = await api<SubmitAttemptResponse>(
        `/lessons/${lesson.id}/exercises/${index}/attempt`,
        { method: 'POST', body: { answer } },
      );
      setResult(response);
      if (remediationEvidence && exercise.languageFormat) {
        const evidenceRequest: RecordRlleRemediationExerciseRequest = {
          remediationPlanId: remediationEvidence.remediationPlanId,
          failedAttemptId: remediationEvidence.failedAttemptId,
          lessonId: response.attempt.lessonId,
          exerciseAttemptId: response.attempt.id,
          exerciseIndex: response.attempt.exerciseIndex,
          trainingFormat: exercise.languageFormat,
        };
        setPendingEvidence(evidenceRequest);
        await recordRemediationEvidence(evidenceRequest);
      }
    } catch (cause) {
      setError((cause as Error).message);
    } finally {
      writtenSubmissionInFlight.current = false;
      setBusy(false);
    }
  };

  const toggleVoice = async () => {
    setError(null);
    setSpeechFailure(null);
    if (!recording) {
      try {
        recorder.current = createRecorder();
        await recorder.current.start();
        setRecording(true);
      } catch (cause) {
        recorder.current?.cancel();
        recorder.current = null;
        setSpeechFailure(speechFailureFor(cause, 'recording', t));
      }
      return;
    }

    setRecording(false);
    setBusy(true);
    let recordingPayload: Recording;
    try {
      const active = recorder.current;
      if (!active) {
        throw speechInputError('AUDIO_RECORDING', t('voice.error.notRecording'));
      }
      recordingPayload = await active.stop();
    } catch (cause) {
      recorder.current = null;
      setBusy(false);
      setSpeechFailure(speechFailureFor(cause, 'recording', t));
      return;
    }
    recorder.current = null;

    try {
      const form = new FormData();
      const extension = recordingPayload.mimeType.includes('mp4')
        ? 'mp4'
        : recordingPayload.mimeType.includes('ogg')
          ? 'ogg'
          : recordingPayload.mimeType.includes('wav')
            ? 'wav'
            : 'webm';
      form.append('audio', recordingPayload.blob, `language-answer.${extension}`);
      if (recordingPayload.durationMs !== undefined) {
        form.append('durationMs', String(recordingPayload.durationMs));
      }
      if (!lesson.languageProfileId) {
        throw speechInputError('STT_ERROR', t('learn5.voice.error'));
      }
      form.append('lessonId', lesson.id);
      form.append('exerciseIndex', String(index));
      const transcript = await apiUpload<TranscriptionResult>(
        `/languages/${encodeURIComponent(lesson.languageProfileId)}/course/training/stt`,
        form,
      );
      const text = transcript.text.trim();
      if (!text) throw speechInputError('STT_ERROR', t('voice.error.empty'));
      setVoiceTranscript(text);
    } catch (cause) {
      setSpeechFailure(speechFailureFor(cause, 'transcription', t));
    } finally {
      setBusy(false);
    }
  };

  const attempt = result?.attempt;
  return (
    <View style={styles.practiceBlock}>
      <LanguagePracticeRunner
        busy={busy || Boolean(result)}
        exercise={exercise}
        index={index}
        language={lesson.language}
        onSubmit={(answer) => void submitWritten(answer)}
        onVoice={() => void toggleVoice()}
        voiceActive={recording}
        voiceTranscript={voiceTranscript}
      />
      {speechFailure ? (
        <View testID={`language-speech-error-${speechFailure.code.toLowerCase()}`}>
          <ErrorBanner message={speechFailure.message} />
        </View>
      ) : null}
      {error ? <ErrorBanner message={error} /> : null}
      {pendingEvidence ? (
        <Button
          label={t('rlle.ui.common.retry' as TranslationKey)}
          onPress={() => {
            setBusy(true);
            setError(null);
            void recordRemediationEvidence(pendingEvidence)
              .catch((cause) => setError((cause as Error).message))
              .finally(() => setBusy(false));
          }}
          busy={busy}
          testID={`language-remediation-evidence-retry-${index}`}
          variant="ghost"
        />
      ) : null}
      {attempt ? (
        <Card style={styles.practiceFeedback} testID={`language-feedback-${index}`}>
          <Text style={[styles.practiceVerdict, attempt.correct ? styles.practiceOk : styles.practiceRetry]}>
            {attempt.correct ? t('lesson.correct') : t('lesson.notQuite')} · {Math.round(attempt.score * 100)}%
          </Text>
          <Text style={styles.practiceBody}>{attempt.feedback}</Text>
          {attempt.why ? <Text style={styles.practiceBody}>{attempt.why}</Text> : null}
          {attempt.how ? <Text style={styles.practiceBody}>{attempt.how}</Text> : null}
        </Card>
      ) : null}
    </View>
  );
}

function speechFailureFor(
  cause: unknown,
  phase: SpeechInputPhase,
  t: (key: TranslationKey) => string,
): SpeechInputFailure {
  const code = classifySpeechInputFailure(cause, phase);
  const message = code === 'MIC_PERMISSION'
    ? t('voice.error.micDenied')
    : code === 'MEDIARECORDER_UNAVAILABLE'
      ? t('voice.error.recordUnsupported')
      : code === 'AUDIO_RECORDING'
        ? t('learn5.voice.error')
        : code === 'AUDIO_UPLOAD' || code === 'TRANSCODE'
          ? t('error.upload')
          : code === 'STT_UNAVAILABLE'
            ? `${t('rlle.ui.capabilities.transcription')} — ${t('state.partial')}`
            : code === 'STT_ERROR'
              ? `${t('rlle.ui.capabilities.transcription')} — ${t('error.detail')}`
              : t('rlle.ui.capabilities.blockedDetail');
  return { code, message };
}

function scheduleMessage(cards: CardView[], t: (k: TranslationKey) => string): string {
  if (cards.length === 0) return t('lesson.scheduleWhy');
  const now = Date.now();
  const soonest = Math.min(...cards.map((c) => new Date(c.due).getTime()));
  const days = Math.ceil((soonest - now) / 86_400_000);
  if (days >= 1) {
    const unit = days === 1 ? t('lesson.day') : t('lesson.days');
    return `${t('lesson.scheduleIn')} ${days} ${unit}. ${t('lesson.scheduleWhy')}`;
  }
  return t('lesson.scheduleNow');
}

/** The model answers, revealed on demand — the answer key for the exercises. */
function Corrections({ exercises }: { exercises: LessonExercise[] }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [shown, setShown] = useState(false);
  if (!shown) {
    return <Button variant="ghost" label={t('lesson.showCorrections')} onPress={() => setShown(true)} />;
  }
  return (
    <>
      {exercises.map((e, i) => (
        <View key={i} style={i > 0 ? styles.spaced : undefined}>
          <Text style={styles.question}>
            {i + 1}. {e.question}
          </Text>
          <Text style={styles.answerModel}>{e.answer}</Text>
        </View>
      ))}
      <Button variant="ghost" label={t('lesson.hideCorrections')} onPress={() => setShown(false)} />
    </>
  );
}

/** One generated flashcard: front, tap to reveal the back. */
function Flashcard({ card }: { card: CardView }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <Pressable onPress={() => setOpen((o) => !o)} accessibilityRole="button">
      <View style={styles.flashcard}>
        <Text style={styles.flashFront}>{card.front}</Text>
        {open ? (
          <Text style={styles.flashBack}>{card.back}</Text>
        ) : (
          <Text style={styles.flashHint}>{t('lesson.reveal')}</Text>
        )}
      </View>
    </Pressable>
  );
}

/** Textbook-style section header: an icon chip + kicker + title, with a rule.
 *  This is what gives each step the look of a chapter section. */
function SectionHeader({ icon, kicker, title }: { icon: string; kicker: string; title: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.iconChip}>
        <Text style={styles.iconChipText}>{icon}</Text>
      </View>
      <View style={styles.flex}>
        <Text style={styles.sectionKicker}>{kicker}</Text>
        <Text style={styles.sectionTitleBig}>{title}</Text>
      </View>
    </View>
  );
}

/** The learning objective, as a highlighted "by the end you'll be able to" box. */
function ObjectiveBanner({ objective }: { objective: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  return (
    <View style={styles.objectiveBanner}>
      <Text style={styles.objectiveLabel}>🎯 {t('lesson.objectiveLabel')}</Text>
      <Text style={styles.objectiveText}>{objective}</Text>
    </View>
  );
}

/** One worked example, in a numbered callout — the textbook "Example N" box. */
function ExampleCard({ index, text }: { index: number; text: string }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  return (
    <View style={styles.exampleCard}>
      <Text style={styles.exampleTag}>
        {t('lesson.example')} {index + 1}
      </Text>
      <Markdown text={text} />
    </View>
  );
}

/** Key takeaways ("Points clés") — the essentials as a checked list. */
function KeyTakeaways({ points }: { points: string[] }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  return (
    <View style={styles.takeaways}>
      {points.map((p, i) => (
        <View key={i} style={styles.takeawayRow}>
          <Text style={styles.takeawayCheck}>✓</Text>
          <Text style={styles.takeawayText}>{p}</Text>
        </View>
      ))}
    </View>
  );
}

function Label({ t: key }: { t: TranslationKey }) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { t } = useI18n();
  return <Text style={styles.label}>{t(key)}</Text>;
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  flex: { flex: 1 },
  hidden: { display: 'none' },
  container: { padding: 20, gap: 12, maxWidth: 1280, width: '100%', alignSelf: 'center' },
  practiceBlock: { gap: 10 },
  practiceFeedback: { gap: 8, borderColor: c.border },
  practiceVerdict: { color: c.textPrimary, fontSize: 15, fontWeight: '700' },
  practiceOk: { color: c.success },
  practiceRetry: { color: c.warning },
  practiceLabel: { color: c.textMuted, fontSize: 11, fontWeight: '700', textTransform: 'uppercase' },
  practiceBody: { color: c.textSecondary, fontSize: 14, lineHeight: 21 },
  masthead: { gap: 4 },
  kicker: {
    fontSize: 12,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1.5,
  },
  topic: { fontSize: 28, fontWeight: '800', color: c.textPrimary, lineHeight: 34 },
  levelChip: {
    alignSelf: 'flex-start',
    backgroundColor: c.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 4,
  },
  levelChipText: {
    fontSize: 12,
    color: c.textSecondary,
    fontWeight: '600',
    textTransform: 'capitalize',
  },
  // Textbook section header
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: c.border,
    paddingBottom: 12,
    marginBottom: 4,
  },
  iconChip: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: c.surfaceElevated,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChipText: { fontSize: 22 },
  sectionKicker: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  sectionTitleBig: { fontSize: 20, fontWeight: '700', color: c.textPrimary, marginTop: 1 },
  stepBody: { marginTop: 14, gap: 12 },
  // Objective banner
  objectiveBanner: {
    backgroundColor: c.surfaceElevated,
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
    borderRadius: 10,
    padding: 14,
  },
  objectiveLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: c.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 6,
  },
  objectiveText: { fontSize: 17, fontWeight: '600', color: c.textPrimary, lineHeight: 25 },
  // Worked-example callout
  exampleCard: {
    backgroundColor: c.surfaceElevated,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: c.border,
    padding: 14,
  },
  exampleTag: {
    fontSize: 11,
    fontWeight: '700',
    color: c.warning,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  // Key takeaways
  takeaways: { gap: 12 },
  takeawayRow: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  takeawayCheck: {
    fontSize: 15,
    fontWeight: '800',
    color: c.success,
    lineHeight: 24,
    width: 18,
    textAlign: 'center',
  },
  takeawayText: { flex: 1, fontSize: 16, lineHeight: 24, color: c.textPrimary },
  progressBlock: { gap: 8, marginBottom: 4 },
  dots: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  dot: {
    flex: 1,
    minWidth: 14,
    height: 5,
    borderRadius: 3,
    backgroundColor: c.border,
  },
  dotDone: { backgroundColor: c.success },
  dotCurrent: { backgroundColor: c.primary },
  progressLabel: {
    fontSize: 13,
    fontWeight: '700',
    color: c.textSecondary,
  },
  stepCard: { marginTop: 2 },
  nav: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    padding: 16,
    paddingBottom: 20,
    borderTopWidth: 1,
    borderTopColor: c.border,
    backgroundColor: c.background,
    maxWidth: 1280,
    width: '100%',
    alignSelf: 'center',
  },
  confirmation: {
    width: '100%',
    gap: 6,
    padding: 12,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 12,
    backgroundColor: c.surfaceElevated,
  },
  confirmationTitle: { fontSize: 15, fontWeight: '800', color: c.textPrimary },
  confirmationText: { fontSize: 13, lineHeight: 19, color: c.textSecondary },
  confirmationActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  label: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginTop: 10,
    marginBottom: 4,
  },
  muted: { fontSize: 14, color: c.textSecondary },
  reflect: { fontSize: 13, color: c.textMuted, fontStyle: 'italic', marginBottom: 4 },
  spaced: { marginTop: 12 },
  question: { fontSize: 15, fontWeight: '600', color: c.textPrimary, lineHeight: 22, marginTop: 6 },
  answerModel: { fontSize: 14, color: c.success, lineHeight: 21, marginTop: 4 },
  schedule: {
    backgroundColor: c.surfaceElevated,
    borderRadius: 10,
    padding: 12,
    borderLeftWidth: 3,
    borderLeftColor: c.primary,
  },
  scheduleText: { fontSize: 14, color: c.textSecondary, lineHeight: 21 },
  flashcard: {
    backgroundColor: c.surfaceElevated,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 14,
    marginTop: 8,
  },
  flashFront: { fontSize: 15, fontWeight: '600', color: c.textPrimary },
  flashBack: { fontSize: 14, color: c.textSecondary, marginTop: 8, lineHeight: 20 },
  flashHint: { fontSize: 12, color: c.textMuted, marginTop: 8 },
  foot: { fontSize: 12, color: c.textMuted, marginTop: 8 },
});
