import { useCallback, useEffect, useRef, useState, useMemo } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  SendTutorMessageResponse,
  TeachingStrategy,
  TutorMessageView,
  TutorPace,
  TutorSessionDetail,
  VoiceTurnResponse,
} from '@second-brain/shared';
import { api, apiUpload } from '../../lib/client';
import { createRecorder, RECORDING_SUPPORTED, type Recorder } from '../../lib/recorder';
import { PLAYBACK_SUPPORTED, speak } from '../../lib/speak';
import { useTokens } from '../../lib/design/theme';
import type { ColorScale } from '../../lib/design/tokens';
import { useI18n, type TranslationKey } from '../../lib/i18n';
import { teacherRoleLabel } from '../../lib/teacher-role';
import { Button, Card, ErrorBanner, Loading } from '../../components/ui';
import { SpeakButton } from '../../components/speak-button';

/** Teaching Strategy Engine (7.9) labels for the session chip. */
const STRATEGY_LABEL: Record<TeachingStrategy, TranslationKey> = {
  socratic: 'strategy.socratic',
  project_based: 'strategy.project_based',
  problem_solving: 'strategy.problem_solving',
  case_study: 'strategy.case_study',
  task_based: 'strategy.task_based',
  guided_demonstration: 'strategy.guided_demonstration',
  active_learning: 'strategy.active_learning',
  experiential: 'strategy.experiential',
};

/** Discussion with the teacher — typed or spoken. A spoken turn also leaves a
 *  written lesson behind (written-first), which is surfaced here. */
