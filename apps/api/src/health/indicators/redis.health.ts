import { Injectable } from '@nestjs/common';
import type { HealthState } from '@second-brain/shared';
import { RedisService } from '../../redis/redis.service';

@Injectable()
export class RedisHealthIndicator {
  constructor(private readonly redis: RedisService) {}

  async check(): Promise<{ status: HealthState; message?: string }> {
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG'
        ? { status: 'up' }
        : { status: 'down', message: `Unexpected PING reply: ${pong}` };
    } catch (error) {
      return { status: 'down', message: (error as Error).message };
    }
  }
}
