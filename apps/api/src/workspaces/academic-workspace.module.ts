import { Module } from '@nestjs/common';
import { BrainModule } from '../brain/brain.module';
import { DocumentModule } from '../documents/document.module';
import { ResearchModule } from '../research/research.module';
import { OnboardingModule } from '../onboarding/onboarding.module';
import { AcademicWorkspaceController } from './academic-workspace.controller';
import { AcademicWorkspaceService } from './academic-workspace.service';
import { WorkspaceSourceEngineService } from './workspace-source-engine.service';

@Module({
  imports: [DocumentModule, BrainModule, ResearchModule, OnboardingModule],
  controllers: [AcademicWorkspaceController],
  providers: [AcademicWorkspaceService, WorkspaceSourceEngineService],
})
export class AcademicWorkspaceModule {}
