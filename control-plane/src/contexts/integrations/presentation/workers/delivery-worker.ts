import type { DeliveryWorkPort } from '@integrations/application/ports/delivery-work.port';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 500;

@Injectable()
export class DeliveryWorker implements OnModuleDestroy {
  #ticking = false;
  #stopped = false;

  constructor(
    private readonly work: DeliveryWorkPort,
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
      await this.work.processDue();
    } catch (error) {
      this.logger.error({ err: error }, 'Working off deliveries');
    } finally {
      this.#ticking = false;
    }
  }
}
