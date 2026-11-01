import type { DeliveryWorkPort } from '@integrations/application/ports/delivery-work.port';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 500;

@Injectable()
export class DeliveryWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly work: DeliveryWorkPort,
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

    this.#ticking = this.deliver();
    await this.#ticking;
    this.#ticking = null;
  }

  private async deliver(): Promise<void> {
    try {
      await this.work.processDue();
    } catch (error) {
      this.logger.error({ err: error }, 'Working off deliveries');
    }
  }
}
