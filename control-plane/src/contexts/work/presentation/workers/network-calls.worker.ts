import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { NetworkCalls } from '@work/application/services/network-calls.service';

const EVERY_MS = 15_000;

@Injectable()
export class NetworkCallsWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly calls: NetworkCalls,
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

    this.#ticking = this.tended();
    await this.#ticking;
    this.#ticking = null;
  }

  private async tended(): Promise<void> {
    try {
      await this.calls.expireDue();
      await this.calls.forgetCompleted();
    } catch (error) {
      this.logger.error(
        { err: error },
        'Expiring or forgetting network calls failed',
      );
    }
  }
}
