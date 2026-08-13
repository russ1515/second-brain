/** Gemini TTS returns headerless L16 PCM (e.g. `audio/L16;codec=pcm;rate=24000`),
 *  which no client can play as-is. These helpers wrap it into a RIFF/WAVE
 *  container so the API hands back an actually playable file. */

const WAV_HEADER_BYTES = 44;
const BITS_PER_SAMPLE = 16;

export interface PcmFormat {
  sampleRate: number;
  channels: number;
}

/** Read sample rate / channel count out of an L16 content type. Gemini has
 *  spelled this several ways (`audio/L16;codec=pcm;rate=24000` and
 *  `audio/l16; rate=24000; channels=1`), so parse defensively. */
export function parsePcmFormat(mimeType: string): PcmFormat {
  const rate = /rate=(\d+)/i.exec(mimeType);
  const channels = /channels=(\d+)/i.exec(mimeType);
  return {
    sampleRate: rate ? parseInt(rate[1], 10) : 24_000,
    channels: channels ? parseInt(channels[1], 10) : 1,
  };
}

/** True when the payload is raw PCM needing a container (vs. an already-framed
 *  format like WAV/MP3/OGG that we should pass through untouched). */
export function isRawPcm(mimeType: string): boolean {
  return /audio\/l16|codec=pcm/i.test(mimeType);
}

/** Prepend a RIFF/WAVE header to raw little-endian 16-bit PCM. */
export function pcmToWav(pcm: Buffer, format: PcmFormat): Buffer {
  const { sampleRate, channels } = format;
  const byteRate = (sampleRate * channels * BITS_PER_SAMPLE) / 8;
  const blockAlign = (channels * BITS_PER_SAMPLE) / 8;

  const header = Buffer.alloc(WAV_HEADER_BYTES);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4); // chunk size = header tail + data
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16); // PCM fmt chunk size
  header.writeUInt16LE(1, 20); // audio format 1 = PCM
  header.writeUInt16LE(channels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(BITS_PER_SAMPLE, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);

  return Buffer.concat([header, pcm]);
}
