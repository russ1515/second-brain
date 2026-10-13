import { useEffect, useState, useMemo, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import {
  pauseSpeaking,
  PLAYBACK_SUPPORTED,
  resumeSpeaking,
  speak,
  stopSpeaking,
} from '../lib/speak';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';
import { useI18n } from '../lib/i18n';
import { FIRST_AUDIO_TARGET_MS } from '../lib/speech-playback';
import { createClientRequestId } from '../lib/request-id';
import { IconButton } from './ds/core';

/**
 * "Read this aloud."
 *
 * The single place the teacher's voice is offered, so every screen behaves the
 * same: tap to hear, tap again to stop, and errors are shown rather than
 * swallowed into a button that silently does nothing.
 */
export function SpeakButton({
  text,
  language,
  label,
  onFirstAudio,
}: {
  text: string;
  language?: string;
  label?: string;
  /** Optional instrumentation hook; reports real playback start, not API completion. */
  onFirstAudio?: (latencyMs: number) => void;
}) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const idleLabel = label ?? t('lesson.readAloud');
  const [state, setState] = useState<
    'idle' | 'loading' | 'playing' | 'paused' | 'ended' | 'error'
  >('idle');
  const [error, setError] = useState<string | null>(null);
  const [slowStart, setSlowStart] = useState(false);
  const startInFlightRef = useRef(false);
  const attemptRef = useRef(0);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSlowTimer = () => {
    if (slowTimerRef.current) clearTimeout(slowTimerRef.current);
    slowTimerRef.current = null;
  };

  // Leaving the screen must not leave a voice talking to an empty room.
  useEffect(() => () => {
    startInFlightRef.current = false;
    attemptRef.current += 1;
    controllerRef.current?.abort();
    clearSlowTimer();
    stopSpeaking();
  }, []);

  if (!PLAYBACK_SUPPORTED) return null;

  const start = async () => {
    if (startInFlightRef.current) return;
    startInFlightRef.current = true;
    const attempt = attemptRef.current + 1;
    attemptRef.current = attempt;
    const requestId = createClientRequestId('tts');
    requestIdRef.current = requestId;
    controllerRef.current?.abort();
    stopSpeaking();
    clearSlowTimer();
    const controller = new AbortController();
    controllerRef.current = controller;
    setError(null);
    setSlowStart(false);
    setState('loading');
    slowTimerRef.current = setTimeout(() => {
      if (attemptRef.current === attempt) setSlowStart(true);
    }, FIRST_AUDIO_TARGET_MS);
    try {
      await speak(text, language, {
        signal: controller.signal,
        requestId,
        onFirstAudio: (latencyMs) => {
          if (attemptRef.current !== attempt || controller.signal.aborted) return;
          clearSlowTimer();
          setSlowStart(false);
          setState('playing');
          onFirstAudio?.(latencyMs);
        },
      }); // resolves when playback actually ends
      if (attemptRef.current === attempt && !controller.signal.aborted) {
        setState('ended');
      }
    } catch (e) {
      if (attemptRef.current === attempt && !controller.signal.aborted) {
        const message = (e as Error).message;
        setError(
          message === 'TTS_TEXT_REQUIRED' || message === 'TTS_TEXT_TOO_LONG'
            ? t('error.validation')
            : message,
        );
        setState('error');
      }
    } finally {
      if (attemptRef.current === attempt) {
        startInFlightRef.current = false;
        clearSlowTimer();
        controllerRef.current = null;
        requestIdRef.current = null;
        setSlowStart(false);
      }
    }
  };

  const pause = async () => {
    if (await pauseSpeaking()) setState('paused');
  };

  const resume = async () => {
    try {
      if (await resumeSpeaking()) setState('playing');
    } catch (cause) {
      setError((cause as Error).message);
      stopSpeaking();
      setState('error');
    }
  };

  const stop = () => {
    startInFlightRef.current = false;
    attemptRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    requestIdRef.current = null;
    clearSlowTimer();
    stopSpeaking();
    setSlowStart(false);
    setState('idle');
  };

  return (
    <>
      <View style={styles.controls}>
        {state === 'idle' || state === 'loading' || state === 'ended' || state === 'error' ? (
          state === 'loading' ? (
            <>
              <View accessibilityLabel={t('state.loading')} accessibilityRole="progressbar" style={styles.loading}>
                <ActivityIndicator size="small" color={c.warning} />
                {slowStart ? <Text style={styles.status}>{t('state.loading')}</Text> : null}
              </View>
              <IconButton icon="⏹" label={t('learn.oral.stop')} onPress={stop} />
            </>
          ) : (
            <IconButton
              icon={error ? '↻' : '🔊'}
              label={error ? t('app.tryAgain') : idleLabel}
              onPress={() => void start()}
            />
          )
        ) : (
          <>
            <IconButton
              icon={state === 'paused' ? '▶' : '⏸'}
              label={t(state === 'paused' ? 'voice11.resume' : 'voice11.pause')}
              onPress={state === 'paused' ? () => void resume() : () => void pause()}
            />
            <IconButton icon="⏹" label={t('learn.oral.stop')} onPress={stop} />
          </>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  controls: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, alignItems: 'center' },
  loading: {
    minHeight: 44,
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  status: { color: c.textMuted, fontSize: 12 },
  error: { color: c.error, fontSize: 12, marginTop: 6 },
});
