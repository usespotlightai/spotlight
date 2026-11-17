import { Inject, Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import {
  LIVE_NOTICE_LOG,
  type LiveNoticeLogPort,
} from '@platform/live/live-notice-log.port';
import { Leadership } from '@platform/redis/leadership';
import {
  CLOCK,
  type ClockPort,
} from '@shared-kernel/application/ports/clock.port';
import {
  LOGGER,
  type LoggerPort,
} from '@shared-kernel/application/ports/logger.port';

const LIVE_NOTICE_RETENTION_MS = 24 * 60 * 60_000;
const EVERY_MS = 10 * 60_000;
const BATCH = 1_000;
const BATCHES = 50;

@Injectable()
export class LiveNoticeRetentionWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    @Inject(LIVE_NOTICE_LOG) private readonly log: LiveNoticeLogPort,
    private readonly leadership: Leadership,
    @Inject(CLOCK) private readonly clock: ClockPort,
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

    this.#ticking = this.sweep()
      .then((deleted) => {
        if (deleted > 0) {
          this.logger.info({ deleted }, 'Deleted old live notices');
        }
      })
      .catch((error: unknown) => {
        this.logger.error({ err: error }, 'Deleting old live notices');
      });
    await this.#ticking;
    this.#ticking = null;
  }

  async sweep(): Promise<number> {
    const before = new Date(
      this.clock.now().getTime() - LIVE_NOTICE_RETENTION_MS,
    );
    let deleted = 0;

    for (let batch = 0; batch < BATCHES; batch += 1) {
      const removed = await this.log.prune(before, BATCH);
      deleted += removed;

      if (removed < BATCH) {
        break;
      }
    }

    return deleted;
  }
}
