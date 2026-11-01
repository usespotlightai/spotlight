import type { OnApplicationShutdown } from '@nestjs/common';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import IORedis, { type Redis } from 'ioredis';

const COMMAND_TIMEOUT_MS = 2_000;

export interface RedisPubSub {
  readonly client: Redis;
  readonly subscriber: Redis;
}

export class RedisConnection implements OnApplicationShutdown {
  readonly client: Redis | null;
  private readonly subscribers: Redis[] = [];

  constructor(
    url: string | undefined,
    private readonly logger: LoggerPort,
  ) {
    this.client = url
      ? this.watched(new IORedis(url, { commandTimeout: COMMAND_TIMEOUT_MS }))
      : null;
  }

  pubSub(): RedisPubSub | null {
    if (!this.client) {
      return null;
    }

    const subscriber = this.watched(this.client.duplicate());
    this.subscribers.push(subscriber);

    return { client: this.client, subscriber };
  }

  async onApplicationShutdown(): Promise<void> {
    await Promise.allSettled(
      [this.client, ...this.subscribers].map((each) => each?.quit()),
    );
  }

  private watched(connection: Redis): Redis {
    connection.on('error', (error) =>
      this.logger.warn({ err: error }, 'The Redis connection failed'),
    );
    return connection;
  }
}
