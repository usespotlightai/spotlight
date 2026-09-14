import type { LoggerPort } from '@application/ports/logger.port';
import type { WorkOffPolls } from '@infrastructure/integrations/work-off-polls';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

export const EVERY_MS = 15_000;

@Injectable()
export class PollWorker implements OnModuleDestroy {
  #turning = false;
  #stopped = false;

  constructor(
    private readonly polls: WorkOffPolls,
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
      await this.polls.workOff();
    } catch (error) {
      this.logger.error({ err: error }, 'Working off polls');
    } finally {
      this.#turning = false;
    }
  }
}
