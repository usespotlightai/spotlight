import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { PurgeRunConnections } from '@work/application/services/purge-run-connections.service';

const PURGE_EVERY_MS = 60 * 60 * 1000;

@Injectable()
export class RunConnectionsWorker implements OnModuleDestroy {
  #purging: Promise<void> | null = null;
  #stopped = false;

  constructor(
    private readonly purging: PurgeRunConnections,
    private readonly logger: LoggerPort,
  ) {}

  async onModuleDestroy(): Promise<void> {
    this.#stopped = true;
    await this.#purging;
  }

  @Interval(PURGE_EVERY_MS)
  async purge(): Promise<void> {
    if (this.#purging || this.#stopped) {
      return;
    }

    this.#purging = this.purgeOnce();
    await this.#purging;
    this.#purging = null;
  }

  private async purgeOnce(): Promise<void> {
    try {
      await this.purging.purge();
    } catch (error) {
      this.logger.error(
        { err: error },
        'Purging connection records older than 30 days failed',
      );
    }
  }
}
