import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Prisma, PrismaClient } from '@prisma/client';

/** Boot-time connect retries. Docker Desktop's Windows port-proxy intermittently
 *  drops the first TCP connect to 5432 even though Postgres is Up+healthy; that
 *  was killing the whole API at boot (PrismaClientInitializationError in
 *  onModuleInit → process exit) rather than costing one request. */
const CONNECT_ATTEMPTS = 5;
const CONNECT_BACKOFF_MS = 1000;

/** Per-query retries for the SAME port-proxy flakiness once the app is up: a
 *  single query occasionally fails with "Can't reach database server" and
 *  succeeds immediately on retry. Bounded and short so a genuinely-down database
 *  still surfaces quickly. Safe because P1001 means the connection was never
 *  established, so the failing query did nothing before we retry it. */
const QUERY_ATTEMPTS = 4;
const QUERY_BACKOFF_MS = 150;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/** True for "can't reach the database server" (the port-proxy blip), not for
 *  ordinary query errors (constraints, bad input). */
function isTransientConnectionError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P1001'
  ) {
    return true;
  }
  if (error instanceof Prisma.PrismaClientInitializationError) {
    return true;
  }
  const message = (error as { message?: string })?.message ?? '';
  return /can't reach database server|connection refused|ECONNREFUSED/i.test(message);
}

/**
 * PrismaClient with two layers of resilience against the Docker port-proxy
 * transient (see the constants above).
 *
 * `$use` middleware was removed in Prisma 6, so per-query retry is a client
 * extension (`$extends` + `$allOperations`). Because an extended client is a
 * distinct object from `this`, the constructor returns a Proxy that routes model
 * access (`user`, `deck`, …) through the retrying extended client while keeping
 * `$`-methods (`$connect`, `$transaction`, …) and the Nest lifecycle on the base
 * instance. Callers still just inject `PrismaService`.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super();

    const extended = this.$extends({
      name: 'retry-transient-connection',
      query: {
        async $allOperations({ args, query }) {
          for (let attempt = 1; ; attempt++) {
            try {
              return await query(args);
            } catch (error) {
              if (
                attempt >= QUERY_ATTEMPTS ||
                !isTransientConnectionError(error)
              ) {
                throw error;
              }
              await sleep(QUERY_BACKOFF_MS * attempt);
            }
          }
        },
      },
    }) as unknown as Record<string, unknown>;

    // Route model delegates through the retrying client; keep engine methods
    // and lifecycle bound to the real instance.
    return new Proxy(this, {
      get(target, prop, receiver) {
        if (
          typeof prop === 'string' &&
          !prop.startsWith('$') &&
          !prop.startsWith('_') &&
          prop !== 'onModuleInit' &&
          prop !== 'onModuleDestroy' &&
          prop !== 'logger' &&
          extended[prop] !== undefined
        ) {
          return extended[prop];
        }
        const value = Reflect.get(target, prop, receiver);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
  }

  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
    this.logger.log('Connected to PostgreSQL');
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Connect, retrying a transient refusal with linear backoff.
   *
   * A genuinely-down database still fails the boot — after the attempts are
   * spent, the original error is rethrown untouched.
   */
  private async connectWithRetry(): Promise<void> {
    for (let attempt = 1; ; attempt++) {
      try {
        await this.$connect();
        return;
      } catch (error) {
        if (attempt >= CONNECT_ATTEMPTS) {
          this.logger.error(
            `Could not reach PostgreSQL after ${CONNECT_ATTEMPTS} attempts.`,
          );
          throw error;
        }
        const wait = CONNECT_BACKOFF_MS * attempt;
        this.logger.warn(
          `PostgreSQL not reachable (attempt ${attempt}/${CONNECT_ATTEMPTS}); retrying in ${wait}ms — ${
            (error as Error).message.split('\n')[0]
          }`,
        );
        await sleep(wait);
      }
    }
  }
}
