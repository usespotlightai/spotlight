import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { ForgetHosts } from '@runners/application/services/forget-hosts.service';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 10 * 60_000;

@Injectable()
export class ForgottenHostsWorker implements OnModuleDestroy {
  #turning: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly forgetting: ForgetHosts,
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

    this.#turning = this.forgotten();
    await this.#turning;
    this.#turning = null;
  }

  private async forgotten(): Promise<void> {
    try {
      await this.forgetting.unheard();
    } catch (error) {
      this.logger.error({ err: error }, this.forgetting.name);
    }
  }
}
