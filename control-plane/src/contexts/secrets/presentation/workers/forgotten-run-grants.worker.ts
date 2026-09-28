import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { ForgetRunGrants } from '@secrets/application/services/forget-run-grants.service';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 60 * 60_000;

@Injectable()
export class ForgottenRunGrantsWorker implements OnModuleDestroy {
  #turning: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly forgetting: ForgetRunGrants,
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
      await this.forgetting.longEnded();
    } catch (error) {
      this.logger.error({ err: error }, this.forgetting.name);
    }
  }
}
