import { Global, Module, Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LLM_PROVIDER } from './llm.constants';
import type { LLMProvider } from './llm-provider.interface';
import { GeminiProvider } from './providers/gemini.provider';
import { EchoProvider } from './providers/echo.provider';
import { AiOrchestratorService } from './ai-orchestrator.service';
import { AiOrchestratorController } from './ai-orchestrator.controller';
import { AdminGuard } from '../admin/admin.guard';
import { LlmService } from './llm.service';

/**
 * Binds the concrete LLM provider selected by LLM_PROVIDER in the environment.
 * This factory is the ONLY place that knows about concrete SDKs. To add OpenAI,
 * Claude or Ollama: implement LLMProvider and add a case below — no business
 * code changes.
 */
const llmProviderFactory: Provider = {
  provide: LLM_PROVIDER,
  inject: [ConfigService],
  useFactory: (config: ConfigService): LLMProvider => {
    const provider = config.getOrThrow<string>('llm.provider');
    const model = config.getOrThrow<string>('llm.model');

    switch (provider) {
      case 'gemini':
        return new GeminiProvider(
          config.get<string>('llm.geminiApiKey') ?? '',
          model,
        );
      default:
        throw new Error(
          `LLM provider "${provider}" is not wired yet. ` +
            `Implement LLMProvider and add a case in llm.module.ts.`,
        );
    }
  },
};

@Global()
@Module({
  controllers: [AiOrchestratorController],
  providers: [llmProviderFactory, EchoProvider, AiOrchestratorService, AdminGuard, LlmService],
  exports: [LlmService, AiOrchestratorService],
})
export class LlmModule {}
