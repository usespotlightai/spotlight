import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { OwedWorkPort } from '@shared-kernel/application/ports/owed-work.port';

const EVERY_MS = 2_000;

@Injectable()
export class OwedWorkWorker implements OnModuleDestroy {
  #ticking = false;
  #stopped = false;

  constructor(
    private readonly owed: readonly OwedWorkPort[],
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
      for (const work of this.owed) {
        await work
          .workDue()
          .catch((error: unknown) =>
            this.logger.error({ err: error }, work.name),
          );
      }
    } finally {
      this.#ticking = false;
    }
  }
}
