import 'reflect-metadata';
// Must run before AppModule (and thus QdrantService) is loaded. See fetch-compat.ts.
import './fetch-compat';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { randomUUID } from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { RequestContextService } from './common/request-context.service';

async function bootstrap(): Promise<void> {
  // `rawBody: true` keeps the untouched request body available (req.rawBody) so
  // payment-webhook signatures can be verified byte-exact (Sprint 8.2).
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });

  // Security & hardening
  app.use(helmet());
  const config = app.get(ConfigService);
  const configuredOrigins = config.get<string[]>('api.corsOrigins', []);
  const nodeEnv = config.get<string>('nodeEnv', 'development');
  app.enableCors({
    credentials: true,
    origin(origin, callback) {
      // Native Expo requests have no browser Origin header. Localhost is allowed
      // only outside production; every deployed browser origin is explicit.
      const localDevelopment = nodeEnv !== 'production' && !!origin && /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin);
      if (!origin || configuredOrigins.includes(origin) || localDevelopment) callback(null, true);
      else callback(new Error('Origin is not allowed by CORS policy.'));
    },
    allowedHeaders: ['Authorization', 'Content-Type', 'Idempotency-Key', 'X-Request-Id'],
    exposedHeaders: ['X-Request-Id'],
  });
  const requestContext = app.get(RequestContextService);
  app.use((req: Request, res: Response, next: NextFunction) => {
    const incoming = req.header('x-request-id');
    const requestId = incoming && /^[A-Za-z0-9._:-]{8,128}$/.test(incoming) ? incoming : randomUUID();
    req.headers['x-request-id'] = requestId;
    res.setHeader('x-request-id', requestId);
    requestContext.run(requestId, next);
  });
  app.enableShutdownHooks();

  // Global input validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.setGlobalPrefix('api');

  const port = config.getOrThrow<number>('api.port');

  await app.listen(port);
  Logger.log(`Second Brain API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
