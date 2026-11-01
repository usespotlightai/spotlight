import type { ProcessDuePolls } from '@integrations/application/services/process-due-polls.service';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 15_000;

@Injectable()
export class PollWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly polls: ProcessDuePolls,
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

    this.#ticking = this.poll();
    await this.#ticking;
    this.#ticking = null;
  }

  private async poll(): Promise<void> {
    try {
      await this.polls.processDue();
    } catch (error) {
      this.logger.error({ err: error }, 'Working off polls');
    }
  }
}
