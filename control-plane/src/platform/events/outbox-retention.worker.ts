import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OutboxRetention } from '@platform/events/outbox-retention';
import { Leadership } from '@platform/redis/leadership';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 10 * 60_000;

@Injectable()
export class OutboxRetentionWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly retention: OutboxRetention,
    private readonly leadership: Leadership,
    @Inject(LOGGER) private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await this.#ticking;
  }

  @Interval(EVERY_MS)
  async tick(): Promise<void> {
    if (this.#ticking || this.#stopped || !this.leadership.held()) {
      return;
    }

    this.#ticking = this.retention
      .sweep()
      .then((deleted) => {
        if (deleted > 0) {
          this.logger.info({ deleted }, 'Deleted delivered events');
        }
      })
      .catch((error: unknown) => {
        this.logger.error({ err: error }, 'Deleting delivered events');
      });
    await this.#ticking;
    this.#ticking = null;
  }
}
