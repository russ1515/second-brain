import { BadRequestException, Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { OptionalJwtAccessGuard } from '../auth/guards/optional-jwt-access.guard';
import { RequestContextService } from '../common/request-context.service';
import { CreateClientErrorEventDto } from './dto/diagnostics.dto';
import { ErrorEventService } from './error-event.service';

/** Public-by-design but strictly bounded frontend error ingest. */
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly events: ErrorEventService, private readonly context: RequestContextService) {}

  @Post('errors')
  @UseGuards(OptionalJwtAccessGuard)
  @HttpCode(HttpStatus.ACCEPTED)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  async ingestClientError(@Body() dto: CreateClientErrorEventDto): Promise<{ eventId: string; bugId: string; requestId: string | null }> {
    if (dto.source !== 'frontend') throw new BadRequestException('Only frontend telemetry is accepted on this endpoint.');
    const result = await this.events.ingest({
      source: 'frontend',
      errorCode: dto.errorCode ?? dto.code,
      errorType: dto.errorType ?? dto.type,
      // Browser/mobile telemetry is an untrusted transport. Free-form error
      // text, stacks and arbitrary metadata can contain a document, a form
      // value or a conversation. They are intentionally dropped here; trusted
      // server/provider paths use ErrorEventService directly with redaction.
      message: 'Client telemetry event received.',
      route: dto.route,
      feature: dto.feature,
      appVersion: dto.appVersion ?? dto.version,
      buildVersion: dto.buildVersion,
      platform: dto.platform,
      ingestId: dto.ingestId,
      occurredAt: dto.occurredAt,
      retryAttempt: dto.retryAttempt,
    });
    // IDs are safe opaque references; the endpoint never returns stack/message
    // or caller-supplied metadata.
    return { eventId: result.eventId, bugId: result.bugGroupId, requestId: this.context.current()?.requestId ?? null };
  }
}
