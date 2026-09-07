import type { LoggerPort } from '@application/ports/logger.port';
import type { WorkOffPolls } from '@infrastructure/integrations/work-off-polls';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

/** The floor on how often any poll runs; each poll's own `every` is the rest. */
export const EVERY_MS = 15_000;

/**
 * Turns the handle on the pollers. Each tick runs whatever team polls have come
 * due; a poll due more often than this simply runs no more often than this.
 */
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
