import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis({
      host: this.config.getOrThrow<string>('redis.host'),
      port: this.config.getOrThrow<number>('redis.port'),
      lazyConnect: true,
      maxRetriesPerRequest: 2,
    });
  }

  /** Raw ioredis client for feature modules that need it. */
  get connection(): Redis {
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
    this.logger.log('Connected to Redis');
  }

  async onModuleDestroy(): Promise<void> {
    this.client.disconnect();
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}
