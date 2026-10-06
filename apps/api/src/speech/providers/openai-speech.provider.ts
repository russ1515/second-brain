import { Blob } from 'node:buffer';
import { FormData } from 'undici';
import { Logger } from '@nestjs/common';
import { speechLanguageTag } from '@second-brain/shared';
import type { SynthesisResult, TranscriptionResult } from '@second-brain/shared';
import type {
  SpeechProvider,
  SynthesizeOptions,
  TranscribeOptions,
} from '../speech-provider.interface';

interface OpenAISpeechResponse {
  ok: boolean;
  status: number;
  headers?: { get(name: string): string | null };
  json(): Promise<unknown>;
  arrayBuffer(): Promise<ArrayBuffer>;
}

export type OpenAISpeechFetch = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string | FormData;
  },
) => Promise<OpenAISpeechResponse>;

/** OpenAI implementation of the existing SpeechProvider seam.
 *
 * It deliberately keeps speech behind the API: credentials never cross into
 * Expo/the browser. STT and TTS use their dedicated Audio API endpoints while
 * the resulting transcript still travels through the one Tutor/ITE/LLM path.
 */
export class OpenAISpeechProvider implements SpeechProvider {
  readonly name = 'openai' as const;

  private readonly logger = new Logger(OpenAISpeechProvider.name);
  private readonly fetcher: OpenAISpeechFetch;

  constructor(
    private readonly apiKey: string,
    private readonly sttModel: string,
    private readonly ttsModel: string,
    private readonly voice: string,
    fetcher?: OpenAISpeechFetch,
  ) {
    if (!apiKey) {
      this.logger.warn('OPENAI_API_KEY is not set; OpenAI speech calls will fail until it is.');
    }
    this.fetcher = fetcher ?? (globalThis.fetch as unknown as OpenAISpeechFetch);
  }

  async transcribe(
    audio: Buffer,
    options: TranscribeOptions,
  ): Promise<TranscriptionResult> {
    this.assertConfigured(this.sttModel, 'OPENAI_SPEECH_STT_MODEL_MISSING');
    const form = new FormData();
    const mimeType = options.mimeType || 'application/octet-stream';
    form.append(
      'file',
      new Blob([new Uint8Array(audio)], { type: mimeType }),
      `recording.${extensionFor(mimeType)}`,
    );
    form.append('model', this.sttModel);
    form.append('response_format', 'json');
    const language = speechLanguageTag(options.language);
    if (language) form.append('language', language);

    const response = await this.request('https://api.openai.com/v1/audio/transcriptions', form);
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new OpenAISpeechError('OPENAI_SPEECH_INVALID_JSON', 502);
    }
    const parsed = asRecord(payload);
    const text = typeof parsed?.text === 'string' ? parsed.text.trim() : '';
    if (!text) throw new OpenAISpeechError('OPENAI_SPEECH_TRANSCRIPT_MISSING', 502);
    const usage = asRecord(parsed?.usage);
    const seconds = nonNegativeNumber(usage?.seconds);
    return {
      text,
      language: language ?? null,
      provider: this.name,
      model: this.sttModel,
      providerRequestId: response.headers?.get('x-request-id') ?? null,
      ...(seconds === undefined ? {} : { audioSeconds: Math.ceil(seconds) }),
    };
  }

  async synthesize(
    text: string,
    _options?: SynthesizeOptions,
  ): Promise<SynthesisResult> {
    this.assertConfigured(this.ttsModel, 'OPENAI_SPEECH_TTS_MODEL_MISSING');
    if (!this.voice.trim()) throw new OpenAISpeechError('OPENAI_SPEECH_VOICE_MISSING', 400);
    const response = await this.request(
      'https://api.openai.com/v1/audio/speech',
      JSON.stringify({
        model: this.ttsModel,
        voice: this.voice,
        input: text,
        response_format: 'wav',
      }),
      { 'Content-Type': 'application/json' },
    );
    let bytes: ArrayBuffer;
    try {
      bytes = await response.arrayBuffer();
    } catch {
      throw new OpenAISpeechError('OPENAI_SPEECH_AUDIO_INVALID', 502);
    }
    if (bytes.byteLength === 0) {
      throw new OpenAISpeechError('OPENAI_SPEECH_AUDIO_MISSING', 502);
    }
    return {
      audioBase64: Buffer.from(bytes).toString('base64'),
      mimeType: 'audio/wav',
      provider: this.name,
      model: this.ttsModel,
      providerRequestId: response.headers?.get('x-request-id') ?? null,
    };
  }

  private assertConfigured(model: string, code: string): void {
    if (!this.apiKey) throw new OpenAISpeechError('OPENAI_CREDENTIAL_MISSING', 401);
    if (!model.trim()) throw new OpenAISpeechError(code, 400);
  }

  private async request(
    url: string,
    body: string | FormData,
    extraHeaders: Record<string, string> = {},
  ): Promise<OpenAISpeechResponse> {
    let response: OpenAISpeechResponse;
    try {
      response = await this.fetcher(url, {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.apiKey}`, ...extraHeaders },
        body,
      });
    } catch {
      throw new OpenAISpeechError('OPENAI_SPEECH_NETWORK_ERROR', 503);
    }
    if (!response.ok) {
      // Provider error bodies can echo user content. Never parse or log them.
      throw new OpenAISpeechError(`OPENAI_SPEECH_HTTP_${response.status}`, response.status);
    }
    return response;
  }
}

/** Stable, secret-free error consumed by SpeechService's retry policy. */
export class OpenAISpeechError extends Error {
  readonly code: string;

  constructor(code: string, readonly status: number) {
    super(code);
    this.name = 'OpenAISpeechError';
    this.code = code;
  }
}

function extensionFor(mimeType: string): string {
  if (/wav/i.test(mimeType)) return 'wav';
  if (/mpeg|mp3/i.test(mimeType)) return 'mp3';
  if (/mp4|m4a/i.test(mimeType)) return 'm4a';
  if (/ogg/i.test(mimeType)) return 'ogg';
  return 'webm';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function nonNegativeNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? value
    : undefined;
}
