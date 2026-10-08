import { useEffect, useState, useMemo } from 'react';
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
}: {
  text: string;
  language?: string;
  label?: string;
}) {
  const { colors: c } = useTokens();
  const { t } = useI18n();
  const styles = useMemo(() => makeStyles(c), [c]);
  const idleLabel = label ?? t('lesson.readAloud');
  const [state, setState] = useState<'idle' | 'loading' | 'playing' | 'paused'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Leaving the screen must not leave a voice talking to an empty room.
  useEffect(() => () => stopSpeaking(), []);

  if (!PLAYBACK_SUPPORTED) return null;

  const start = async () => {
    if (state !== 'idle') return;
    setError(null);
    setState('loading');
    try {
      setState('playing');
      await speak(text, language); // resolves when playback actually ends
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setState('idle');
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
      setState('idle');
    }
  };

  const stop = () => {
    stopSpeaking();
    setState('idle');
  };

  return (
    <>
      <View style={styles.controls}>
        {state === 'idle' || state === 'loading' ? (
          state === 'loading' ? (
            <View accessibilityLabel={idleLabel} accessibilityRole="progressbar" style={styles.loading}>
              <ActivityIndicator size="small" color={c.warning} />
            </View>
          ) : (
            <IconButton icon="🔊" label={idleLabel} onPress={() => void start()} />
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
  loading: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  error: { color: c.error, fontSize: 12, marginTop: 6 },
});
