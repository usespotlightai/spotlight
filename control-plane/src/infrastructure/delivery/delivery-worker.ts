import type { DeliveryWorkPort } from '@application/ports/delivery-work.port';
import type { LoggerPort } from '@application/ports/logger.port';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

export const EVERY_MS = 500;

@Injectable()
export class DeliveryWorker implements OnModuleDestroy {
  #turning = false;
  #stopped = false;

  constructor(
    private readonly work: DeliveryWorkPort,
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
      await this.work.workOff();
    } catch (error) {
      this.logger.error({ err: error }, 'Working off deliveries');
    } finally {
      this.#turning = false;
    }
  }
}
