import { synthesize } from './speech-api';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import { tr } from './i18n';

export { synthesize };

export const PLAYBACK_SUPPORTED = true;

type ActivePlayback = {
  sound: Audio.Sound;
  path: string;
  finish: (error?: Error) => void;
};

let current: ActivePlayback | null = null;

export async function speak(text: string, language?: string): Promise<void> {
  stopSpeaking();
  const result = await synthesize(text, language);
  const directory = FileSystem.cacheDirectory;
  if (!directory) throw new Error(tr('voice.error.playback'));
  const extension = result.mimeType.includes('wav') ? 'wav' : 'mp3';
  const path = `${directory}second-brain-voice-${Date.now()}.${extension}`;
  await FileSystem.writeAsStringAsync(path, result.audioBase64, {
    encoding: FileSystem.EncodingType.Base64,
  });
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
  });
  const { sound } = await Audio.Sound.createAsync({ uri: path });

  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const finish = (error?: Error) => {
      if (settled) return;
      settled = true;
      if (current?.sound === sound) current = null;
      sound.setOnPlaybackStatusUpdate(null);
      void sound.unloadAsync().catch(() => undefined);
      void FileSystem.deleteAsync(path, { idempotent: true }).catch(() => undefined);
      if (error) reject(error);
      else resolve();
    };
    current = { sound, path, finish };
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded) {
        if ('error' in status && status.error) finish(new Error(tr('voice.error.playback')));
        return;
      }
      if (status.didJustFinish) finish();
    });
    void sound.playAsync().catch(() => finish(new Error(tr('voice.error.playback'))));
  });
}

export function stopSpeaking(): void {
  const active = current;
  current = null;
  if (!active) return;
  void active.sound.stopAsync().catch(() => undefined);
  active.finish();
}
