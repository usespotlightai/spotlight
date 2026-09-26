import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { ForgetHeardHappenings } from '@work/application/services/forget-heard-happenings.service';

const FORGET_EVERY_MS = 60 * 60 * 1000;

@Injectable()
export class HeardHappeningsWorker implements OnModuleDestroy {
  #forgetting: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly forgetting: ForgetHeardHappenings,
    private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await this.#forgetting;
  }

  @Interval(FORGET_EVERY_MS)
  async forget(): Promise<void> {
    if (this.#forgetting || this.#stopped) {
      return;
    }

    this.#forgetting = this.forgotten();
    await this.#forgetting;
    this.#forgetting = null;
  }

  private async forgotten(): Promise<void> {
    try {
      await this.forgetting.forget();
    } catch (error) {
      this.logger.error({ err: error }, 'Forgetting happenings heard long ago');
    }
  }
}
