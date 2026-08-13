import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';
import { PrismaHealthIndicator } from './indicators/prisma.health';
import { RedisHealthIndicator } from './indicators/redis.health';
import { QdrantHealthIndicator } from './indicators/qdrant.health';

@Module({
  controllers: [HealthController],
  providers: [
    PrismaHealthIndicator,
    RedisHealthIndicator,
    QdrantHealthIndicator,
  ],
})
export class HealthModule {}
