import type { FireHooks } from '@integrations/application/services/fire-hooks.service';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 1_000;

const FORGET_EVERY_MS = 10 * 60 * 1000;

@Injectable()
export class HookFiringWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #forgetting: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly firings: FireHooks,
    private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await Promise.all([this.#ticking, this.#forgetting]);
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
