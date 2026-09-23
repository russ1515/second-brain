import { Module } from '@nestjs/common';
import { SafeRedactionService } from './safe-redaction.service';
import { ErrorEventService } from './error-event.service';
import { UserReportService } from './user-report.service';

/** Shared safe-telemetry primitives with no dependency on admin workflows. */
@Module({
  providers: [SafeRedactionService, ErrorEventService, UserReportService],
  exports: [SafeRedactionService, ErrorEventService, UserReportService],
})
export class SafeTelemetryModule {}
