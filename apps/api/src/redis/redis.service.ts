import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: Redis;
  private shuttingDown = false;

  constructor(private readonly config: ConfigService) {
    this.client = new Redis({
      host: this.config.getOrThrow<string>('redis.host'),
      port: this.config.getOrThrow<number>('redis.port'),
      lazyConnect: true,
      maxRetriesPerRequest: 2,
      enableReadyCheck: true,
      retryStrategy: (attempt) => Math.min(250 * 2 ** (attempt - 1), 5_000),
      reconnectOnError: (error) =>
        /READONLY|ECONNRESET|ETIMEDOUT|socket closed/i.test(error.message) ? 2 : false,
    });

    this.client.on('ready', () => this.logger.log('Connected to Redis'));
    this.client.on('reconnecting', (delay: number) => {
      if (!this.shuttingDown) {
        this.logger.warn(`Redis connection lost; reconnecting in ${delay}ms.`);
      }
    });
    // An error listener is required by EventEmitter and prevents a transient
    // socket failure from becoming an uncaught process-level error.
    this.client.on('error', (error) => {
      if (!this.shuttingDown) {
        // Redis errors can include a connection URL. Do not log raw details.
        void error;
        this.logger.warn('Redis connection error');
      }
    });
  }

  /** Raw ioredis client for feature modules that need it. */
  get connection(): Redis {
    return this.client;
  }

  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  async onModuleDestroy(): Promise<void> {
    this.shuttingDown = true;
    this.client.disconnect();
  }

  async ping(): Promise<string> {
    return this.client.ping();
  }
}
