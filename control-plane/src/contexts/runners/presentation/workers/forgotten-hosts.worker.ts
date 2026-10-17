import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { ForgetHosts } from '@runners/application/services/forget-hosts.service';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 10 * 60_000;

@Injectable()
export class ForgottenHostsWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly forgetting: ForgetHosts,
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

    this.#ticking = this.forgotten();
    await this.#ticking;
    this.#ticking = null;
  }

  private async forgotten(): Promise<void> {
    try {
      await this.forgetting.unheard();
    } catch (error) {
      this.logger.error({ err: error }, this.forgetting.name);
    }
  }
}
