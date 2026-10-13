import { synthesize } from './speech-api';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { tr } from './i18n';
import type { SynthesisResult } from '@second-brain/shared';
import {
  createNarrationPauseGate,
  playNarrationSegments,
  type NarrationPauseGate,
} from './speech-playback';

export { synthesize };

export const PLAYBACK_SUPPORTED = true;

type ActivePlayback = {
  sound: Audio.Sound;
  path: string;
  finish: (error?: Error) => void;
};

let current: ActivePlayback | null = null;
let activeNarration: {
  controller: AbortController;
  pauseGate: NarrationPauseGate;
} | null = null;

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
  stopSpeaking();
  const controller = new AbortController();
  const pauseGate = createNarrationPauseGate();
  const narration = { controller, pauseGate };
  activeNarration = narration;
  const cancel = () => controller.abort();
  lifecycle.signal?.addEventListener('abort', cancel, { once: true });
  if (lifecycle.signal?.aborted) controller.abort();

  const startedAt = Date.now();
  let firstAudioReported = false;
  const onFirstAudio = () => {
    if (firstAudioReported || controller.signal.aborted) return;
    firstAudioReported = true;
    lifecycle.onFirstAudio?.(Date.now() - startedAt);
  };

  try {
    await playNarrationSegments(text, {
      signal: controller.signal,
      requestId: lifecycle.requestId,
      onFirstAudio,
      waitUntilPlayable: pauseGate.wait,
      synthesize: (segment, signal, requestId) => synthesize(
        segment,
        language,
        signal,
        requestId,
      ),
      play: playSynthesisSegment,
    });
  } catch (error) {
    // Account changes and explicit Stop are expected cancellation paths. Do
    // not surface their AbortError as a failure belonging to the next learner.
    if (!controller.signal.aborted) throw error;
  } finally {
    lifecycle.signal?.removeEventListener('abort', cancel);
    if (activeNarration === narration) activeNarration = null;
  }
}

/** Play audio returned by a voice turn without paying for a duplicate TTS. */
export async function playSynthesis(result: SynthesisResult): Promise<void> {
  stopSpeaking();
  const controller = new AbortController();
  const pauseGate = createNarrationPauseGate();
  const narration = { controller, pauseGate };
  activeNarration = narration;
  try {
    await pauseGate.wait(controller.signal);
    if (!controller.signal.aborted) {
      await playSynthesisSegment(result, undefined, controller.signal);
    }
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
  activeNarration?.controller.abort();
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
  const narration = activeNarration;
  if (!narration) return false;
  const newlyPaused = narration.pauseGate.pause();
  const active = current;
  if (!active) return newlyPaused;
  try {
    const status = await active.sound.getStatusAsync();
    if (activeNarration !== narration) return false;
    // The lead may finish while the native status request is in flight. The
    // narration gate already owns the learner's pause intent, so keep it and
    // let the next segment wait rather than reporting a failed pause.
    if (current !== active) return true;
    if (status.isLoaded && status.isPlaying) await active.sound.pauseAsync();
    return newlyPaused || (status.isLoaded && !status.isPlaying);
  } catch (error) {
    narration.pauseGate.resume();
    throw error;
  }
}

export async function resumeSpeaking(): Promise<boolean> {
  const narration = activeNarration;
  if (!narration) return false;
  const active = current;
  const narrationWasPaused = narration.pauseGate.paused;
  if (!active) return narration.pauseGate.resume();
  const gateResumed = narration.pauseGate.resume();
  try {
    const status = await active.sound.getStatusAsync();
    if (activeNarration !== narration) return false;
    if (current !== active) return gateResumed || narrationWasPaused;
    if (!narrationWasPaused && (!status.isLoaded || status.isPlaying)) return false;
    if (status.isLoaded && !status.isPlaying) {
      await active.sound.playAsync();
      return true;
    }
    return gateResumed;
  } catch (error) {
    if (activeNarration === narration) narration.pauseGate.pause();
    throw error;
  }
}
