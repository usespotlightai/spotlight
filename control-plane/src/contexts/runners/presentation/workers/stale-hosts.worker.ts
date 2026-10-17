import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { PurgeStaleHosts } from '@runners/application/services/purge-stale-hosts.service';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 10 * 60_000;

@Injectable()
export class StaleHostsWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly purging: PurgeStaleHosts,
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

    this.#ticking = this.purge();
    await this.#ticking;
    this.#ticking = null;
  }

  private async purge(): Promise<void> {
    try {
      await this.purging.purgeStale();
    } catch (error) {
      this.logger.error({ err: error }, this.purging.name);
    }
  }
}
