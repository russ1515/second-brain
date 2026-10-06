import { Logger, Module, type Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BrainModule } from '../brain/brain.module';
import { DocumentModule } from '../documents/document.module';
import { UsageModule } from '../usage/usage.module';
import { DisabledResearchProvider } from './providers/disabled-research.provider';
import { OpenAIWebResearchProvider } from './providers/openai-web-research.provider';
import { EXTERNAL_RESEARCH_PROVIDER, RESEARCH_PROVIDER, type ResearchProvider } from './research-provider.interface';
import { ResearchController } from './research.controller';
import { ResearchService } from './research.service';

const researchStartupLogger = new Logger('ResearchModule');

const webResearchProviderFactory: Provider = {
  provide: RESEARCH_PROVIDER,
  inject: [ConfigService, DisabledResearchProvider],
  useFactory: (config: ConfigService, disabled: DisabledResearchProvider): ResearchProvider => {
    const provider = config.get<string>('research.provider') ?? 'disabled';
    const model = config.get<string>('research.model') ?? '';
    const apiKey = config.get<string>('research.openaiApiKey') ?? '';
    researchStartupLogger.log(
      `Research runtime configuration: RESEARCH_PROVIDER=${provider}; ` +
        `MODEL=${model.trim() || 'MISSING'}; OPENAI_API_KEY=${apiKey.trim() ? 'SET' : 'MISSING'}`,
    );
    if (provider === 'disabled') return disabled;
    if (provider === 'openai') return new OpenAIWebResearchProvider(apiKey, model);
    throw new Error(`Research provider "${provider}" is not wired.`);
  },
};

@Module({
  imports: [DocumentModule, BrainModule, UsageModule],
  controllers: [ResearchController],
  providers: [
    ResearchService,
    DisabledResearchProvider,
    webResearchProviderFactory,
    { provide: EXTERNAL_RESEARCH_PROVIDER, useExisting: DisabledResearchProvider },
  ],
})
export class ResearchModule {}
