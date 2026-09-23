import type { Recorder, Recording } from './recorder';
import { tr } from './i18n';

export type { Recorder, Recording };

/**
 * Web microphone recording via MediaRecorder.
 *
 * The API's speech provider takes the audio as inline data and Gemini accepts
 * webm/opus, so we hand over whatever MediaRecorder gives us rather than
 * transcoding in the browser.
 */
export const RECORDING_SUPPORTED =
  typeof navigator !== 'undefined' &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== 'undefined';

/** First container the browser will actually give us. Chrome/Edge do webm; Safari does mp4. */
function pickMimeType(): string {
  const candidates = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
    'audio/ogg;codecs=opus',
  ];
  for (const type of candidates) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function createRecorder(): Recorder {
  let recorder: MediaRecorder | null = null;
  let stream: MediaStream | null = null;
  let chunks: BlobPart[] = [];
  let startedAt = 0;
  let pausedAt = 0;
  let pausedMs = 0;

  const release = () => {
    stream?.getTracks().forEach((t) => t.stop()); // drop the mic indicator
    stream = null;
    recorder = null;
    chunks = [];
    pausedAt = 0;
    pausedMs = 0;
  };

  return {
    async start() {
      if (!RECORDING_SUPPORTED) {
        throw new Error(tr('voice.error.recordUnsupported'));
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        // The browser's own error text is unreadable ("Permission denied");
        // say what the learner actually has to do.
        throw new Error(tr('voice.error.micDenied'));
      }
      const mimeType = pickMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      startedAt = Date.now();
      pausedAt = 0;
      pausedMs = 0;
      recorder.start();
    },

    async pause() {
      if (!recorder || recorder.state === 'inactive') {
        throw new Error(tr('voice.error.notRecording'));
      }
      if (recorder.state === 'paused') return;
      recorder.pause();
      pausedAt = Date.now();
    },

    async resume() {
      if (!recorder || recorder.state === 'inactive') {
        throw new Error(tr('voice.error.notRecording'));
      }
      if (recorder.state !== 'paused') return;
      pausedMs += Date.now() - pausedAt;
      pausedAt = 0;
      recorder.resume();
    },

    stop() {
      return new Promise<Recording>((resolve, reject) => {
        if (!recorder) {
          reject(new Error(tr('voice.error.notRecording')));
          return;
        }
        const active = recorder;
        active.onstop = () => {
          const mimeType = active.mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type: mimeType });
          const pendingPause = pausedAt ? Date.now() - pausedAt : 0;
          const durationMs = Math.max(0, Date.now() - startedAt - pausedMs - pendingPause);
          release();
          if (blob.size === 0) {
            reject(new Error(tr('voice.error.empty')));
            return;
          }
          resolve({ blob, mimeType, durationMs });
        };
        active.stop();
      });
    },

    cancel() {
      try {
        recorder?.stop();
      } catch {
        // already stopped
      }
      release();
    },
  };
}
