import type { HookFirings } from '@integrations/application/services/hook-firings.service';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 1_000;

const FORGET_EVERY_MS = 10 * 60 * 1000;

@Injectable()
export class HookFiringWorker implements OnModuleDestroy {
  #turning: Promise<void> | null = null;
  #forgetting: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly firings: HookFirings,
    private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await Promise.all([this.#turning, this.#forgetting]);
  }

  @Interval(EVERY_MS)
  async turn(): Promise<void> {
    if (this.#turning || this.#stopped) {
      return;
    }

    this.#turning = this.logged(
      () => this.firings.workOff(),
      'Working off hook firings',
    );
    await this.#turning;
    this.#turning = null;
  }

  @Interval(FORGET_EVERY_MS)
  async forget(): Promise<void> {
    if (this.#forgetting || this.#stopped) {
      return;
    }

    this.#forgetting = this.logged(
      () => this.firings.forgetFinished(),
      'Forgetting finished hook firings',
    );
    await this.#forgetting;
    this.#forgetting = null;
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
