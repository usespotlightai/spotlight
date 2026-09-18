import type { ReviewSyncWorkPort } from '@change-review/application/ports/review-sync-work.port';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export const EVERY_MS = 5_000;

@Injectable()
export class ReviewSyncWorker implements OnModuleDestroy {
  #turning = false;
  #stopped = false;

  constructor(
    private readonly work: ReviewSyncWorkPort,
    private readonly logger: LoggerPort,
  ) {}

  onModuleDestroy(): void {
    this.#stopped = true;
  }

  @Interval(EVERY_MS)
  async turn(): Promise<void> {
    if (this.#turning || this.#stopped) {
      return;
    }

    this.#turning = true;

    try {
      await this.work.syncDue();
    } catch (error) {
      this.logger.error({ err: error }, 'Syncing reviews with GitHub');
    } finally {
      this.#turning = false;
    }
  }
}
