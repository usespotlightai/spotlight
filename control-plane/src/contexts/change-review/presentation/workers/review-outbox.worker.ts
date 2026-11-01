import type { ReviewOutboxWorkPort } from '@change-review/application/ports/review-outbox-work.port';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 5_000;

@Injectable()
export class ReviewOutboxWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly work: ReviewOutboxWorkPort,
    private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await this.#ticking;
  }

  @Interval(EVERY_MS)
  async tick(): Promise<void> {
    if (this.#ticking || this.#stopped) {
      return;
    }

    this.#ticking = this.sync();
    await this.#ticking;
    this.#ticking = null;
  }

  private async sync(): Promise<void> {
    try {
      await this.work.syncDue();
    } catch (error) {
      this.logger.error({ err: error }, 'Syncing reviews with GitHub');
    }
  }
}
