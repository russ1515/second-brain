import { synthesize } from './speech-api';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { tr } from './i18n';
import type { SynthesisResult } from '@second-brain/shared';
import { LIGHT_PREFETCH_MAX, narrationSegments } from './speech-playback';

export { synthesize };

export const PLAYBACK_SUPPORTED = true;

type ActivePlayback = {
  sound: Audio.Sound;
  path: string;
  finish: (error?: Error) => void;
};

let current: ActivePlayback | null = null;
let activeNarration: AbortController | null = null;

export interface SpeakLifecycle {
  signal?: AbortSignal;
  /** Stable for a slow-start retry of the same learner action. */
  requestId?: string;
  /** Measured from the explicit `speak` call until native playback begins. */
  onFirstAudio?: (latencyMs: number) => void;
}

export async function speak(
  text: string,
  language?: string,
  lifecycle: SpeakLifecycle = {},
): Promise<void> {
  const { lead, tail } = narrationSegments(text);
  stopSpeaking();
  const narration = new AbortController();
  activeNarration = narration;
  const cancel = () => narration.abort();
  lifecycle.signal?.addEventListener('abort', cancel, { once: true });
  if (lifecycle.signal?.aborted) narration.abort();

  const startedAt = Date.now();
  const leadRequestId = lifecycle.requestId ? `${lifecycle.requestId}:lead` : undefined;
  const tailRequestId = lifecycle.requestId ? `${lifecycle.requestId}:tail` : undefined;
  let tailRequest: Promise<{ value: SynthesisResult | null; error: unknown }> | null = null;
  let firstAudioReported = false;
  const onFirstAudio = () => {
    if (firstAudioReported || narration.signal.aborted) return;
    firstAudioReported = true;
    lifecycle.onFirstAudio?.(Date.now() - startedAt);
  };

  try {
    const first = await synthesize(lead, language, narration.signal, leadRequestId);
    if (narration.signal.aborted) return;
    if (tail && tail.length <= LIGHT_PREFETCH_MAX) {
      tailRequest = synthesize(tail, language, narration.signal, tailRequestId).then(
        (value) => ({ value, error: null }),
        (error) => ({ value: null, error }),
      );
    }
    await playSynthesisSegment(first, onFirstAudio, narration.signal);
    if (!tail || narration.signal.aborted) return;
    const prepared = await (tailRequest ?? synthesize(
      tail,
      language,
      narration.signal,
      tailRequestId,
    ).then(
      (value) => ({ value, error: null }),
      (error) => ({ value: null, error }),
    ));
    if (prepared.error) throw prepared.error;
    const remainder = prepared.value;
    if (!remainder) throw new Error(tr('voice.error.playback'));
    if (narration.signal.aborted) return;
    await playSynthesisSegment(remainder, undefined, narration.signal);
  } catch (error) {
    // Account changes and explicit Stop are expected cancellation paths. Do
    // not surface their AbortError as a failure belonging to the next learner.
    if (!narration.signal.aborted) throw error;
  } finally {
    lifecycle.signal?.removeEventListener('abort', cancel);
    if (activeNarration === narration) activeNarration = null;
  }
}

/** Play audio returned by a voice turn without paying for a duplicate TTS. */
export async function playSynthesis(result: SynthesisResult): Promise<void> {
  stopSpeaking();
  const narration = new AbortController();
  activeNarration = narration;
  try {
    await playSynthesisSegment(result, undefined, narration.signal);
  } finally {
    if (activeNarration === narration) activeNarration = null;
  }
}

async function playSynthesisSegment(
  result: SynthesisResult,
  onPlaybackStart?: () => void,
  signal?: AbortSignal,
): Promise<void> {
  stopPlayback();
  if (signal?.aborted) return;
  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error(tr('voice.error.playback'));
  const extension = result.mimeType.includes('wav') ? 'wav' : 'mp3';
  const path = `${directory}second-brain-voice-${Date.now()}.${extension}`;
  await FileSystem.writeAsStringAsync(path, result.audioBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  if (signal?.aborted) {
    void FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
    return;
  }
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });
  if (signal?.aborted) {
    void FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
    return;
  }
  const { sound } = await Audio.Sound.createAsync({ uri: path });
  if (signal?.aborted) {
    void sound.unloadAsync().catch(() => undefined);
    void FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    let started = false;
    const markStarted = () => {
      if (started) return;
      started = true;
      onPlaybackStart?.();
    };
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (current?.sound === sound) current = null;
      sound.setOnPlaybackStatusUpdate(null);
      signal?.removeEventListener('abort', cancel);
      void sound.unloadAsync().catch(() => undefined);
      void FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
      if (error) reject(error);
      else resolve();
    };
    const cancel = () => {
      void sound.stopAsync().catch(() => undefined);
      finish();
    };
    current = { sound, path, finish };
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        if ('error' in status && status.error) finish(new Error(tr('voice.error.playback')));
        return;
      }
      if (status.isPlaying) markStarted();
      if (status.didJustFinish) finish();
    });
    signal?.addEventListener('abort', cancel, { once: true });
    if (signal?.aborted) {
      cancel();
      return;
    }
    void sound.playAsync()
      .then(markStarted)
      .catch(() => finish(new Error(tr('voice.error.playback'))));
  });
}

export function stopSpeaking(): void {
  activeNarration?.abort();
  activeNarration = null;
  stopPlayback();
}

function stopPlayback(): void {
  const active = current;
  current = null;
  if (!active) return;
  void active.sound.stopAsync().catch(() => undefined);
  active.finish();
}

export async function pauseSpeaking(): Promise<boolean> {
  if (!current) return false;
  const status = await current.sound.getStatusAsync();
  if (!status.isLoaded || !status.isPlaying) return false;
  await current.sound.pauseAsync();
  return true;
}

export async function resumeSpeaking(): Promise<boolean> {
  if (!current) return false;
  const status = await current.sound.getStatusAsync();
  if (!status.isLoaded || status.isPlaying) return false;
  await current.sound.playAsync();
  return true;
}
