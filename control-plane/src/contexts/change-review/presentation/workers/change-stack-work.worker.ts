import type { ChangeStackWorkPort } from '@change-review/application/ports/change-stack-work.port';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 2_000;

@Injectable()
export class ChangeStackWorkWorker implements OnModuleDestroy {
  #turning = false;
  #stopped = false;

  constructor(
    private readonly work: ChangeStackWorkPort,
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
      await this.work.workDue();
    } catch (error) {
      this.logger.error(
        { err: error },
        'Drafting and reordering change stacks',
      );
    } finally {
      this.#turning = false;
    }
  }
}
