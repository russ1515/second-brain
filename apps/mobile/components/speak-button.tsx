import { useEffect, useState, useMemo } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text } from 'react-native';
import { PLAYBACK_SUPPORTED, speak, stopSpeaking } from '../lib/speak';
import { useTokens } from '../lib/design/theme';
import type { ColorScale } from '../lib/design/tokens';

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
  label = 'Listen',
}: {
  text: string;
  language?: string;
  label?: string;
}) {
  const { colors: c } = useTokens();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [state, setState] = useState<'idle' | 'loading' | 'playing'>('idle');
  const [error, setError] = useState<string | null>(null);

  // Leaving the screen must not leave a voice talking to an empty room.
  useEffect(() => () => stopSpeaking(), []);

  if (!PLAYBACK_SUPPORTED) return null;

  const toggle = async () => {
    if (state !== 'idle') {
      stopSpeaking();
      setState('idle');
      return;
    }
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

  return (
    <>
      <Pressable onPress={toggle} accessibilityRole="button" style={styles.button}>
        {state === 'loading' ? (
          <ActivityIndicator size="small" color={c.warning} />
        ) : (
          <Text style={styles.label}>
            {state === 'playing' ? '⏹ Stop' : `🔊 ${label}`}
          </Text>
        )}
      </Pressable>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </>
  );
}

const makeStyles = (c: ColorScale) => StyleSheet.create({
  button: {
    alignSelf: 'flex-start',
    borderWidth: 1,
    borderColor: c.border,
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 12,
    marginTop: 10,
    minHeight: 32,
    justifyContent: 'center',
  },
  label: { color: c.warning, fontSize: 13, fontWeight: '600' },
  error: { color: c.error, fontSize: 12, marginTop: 6 },
});
