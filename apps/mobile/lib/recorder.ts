/**
 * Microphone recording seam.
 *
 * This is the NATIVE implementation slot. Metro picks `recorder.web.ts` for the
 * web build automatically, so this file is what an iOS/Android build would use —
 * and it is not wired yet (it needs expo-av / expo-audio and the mic
 * permission plumbing). It throws a clear message rather than silently
 * returning nothing, so a device build fails loudly instead of pretending to
 * record.
 */
export interface Recording {
  /** Raw audio, ready to upload as multipart. */
  blob: Blob;
  mimeType: string;
  /** Recorded length in ms, when the platform reports it. */
  durationMs?: number;
}

export interface Recorder {
  start(): Promise<void>;
  stop(): Promise<Recording>;
  cancel(): void;
}

export const RECORDING_SUPPORTED = false;

export function createRecorder(): Recorder {
  throw new Error(
    'Voice recording is not wired for this platform yet — it currently runs on the web build only.',
  );
}
