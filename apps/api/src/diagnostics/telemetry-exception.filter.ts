import { ArgumentsHost, Catch, HttpException, Logger } from '@nestjs/common';
import { BaseExceptionFilter, HttpAdapterHost } from '@nestjs/core';
import type { Request, Response } from 'express';
import { ErrorEventService } from './error-event.service';

/**
 * Records server failures without changing Nest's established response contract.
 * It deliberately ignores expected 4xx client input errors and telemetry's own
 * endpoint, so an observability outage can never create an exception loop.
 */
@Catch()
export class TelemetryExceptionFilter extends BaseExceptionFilter {
  private readonly logger = new Logger(TelemetryExceptionFilter.name);

  constructor(
    adapterHost: HttpAdapterHost,
    private readonly events: ErrorEventService,
  ) {
    super(adapterHost.httpAdapter);
  }

  override catch(exception: unknown, host: ArgumentsHost): void {
    if (host.getType() === 'http') {
      const http = host.switchToHttp();
      const request = http.getRequest<Request>();
      const status = exception instanceof HttpException ? exception.getStatus() : 500;
      const route = (request.originalUrl ?? request.url ?? '').split('?')[0];
      if (status >= 500 && !route.startsWith('/api/telemetry')) {
        this.events.captureException(exception, {
          source: 'backend',
          route,
          httpStatus: status,
          feature: this.featureFromRoute(route),
        });
      }
      if (status >= 500) {
        // BaseExceptionFilter logs unknown exception.message/stack. Those may
        // contain provider, database, form or document material, so render a
        // fixed 5xx contract ourselves instead of delegating to it.
        const response = http.getResponse<Response>();
        if (!response.headersSent) {
          const rawRequestId = request.headers['x-request-id'];
          const requestId = Array.isArray(rawRequestId) ? rawRequestId[0] : rawRequestId;
          response.status(status).json({
            statusCode: status,
            code: 'INTERNAL_ERROR',
            message: 'Internal server error.',
            requestId: typeof requestId === 'string' ? requestId : null,
          });
        }
        return;
      }
      super.catch(exception, host);
      return;
    } else {
      // Non-HTTP exceptions lack safe route/request context but still merit a
      // redacted backend event; capture is best-effort and never throws.
      this.events.captureException(exception, { source: 'worker' });
      // This application exposes HTTP only; do not delegate unknown worker
      // exceptions to BaseExceptionFilter because it would log their raw text.
      this.logger.error('Unhandled non-HTTP exception captured');
      return;
    }
  }

  private featureFromRoute(route: string): string | null {
    const segment = route.split('/').filter(Boolean)[1];
    return segment && /^[A-Za-z0-9_-]{1,64}$/.test(segment) ? segment : null;
  }
}
