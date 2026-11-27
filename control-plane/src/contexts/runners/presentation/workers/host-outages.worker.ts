import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { WatchHostOutages } from '@runners/application/services/watch-host-outages.service';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 60_000;

@Injectable()
export class HostOutagesWorker implements OnModuleDestroy {
  #ticking: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly watching: WatchHostOutages,
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

    this.#ticking = this.watch();
    await this.#ticking;
    this.#ticking = null;
  }

  private async watch(): Promise<void> {
    try {
      await this.watching.sweep();
    } catch (error) {
      this.logger.error({ err: error }, 'Watching host outages');
    }
  }
}
