import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { catchError, tap, throwError } from 'rxjs';
import type { Observable } from 'rxjs';
import { MetricsService } from './metrics.service';

/**
 * HTTP metrics (Sprint 10.4). Times every request and records its status +
 * latency into the registry — success and error paths alike — so the dashboard
 * and Prometheus see real traffic. Errors are also handed to `captureError`
 * (the Sentry/OTel seam). Never alters the response.
 */
@Injectable()
export class MonitoringInterceptor implements NestInterceptor {
  constructor(private readonly metrics: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const start = Date.now();
    const res = context.switchToHttp().getResponse<{ statusCode?: number }>();

    return next.handle().pipe(
      tap(() => this.metrics.recordHttp(res.statusCode ?? 200, Date.now() - start)),
      catchError((err: unknown) => {
        const status = (err as { status?: number })?.status ?? 500;
        this.metrics.recordHttp(status, Date.now() - start);
        if (status >= 500) this.metrics.captureError(err, 'http');
        return throwError(() => err);
      }),
    );
  }
}
