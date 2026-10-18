import type { FireHooks } from '@integrations/application/services/fire-hooks.service';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 1_000;

const PURGE_EVERY_MS = 10 * 60 * 1000;

@Injectable()
export class HookFiringWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #purging: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly firings: FireHooks,
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
      () => this.firings.processDue(),
      'Working off hook firings',
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
      () => this.firings.purgeFinished(),
      'Purging finished hook firings',
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
