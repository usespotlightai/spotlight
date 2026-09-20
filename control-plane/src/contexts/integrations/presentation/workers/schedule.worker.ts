import type { RunSchedules } from '@integrations/application/services/run-schedules.service';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 15_000;

@Injectable()
export class ScheduleWorker implements OnModuleDestroy {
  #turning = false;
  #stopped = false;

  constructor(
    private readonly schedules: RunSchedules,
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
      await this.schedules.runDue();
    } catch (error) {
      this.logger.error({ err: error }, 'Running due schedules');
    } finally {
      this.#turning = false;
    }
  }
}
