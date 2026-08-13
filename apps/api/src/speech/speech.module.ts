import { Global, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SPEECH_PROVIDER } from './speech.constants';
import type { SpeechProvider } from './speech-provider.interface';
import { GeminiSpeechProvider } from './providers/gemini-speech.provider';
import { FakeSpeechProvider } from './providers/fake-speech.provider';
import { SpeechService } from './speech.service';
import { SpeechController } from './speech.controller';

/**
 * Binds the speech provider selected by SPEECH_PROVIDER. This factory is the
 * ONLY place that knows about concrete providers. `gemini` does real STT+TTS;
 * `fake` is a deterministic dev transport (text payload in, no TTS) for offline
 * work without an API key. To add Whisper/ElevenLabs: implement SpeechProvider
 * and add a case below — no business code changes.
 */
const speechProviderFactory: Provider = {
  provide: SPEECH_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): SpeechProvider => {
    const provider = config.getOrThrow<string>('speech.provider');

    switch (provider) {
      case 'gemini':
        return new GeminiSpeechProvider(
          config.get<string>('speech.geminiApiKey') ?? '',
          config.getOrThrow<string>('speech.sttModel'),
          config.getOrThrow<string>('speech.ttsModel'),
          config.getOrThrow<string>('speech.voice'),
        );
      case 'fake':
        return new FakeSpeechProvider();
      default:
        throw new Error(
          `Speech provider "${provider}" is not wired yet. ` +
            `Implement SpeechProvider and add a case in speech.module.ts.`,
        );
    }
  },
};

@Global()
@Module({
  controllers: [SpeechController],
  providers: [speechProviderFactory, SpeechService],
  exports: [SpeechService],
})
export class SpeechModule {}
