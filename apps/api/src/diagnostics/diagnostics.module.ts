import { Module } from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { AdminModule } from '../admin/admin.module';
import { SafeTelemetryModule } from './safe-telemetry.module';
import { BugCenterService } from './bug-center.service';
import { DiagnosticService } from './diagnostic.service';
import { DiagnosticsController, IncidentControlController, SupportCenterController } from './diagnostics.controller';
import { TelemetryController } from './telemetry.controller';
import { TelemetryExceptionFilter } from './telemetry-exception.filter';

@Module({
  imports: [AdminModule, SafeTelemetryModule],
  controllers: [TelemetryController, DiagnosticsController, SupportCenterController, IncidentControlController],
  providers: [
    DiagnosticService,
    BugCenterService,
    { provide: APP_FILTER, useClass: TelemetryExceptionFilter },
  ],
  exports: [BugCenterService, DiagnosticService],
})
export class DiagnosticsModule {}
