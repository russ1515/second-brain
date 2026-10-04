import { Controller, Get, Header, HttpStatus, Res } from '@nestjs/common';
import type { HealthReport } from '@second-brain/shared';
import type { Response } from 'express';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { QdrantHealthIndicator } from './indicators/qdrant.health';

@Controller('health')
export class HealthController {
  constructor(
    private readonly prisma: PrismaHealthIndicator,
    private readonly redis: RedisHealthIndicator,
    private readonly qdrant: QdrantHealthIndicator,
  ) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async check(@Res({ passthrough: true }) response: Response): Promise<HealthReport> {
    const [postgres, redis, qdrant] = await Promise.all([
      this.prisma.check(),
      this.redis.check(),
      this.qdrant.check(),
    ]);

    const info = { postgres, redis, qdrant };
    const allUp = Object.values(info).every((d) => d.status === 'up');

    // The deployment health check must fail closed when a required dependency
    // is unavailable. Indicators deliberately redact driver/provider details,
    // so the public JSON body remains safe to expose.
    response.status(allUp ? HttpStatus.OK : HttpStatus.SERVICE_UNAVAILABLE);

    return {
      status: allUp ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      info,
    };
  }
}
