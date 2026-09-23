import type { OwedWorkPort } from '@change-review/application/ports/owed-work.port';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 2_000;

@Injectable()
export class OwedWorkWorker implements OnModuleDestroy {
  #turning = false;
  #stopped = false;

  constructor(
    private readonly owed: readonly OwedWorkPort[],
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
      for (const work of this.owed) {
        await work
          .workDue()
          .catch((error: unknown) =>
            this.logger.error({ err: error }, work.name),
          );
      }
    } finally {
      this.#turning = false;
    }
  }
}
