import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PendingJobsPort } from '@shared-kernel/application/ports/pending-jobs.port';

const EVERY_MS = 2_000;

@Injectable()
export class PendingJobWorker implements OnModuleDestroy {
  #ticking = false;
  #stopped = false;

  constructor(
    private readonly jobs: readonly PendingJobsPort[],
    private readonly logger: LoggerPort,
  ) {}

  onModuleDestroy(): void {
    this.#stopped = true;
  }

  @Interval(EVERY_MS)
  async tick(): Promise<void> {
    if (this.#ticking || this.#stopped) {
      return;
    }

    this.#ticking = true;

    try {
      for (const source of this.jobs) {
        await source
          .processDue()
          .catch((error: unknown) =>
            this.logger.error({ err: error }, source.name),
          );
      }
    } finally {
      this.#ticking = false;
    }
  }
}
