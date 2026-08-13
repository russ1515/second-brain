import type { Recorder, Recording } from './recorder';

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

  const release = () => {
    stream?.getTracks().forEach((t) => t.stop()); // drop the mic indicator
    stream = null;
    recorder = null;
    chunks = [];
  };

  return {
    async start() {
      if (!RECORDING_SUPPORTED) {
        throw new Error('This browser cannot record audio.');
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e) {
        // The browser's own error text is unreadable ("Permission denied");
        // say what the learner actually has to do.
        throw new Error(
          'Microphone access was refused. Allow the microphone for this site and try again.',
        );
      }
      const mimeType = pickMimeType();
      recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      chunks = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };
      startedAt = Date.now();
      recorder.start();
    },

    stop() {
      return new Promise<Recording>((resolve, reject) => {
        if (!recorder) {
          reject(new Error('Not recording.'));
          return;
        }
        const active = recorder;
        active.onstop = () => {
          const mimeType = active.mimeType || 'audio/webm';
          const blob = new Blob(chunks, { type: mimeType });
          const durationMs = Date.now() - startedAt;
          release();
          if (blob.size === 0) {
            reject(new Error('Nothing was recorded — check your microphone.'));
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
