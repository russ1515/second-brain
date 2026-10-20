import { useCallback, useEffect, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { Alert, Badge, Button, Card } from '../ds/core';
import { SpeakButton } from '../speak-button';
import { useTokens } from '../../lib/design/theme';
import { localeDirection, trInLocale, type TranslationKey } from '../../lib/i18n';
import { useRlleCopy } from '../../lib/language-rll-i18n';
import { createRecorder, RECORDING_SUPPORTED, type Recorder, type Recording } from '../../lib/recorder';
import { stopSpeaking } from '../../lib/speak';
import { createClientRequestId } from '../../lib/request-id';
import {
  loadPhoneticAttempts, loadPhoneticCapability, submitPhoneticRecording,
  type PhoneticAttemptView, type PhoneticCapabilityView, type PhoneticReference,
} from '../../lib/phonetic-evidence-client';
import {
  phoneticComparisonKey, phoneticFailureKey, phoneticLessonHistory,
  phoneticPanelEnabled, phoneticRecordingFailure, phoneticResultFailure,
} from '../../lib/phonetic-evidence-presentation';

/** An additive practice capability, never an assessment/completion control.
 * Server-authored references and an available flagged engine are mandatory.
 * Mounting/refreshing only reads: no TTS, LLM, recording or inference starts. */
export function PhoneticEvidencePanel({ profileId, lessonId, supportLanguageCode, targetLanguageCode }: {
  profileId: string; lessonId: string; supportLanguageCode?: string; targetLanguageCode: string;
}) {
  const { colors: c, spacing, typography } = useTokens();
  const { copy: interfaceCopy } = useRlleCopy();
  const direction = localeDirection(supportLanguageCode ?? 'en');
  const targetDirection = localeDirection(targetLanguageCode);
  const copy = (key: string, values?: Record<string, string | number>) => supportLanguageCode
    ? trInLocale(supportLanguageCode, key as TranslationKey, values) : null;
  const [capability, setCapability] = useState<PhoneticCapabilityView | null>(null);
  const [attempts, setAttempts] = useState<PhoneticAttemptView[]>([]);
  const [referenceIndex, setReferenceIndex] = useState(0);
  const [retry, setRetry] = useState<{ parentAttemptId: string; targetWordIndex: number; word: string } | null>(null);
  const [recording, setRecording] = useState<Recording | null>(null);
  const [phase, setPhase] = useState<'idle' | 'starting' | 'recording' | 'stopping' | 'uploading'>('idle');
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [historyFailed, setHistoryFailed] = useState(false);
  const recorder = useRef<Recorder | null>(null);
  const mounted = useRef(false);
  const generation = useRef(0);
  const inFlight = useRef(false);
  const expiry = useRef<ReturnType<typeof setTimeout> | null>(null);
  const attemptKey = useRef<string | null>(null);
  const clearExpiry = () => { if (expiry.current) clearTimeout(expiry.current); expiry.current = null; };
  const releaseRecording = () => {
    clearExpiry(); recorder.current?.cancel(); recorder.current = null;
    setRecording(null); attemptKey.current = null; setPhase('idle');
  };
  const load = useCallback(async () => {
    const current = generation.current;
    try {
      const next = await loadPhoneticCapability(profileId, lessonId);
      if (!mounted.current || current !== generation.current) return;
      setCapability(next);
      if (!phoneticPanelEnabled(next)) return;
      try {
        const history = await loadPhoneticAttempts(profileId);
        if (mounted.current && current === generation.current) { setAttempts(history); setHistoryFailed(false); }
      } catch {
        if (mounted.current && current === generation.current) setHistoryFailed(true);
      }
    } catch {
      // Flag absent/older API/unsupported capability leaves the existing
      // practice experience intact. No automatic retry or synthetic score.
      if (mounted.current && current === generation.current) setCapability(null);
    }
  }, [profileId, lessonId]);
  useEffect(() => {
    mounted.current = true; generation.current += 1; setCapability(null); setAttempts([]); void load();
    return () => { mounted.current = false; generation.current += 1; clearExpiry(); recorder.current?.cancel(); recorder.current = null; };
  }, [load]);

  const reference = capability?.references[referenceIndex];
  const history = reference ? phoneticLessonHistory(attempts, reference.lessonId, reference.exerciseIndex) : [];
  const latest = history[0];
  const stop = async () => {
    if (inFlight.current || !recorder.current || !capability) return;
    inFlight.current = true; setPhase('stopping'); clearExpiry();
    try {
      const audio = await recorder.current.stop(); recorder.current = null;
      if (!mounted.current) return;
      const failure = phoneticRecordingFailure(audio.blob.size, audio.durationMs, capability.bounds);
      setErrorKey(failure);
      if (!failure) { setRecording(audio); attemptKey.current = createClientRequestId('phonetic'); }
    } catch (cause) { if (mounted.current) setErrorKey(phoneticFailureKey(cause)); }
    finally { inFlight.current = false; if (mounted.current) setPhase('idle'); }
  };
  const start = async () => {
    if (inFlight.current || !reference || !capability || !phoneticPanelEnabled(capability)) return;
    inFlight.current = true; setPhase('starting'); setErrorKey(null); setRecording(null); attemptKey.current = null;
    stopSpeaking();
    const active = createRecorder(); recorder.current = active;
    try {
      await active.start();
      if (!mounted.current) { active.cancel(); return; }
      setPhase('recording');
      expiry.current = setTimeout(() => { void stop(); }, capability.bounds.maxDurationMs);
    } catch (cause) {
      active.cancel(); recorder.current = null;
      if (mounted.current) { setErrorKey(phoneticFailureKey(cause)); setPhase('idle'); }
    } finally { inFlight.current = false; }
  };
  const submit = async () => {
    if (inFlight.current || !recording || !reference || !attemptKey.current) return;
    const current = generation.current;
    inFlight.current = true; setPhase('uploading'); setErrorKey(null);
    try {
      const attempt = await submitPhoneticRecording(profileId, reference, recording, attemptKey.current,
        retry ? { parentAttemptId: retry.parentAttemptId, targetWordIndex: retry.targetWordIndex } : undefined);
      if (!mounted.current || current !== generation.current) return;
      setAttempts((previous) => [attempt, ...previous.filter((item) => item.id !== attempt.id)]);
      setRecording(null); attemptKey.current = null;
      setErrorKey(attempt.state === 'technical_error' ? 'phonetic.engineUnavailable' : phoneticResultFailure(attempt.result));
      // A single owned-history read obtains the server-derived comparison;
      // this does not retry or start another acoustic inference.
      try {
        const history = await loadPhoneticAttempts(profileId);
        if (mounted.current && current === generation.current) { setAttempts(history); setHistoryFailed(false); }
      } catch { if (mounted.current && current === generation.current) setHistoryFailed(true); }
    } catch (cause) { if (mounted.current) setErrorKey(phoneticFailureKey(cause)); }
    finally { inFlight.current = false; if (mounted.current) setPhase('idle'); }
  };

  if (!phoneticPanelEnabled(capability) || !reference || !copy('phonetic.experimental')) return null;
  const title = (key: string, values?: Record<string, string | number>) => copy(key, values) ?? interfaceCopy('error.detail');
  const locked = phase !== 'idle';
  const textStyle = { color: c.textPrimary, writingDirection: targetDirection, textAlign: targetDirection === 'rtl' ? 'right' as const : 'left' as const };
  const failure = errorKey ?? (latest?.state === 'technical_error' ? 'phonetic.engineUnavailable'
    : latest?.result ? phoneticResultFailure(latest.result) : null);
  return <Card testID="phonetic-evidence-panel" style={{ gap: spacing.sm, direction }}>
    <Text accessibilityRole="header" style={[typography.h3, { color: c.textPrimary }]}>{title('rlle.ui.training.format.voice-pronunciation')}</Text>
    <Badge label={title('phonetic.experimental')} tone="info" />
    <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{title('phonetic.unverified')}</Text>
    {capability?.diagnosticStatus === 'INSUFFICIENT_ACOUSTIC_CONFIDENCE'
      ? <Alert tone="info" title={title('phonetic.insufficient')} /> : null}
    {capability!.references.length > 1 ? <View style={{ gap: spacing.xs }}>
      {capability!.references.map((item, index) => <Button key={`${item.lessonId}:${item.exerciseIndex}`}
        variant={index === referenceIndex ? 'secondary' : 'ghost'} label={item.referenceText} disabled={locked}
        onPress={() => { releaseRecording(); setReferenceIndex(index); setRetry(null); setErrorKey(null); }} />)}
    </View> : null}
    <Text style={[typography.label, { color: c.textMuted }]}>{title('phonetic.reference')}</Text>
    <Text testID="phonetic-reference" style={[typography.body, textStyle]}>{retry?.word ?? reference.referenceText}</Text>
    {phase !== 'recording' && phase !== 'starting' && phase !== 'stopping'
      ? <SpeakButton text={retry?.word ?? reference.referenceText} language={targetLanguageCode} label={title('lesson.readAloud')} /> : null}
    {!RECORDING_SUPPORTED ? <Alert tone="warning" title={title('voice.error.recordUnsupported')} /> : <>
      {phase === 'recording' ? <Text accessibilityLiveRegion="polite" style={[typography.bodySmall, { color: c.textSecondary }]}>{title('learn.oral.recording')}</Text> : null}
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        <Button testID="phonetic-record" variant="secondary" icon={phase === 'recording' ? '■' : '🎙'}
          label={title(phase === 'recording' ? 'learn.oral.stop' : 'lang.record')}
          disabled={phase === 'starting' || phase === 'stopping' || phase === 'uploading'}
          loading={phase === 'starting' || phase === 'stopping'} onPress={() => phase === 'recording' ? void stop() : void start()} />
        {recording ? <Button testID="phonetic-submit" label={title('lesson.submit')} loading={phase === 'uploading'} disabled={locked} onPress={() => void submit()} /> : null}
        {phase === 'recording' || recording ? <Button variant="ghost" label={title('tutor.cancel')} disabled={phase === 'uploading'} onPress={() => { releaseRecording(); setErrorKey(null); }} /> : null}
      </View>
    </>}
    {phase === 'uploading' ? <Text accessibilityLiveRegion="polite" style={[typography.bodySmall, { color: c.textSecondary }]}>{title('state.processing')}</Text> : null}
    {failure ? <Alert tone="warning" title={title(failure)} /> : null}
    {historyFailed ? <><Alert tone="warning" title={title('phonetic.requestFailed')} /><Button variant="ghost" label={title('rlle.ui.common.retry')} disabled={locked} onPress={() => void load()} /></> : null}
    {latest ? <View testID="phonetic-result" style={{ gap: spacing.sm }}>
      <Text style={[typography.label, { color: c.textPrimary }]}>{title('phonetic.latest')}</Text>
      {latest.state === 'processing' ? <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{title('state.processing')}</Text> : null}
      <Text style={[typography.bodySmall, { color: c.textSecondary }]}>{title('phonetic.unverified')}</Text>
      {latest.result && latest.result.supportLanguageCode === supportLanguageCode ? latest.result.feedback?.filter((item) => item.message).map((item, index) =>
        <Text key={`${item.kind}:${index}`} style={[typography.bodySmall, { color: c.textSecondary }]}>{item.message}</Text>) : null}
      {latest.result?.words.length ? <View testID="phonetic-word-observations" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs }}>
        {latest.result.words.map((word) => <Badge key={`${word.index}:${word.word}`} label={word.word} tone="neutral" />)}
      </View> : null}
      {latest.comparison ? <Text testID="phonetic-attempt-comparison" style={[typography.bodySmall, { color: c.textSecondary }]}>{title(phoneticComparisonKey(latest.comparison.status))}</Text> : null}
      {latest.retryTargets?.map((target) => <Button key={target.wordIndex} variant="secondary" testID={`phonetic-retry-word-${target.wordIndex}`}
        label={title('phonetic.retryWord', { word: target.word })} disabled={locked}
        onPress={() => { releaseRecording(); setRetry({ parentAttemptId: latest.id, targetWordIndex: target.wordIndex, word: target.word }); setErrorKey(null); }} />)}
    </View> : null}
    {retry ? <Button testID="phonetic-full-phrase" variant="ghost" label={title('phonetic.fullPhrase')} disabled={locked}
      onPress={() => { releaseRecording(); setRetry(null); setErrorKey(null); }} /> : null}
    <Text style={[typography.caption, { color: c.textMuted }]}>{title('phonetic.noRetention')}</Text>
  </Card>;
}
