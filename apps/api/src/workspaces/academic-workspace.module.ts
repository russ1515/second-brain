import { Module } from '@nestjs/common';
import { AcademicWorkspaceController } from './academic-workspace.controller';
import { AcademicWorkspaceService } from './academic-workspace.service';

@Module({
  controllers: [AcademicWorkspaceController],
  providers: [AcademicWorkspaceService],
})
export class AcademicWorkspaceModule {}
