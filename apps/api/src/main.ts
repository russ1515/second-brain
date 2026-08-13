import 'reflect-metadata';
// Must run before AppModule (and thus QdrantService) is loaded. See fetch-compat.ts.
import './fetch-compat';
import { Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // `rawBody: true` keeps the untouched request body available (req.rawBody) so
  // payment-webhook signatures can be verified byte-exact (Sprint 8.2).
  const app = await NestFactory.create(AppModule, {
    bufferLogs: false,
    rawBody: true,
  });

  // Security & hardening
  app.use(helmet());
  app.enableCors();
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

  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('api.port');

  await app.listen(port);
  Logger.log(`Second Brain API listening on http://localhost:${port}/api`, 'Bootstrap');
}

void bootstrap();
