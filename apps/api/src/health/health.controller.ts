import { Controller, Get, Header, HttpCode, HttpStatus } from '@nestjs/common';
import type { HealthReport } from '@second-brain/shared';
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
  @HttpCode(HttpStatus.OK)
  @Header('Cache-Control', 'no-store')
  async check(): Promise<HealthReport> {
    const [postgres, redis, qdrant] = await Promise.all([
      this.prisma.check(),
      this.redis.check(),
      this.qdrant.check(),
    ]);

    const info = { postgres, redis, qdrant };
    const allUp = Object.values(info).every((d) => d.status === 'up');

    return {
      status: allUp ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      info,
    };
  }
}
