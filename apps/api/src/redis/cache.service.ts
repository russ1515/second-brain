import { Injectable, Logger } from '@nestjs/common';
import { RedisService } from './redis.service';

/**
 * Redis-backed read cache (Sprint 10.1 — Performance).
 *
 * A get-or-compute wrapper for expensive, staleness-tolerant read paths
 * (heavy aggregations, advisory dashboards). It NEVER breaks a request: any
 * Redis error falls through to a fresh compute. Hit/miss counters are exposed so
 * the monitoring layer (10.4) can report cache effectiveness.
 *
 * Only wrap reads where a few seconds of staleness is acceptable — never a
 * transactional read-after-write. Use short TTLs and `invalidate` on the write
 * paths when correctness needs it.
 */
@Injectable()
export class CacheService {
  private readonly logger = new Logger(CacheService.name);
  private hits = 0;
  private misses = 0;

  constructor(private readonly redis: RedisService) {}

  /** Return the cached value for `key`, or compute + store it for `ttlSeconds`. */
  async wrap<T>(key: string, ttlSeconds: number, compute: () => Promise<T>): Promise<T> {
    try {
      const cached = await this.redis.connection.get(key);
      if (cached !== null) {
        this.hits++;
        return JSON.parse(cached) as T;
      }
    } catch (err) {
      // Cache read failed — treat as a miss, never fail the request.
      this.logger.warn(`cache read failed for ${key}: ${(err as Error).message}`);
    }

    this.misses++;
    const value = await compute();
    try {
      await this.redis.connection.set(key, JSON.stringify(value), 'EX', ttlSeconds);
    } catch (err) {
      this.logger.warn(`cache write failed for ${key}: ${(err as Error).message}`);
    }
    return value;
  }

  /** Drop a single cached key (call on the write path that invalidates it). */
  async invalidate(key: string): Promise<void> {
    try {
      await this.redis.connection.del(key);
    } catch (err) {
      this.logger.warn(`cache invalidate failed for ${key}: ${(err as Error).message}`);
    }
  }

  /** Drop every key under a prefix (e.g. all of a user's cached views). */
  async invalidatePrefix(prefix: string): Promise<void> {
    try {
      const keys = await this.redis.connection.keys(`${prefix}*`);
      if (keys.length) await this.redis.connection.del(...keys);
    } catch (err) {
      this.logger.warn(`cache invalidatePrefix failed for ${prefix}: ${(err as Error).message}`);
    }
  }

  /** Hit/miss stats for the monitoring layer. */
  stats(): { hits: number; misses: number; hitRate: number } {
    const total = this.hits + this.misses;
    return { hits: this.hits, misses: this.misses, hitRate: total ? this.hits / total : 0 };
  }
}
