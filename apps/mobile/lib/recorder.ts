import { Audio } from 'expo-av';
import { tr } from './i18n';

/** Native microphone recording seam (Expo SDK 52 / expo-av). */
export interface Recording {
  /** Raw audio, ready to upload as multipart. */
  blob: Blob;
  mimeType: string;
  /** Recorded length in ms, when the platform reports it. */
  durationMs?: number;
}

export interface Recorder {
  start(): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  stop(): Promise<Recording>;
  cancel(): void;
}

export const RECORDING_SUPPORTED = true;

export function createRecorder(): Recorder {
  let recording: Audio.Recording | null = null;
  let startedAt = 0;
  let pausedAt = 0;
  let pausedMs = 0;

  const restorePlaybackMode = () =>
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
    }).catch(() => undefined);

  return {
    async start() {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) throw new Error(tr('voice.error.micDenied'));
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      const created = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
      );
      recording = created.recording;
      startedAt = Date.now();
      pausedAt = 0;
      pausedMs = 0;
    },

    async pause() {
      if (!recording) throw new Error(tr('voice.error.notRecording'));
      if (pausedAt) return;
      await recording.pauseAsync();
      pausedAt = Date.now();
    },

    async resume() {
      if (!recording) throw new Error(tr('voice.error.notRecording'));
      if (!pausedAt) return;
      pausedMs += Date.now() - pausedAt;
      pausedAt = 0;
      await recording.startAsync();
    },

    async stop() {
      const active = recording;
      if (!active) throw new Error(tr('voice.error.notRecording'));
      recording = null;
      await active.stopAndUnloadAsync();
      await restorePlaybackMode();
      const uri = active.getURI();
      if (!uri) throw new Error(tr('voice.error.empty'));
      const response = await fetch(uri);
      const blob = await response.blob();
      if (blob.size === 0) throw new Error(tr('voice.error.empty'));
      const extension = uri.split('?')[0].split('.').pop()?.toLowerCase();
      const mimeType = extension === 'wav' ? 'audio/wav' : 'audio/mp4';
      const pendingPause = pausedAt ? Date.now() - pausedAt : 0;
      return { blob, mimeType, durationMs: Math.max(0, Date.now() - startedAt - pausedMs - pendingPause) };
    },

    cancel() {
      const active = recording;
      recording = null;
      pausedAt = 0;
      pausedMs = 0;
      if (active) void active.stopAndUnloadAsync().catch(() => undefined);
      void restorePlaybackMode();
    },
  };
}
