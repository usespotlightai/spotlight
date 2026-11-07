import type { DeliveryWorkPort } from '@integrations/application/ports/delivery-work.port';
import type { InboundDeliveryRetention } from '@integrations/application/services/inbound-delivery-retention.service';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 500;

const PURGE_EVERY_MS = 10 * 60 * 1000;

@Injectable()
export class DeliveryWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #purging: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly work: DeliveryWorkPort,
    private readonly retention: InboundDeliveryRetention,
    private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await Promise.all([this.#ticking, this.#purging]);
  }

  @Interval(EVERY_MS)
  async tick(): Promise<void> {
    if (this.#ticking || this.#stopped) {
      return;
    }

    this.#ticking = this.logged(
      () => this.work.processDue(),
      'Working off deliveries',
    );
    await this.#ticking;
    this.#ticking = null;
  }

  @Interval(PURGE_EVERY_MS)
  async purge(): Promise<void> {
    if (this.#purging || this.#stopped) {
      return;
    }

    this.#purging = this.logged(
      () => this.retention.purgeFinished(),
      'Purging finished deliveries',
    );
    await this.#purging;
    this.#purging = null;
  }

  private async logged(
    work: () => Promise<unknown>,
    doing: string,
  ): Promise<void> {
    try {
      await work();
    } catch (error) {
      this.logger.error({ err: error }, doing);
    }
  }
}
