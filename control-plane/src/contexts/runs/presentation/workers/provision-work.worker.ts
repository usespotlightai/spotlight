import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { ProvisionWork } from '@runs/application/services/provision-work.service';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 1_000;

@Injectable()
export class ProvisionWorkWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly work: ProvisionWork,
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

    this.#ticking = this.provisioned();
    await this.#ticking;
    this.#ticking = null;
  }

  private async provisioned(): Promise<void> {
    try {
      await this.work.due();
    } catch (error) {
      this.logger.error(
        { err: error },
        'Provisioning runs and checks for push pools',
      );
    }
  }
}
