import { Module } from '@nestjs/common';
import { BrainModule } from '../brain/brain.module';
import { DocumentModule } from '../documents/document.module';
import { UsageModule } from '../usage/usage.module';
import { DisabledResearchProvider } from './providers/disabled-research.provider';
import { RESEARCH_PROVIDER } from './research-provider.interface';
import { ResearchController } from './research.controller';
import { ResearchService } from './research.service';

@Module({
  imports: [DocumentModule, BrainModule, UsageModule],
  controllers: [ResearchController],
  providers: [
    ResearchService,
    DisabledResearchProvider,
    { provide: RESEARCH_PROVIDER, useExisting: DisabledResearchProvider },
  ],
})
export class ResearchModule {}
