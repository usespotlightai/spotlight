import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { ProvisionWork } from '@work/application/services/provision-work.service';

const EVERY_MS = 1_000;

@Injectable()
export class ProvisionWorkWorker implements OnModuleDestroy {
  #turning: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly work: ProvisionWork,
    private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await this.#turning;
  }

  @Interval(EVERY_MS)
  async turn(): Promise<void> {
    if (this.#turning || this.#stopped) {
      return;
    }

    this.#turning = this.provisioned();
    await this.#turning;
    this.#turning = null;
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