export default function TutorSessionScreen() {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { t, locale } = useI18n();
  const [session, setSession] = useState<TutorSessionDetail | null>(null);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const recorder = useRef<Recorder | null>(null);

  const load = useCallback(async () => {
    try {
      setSession(await api<TutorSessionDetail>(`/tutor/sessions/${id}`));
    } catch (e) {
      setError((e as Error).message);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const postTurn = async (content: string, pace?: TutorPace) => {
    setBusy(true);
    setError(null);
    try {
      await api<SendTutorMessageResponse>(`/tutor/sessions/${id}/messages`, {
        method: 'POST',
        body: pace ? { content, pace } : { content },
      });
      setDraft('');
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const send = async () => {
    const content = draft.trim();
    if (!content) return;
    await postTurn(content);
  };

  // Pace control (Task 3.3): let the learner ask the teacher to slow down or
  // speed up. Each sends a plain request the teacher can also see in the thread.
  const sendPace = (pace: TutorPace) =>
    postTurn(t(pace === 'slower' ? 'tutor.slowerMsg' : 'tutor.fasterMsg'), pace);

  // Only offer pacing once the teacher has actually explained something.
  const canPace =
    !!session?.messages.some((m) => m.role === 'assistant') && !recording;

  const startRecording = async () => {
    setError(null);
    setNotice(null);
    try {
      recorder.current = createRecorder();
      await recorder.current.start();
      setRecording(true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const stopAndSend = async () => {
    if (!recorder.current) return;
    setRecording(false);
    setBusy(true);
    setNotice(t('tutor.transcribing'));
    try {
      const { blob, mimeType } = await recorder.current.stop();
      const form = new FormData();
      // The API reads the mime type off the upload, so keep the extension and
      // the type in step with what MediaRecorder actually produced.
      const ext = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      form.append('audio', blob, `turn.${ext}`);
      const turn = await apiUpload<VoiceTurnResponse>(`/tutor/sessions/${id}/voice`, form);
      setNotice(
        turn.lesson
          ? `${t('tutor.heard')} “${turn.transcript}” ${t('tutor.filedA')} “${turn.lesson.topic}” ${t('tutor.filedInto')} ${turn.lesson.cardCount} ${t('tutor.flashcards')}.`
          : `${t('tutor.heard')} “${turn.transcript}”`,
      );
      await load();
      // Voice Learning (7.4): the teacher speaks its reply back automatically —
      // a natural spoken exchange. The written trace is already persisted above.
      if (PLAYBACK_SUPPORTED && turn.message?.content) {
        setNotice(t('tutor.teacherSpeaking'));
        try {
          await speak(turn.message.content, turn.language ?? undefined);
        } catch {
          // Auto-speak is best-effort; the text reply is already shown.
        }
        setNotice(null);
      }
    } catch (e) {
      setError((e as Error).message);
      setNotice(null);
    } finally {
      recorder.current = null;
      setBusy(false);
    }
  };

  const cancelRecording = () => {
    recorder.current?.cancel();
    recorder.current = null;
    setRecording(false);
  };

  if (!session && !error) return <Loading label={t('tutor.opening')} />;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>{session?.title ?? t('tutor.discussion')}</Text>
      {/* The role the teacher has automatically taken on for this subject. */}
      {session && session.role.kind !== 'general' ? (
        <View style={styles.roleChip}>
          <Text style={styles.roleChipText}>
            {session.role.emoji} {teacherRoleLabel(session.role, locale)}
          </Text>
        </View>
      ) : null}
      {session?.focusConceptName ? (
        <Text style={styles.focus}>
          {t('tutor.focusedOn')} {session.focusConceptName}
        </Text>
      ) : null}
      {/* Teaching Strategy Engine (7.9): how the teacher is running this session. */}
      {session?.strategy ? (
        <View style={styles.strategyChip}>
          <Text style={styles.strategyChipText}>
            🎓 {t(STRATEGY_LABEL[session.strategy])}
          </Text>
          {session.strategyReason ? (
            <Text style={styles.strategyReason}>{session.strategyReason}</Text>
          ) : null}
        </View>
      ) : null}

      {error ? <ErrorBanner message={error} /> : null}
      {notice ? (
        <Card style={styles.notice}>
          <Text style={styles.noticeText}>{notice}</Text>
        </Card>
      ) : null}

      {session?.messages.map((m) => (
        <Message key={m.id} message={m} t={t} />
      ))}

      <TextInput
        style={styles.input}
        placeholder={t('tutor.placeholder')}
        placeholderTextColor={c.textMuted}
        value={draft}
        onChangeText={setDraft}
        multiline
        editable={!busy && !recording}
        testID="tutor-input"
      />

      <Button
        label={t('tutor.send')}
        onPress={send}
        busy={busy}
        disabled={!draft.trim() || recording}
      />

      {canPace ? (
        <View style={styles.paceRow}>
          <View style={styles.flex}>
            <Button
              variant="ghost"
              label={t('tutor.slower')}
              onPress={() => sendPace('slower')}
              disabled={busy}
            />
          </View>
          <View style={styles.flex}>
            <Button
              variant="ghost"
              label={t('tutor.faster')}
              onPress={() => sendPace('faster')}
              disabled={busy}
            />
          </View>
        </View>
      ) : null}

      {RECORDING_SUPPORTED ? (
        recording ? (
          <View style={styles.recordRow}>
            <View style={styles.flex}>
              <Button label={t('tutor.stopSend')} onPress={stopAndSend} />
            </View>
            <Button variant="ghost" label={t('tutor.cancel')} onPress={cancelRecording} />
          </View>
        ) : (
          <Button
            variant="ghost"
            label={t('tutor.speak')}
            onPress={startRecording}
            disabled={busy}
          />
        )
      ) : (
        <Text style={styles.unsupported}>{t('tutor.voiceUnsupported')}</Text>
      )}

      {recording ? <Text style={styles.recordingHint}>{t('tutor.recording')}</Text> : null}

      <Button variant="ghost" label={t('app.back')} onPress={() => router.replace('/')} />
    </ScrollView>
  );
}

function Message({
  message,
  t,
}: {
  message: TutorMessageView;
  t: (key: TranslationKey) => string;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const mine = message.role === 'user';
  return (
    <Card style={mine ? styles.mine : styles.theirs}>
      <View style={styles.metaRow}>
        <Text style={styles.who}>{mine ? t('tutor.you') : t('tutor.teacher')}</Text>
        {message.viaVoice ? <Text style={styles.voiceTag}>{t('tutor.spoken')}</Text> : null}
      </View>
      <Text style={styles.body}>{message.content}</Text>

      {/* The teacher speaks. No language is passed: the reply's own text
          carries it, which is what matters in an immersion conversation. */}
      {!mine ? <SpeakButton text={message.content} /> : null}

      {message.citations?.length ? (
        <Text style={styles.citations}>
          {t('tutor.groundedPre')} {message.citations.length}{' '}
          {message.citations.length === 1
            ? t('tutor.groundedPassage')
            : t('tutor.groundedPassages')}{' '}
          {t('tutor.groundedPost')}{' '}
          {message.citations.map((c) => c.documentTitle).join(', ')}
        </Text>
      ) : null}
    </Card>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  container: { padding: 20, gap: 10, maxWidth: 720, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  title: { fontSize: 24, fontWeight: '700', color: c.textPrimary },
  roleChip: {
    alignSelf: 'flex-start',
    backgroundColor: c.surfaceElevated,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 2,
  },
  roleChipText: { fontSize: 13, color: c.primary, fontWeight: '700' },
  focus: { fontSize: 13, color: c.warning, marginBottom: 6 },
  strategyChip: {
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 2,
  },
  strategyChipText: { fontSize: 13, color: c.textPrimary, fontWeight: '700' },
  strategyReason: { fontSize: 12, color: c.textSecondary, lineHeight: 17 },
  notice: { backgroundColor: c.surfaceElevated, borderColor: c.primary },
  noticeText: { color: '#CBD5E1', fontSize: 14, lineHeight: 20 },
  mine: { backgroundColor: c.surfaceElevated },
  theirs: {},
  metaRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  who: {
    fontSize: 11,
    fontWeight: '700',
    color: c.textMuted,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  voiceTag: { fontSize: 11, color: c.warning },
  body: { fontSize: 15, color: '#E2E8F0', lineHeight: 23 },
  citations: {
    marginTop: 10,
    fontSize: 12,
    color: c.textMuted,
    borderTopWidth: 1,
    borderTopColor: c.border,
    paddingTop: 8,
  },
  input: {
    backgroundColor: c.surface,
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 10,
    padding: 12,
    minHeight: 72,
    fontSize: 15,
    color: c.textPrimary,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  paceRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  recordRow: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  recordingHint: { color: c.warning, fontSize: 13, textAlign: 'center' },
  unsupported: { color: c.textMuted, fontSize: 13, textAlign: 'center' },
});
