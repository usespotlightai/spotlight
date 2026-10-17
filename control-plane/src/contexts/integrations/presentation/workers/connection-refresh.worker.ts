import type { RefreshConnections } from '@integrations/application/services/refresh-connections.service';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

const EVERY_MS = 60_000;

@Injectable()
export class ConnectionRefreshWorker implements OnModuleDestroy {
  #ticking = false;
  #stopped = false;

  constructor(
    private readonly connections: RefreshConnections,
    private readonly logger: LoggerPort,
  ) {}

  onModuleDestroy(): void {
    this.#stopped = true;
  }

  @Interval(EVERY_MS)
  async tick(): Promise<void> {
    if (this.#ticking || this.#stopped) {
      return;
    }

    this.#ticking = true;

    try {
      await this.connections.refresh();
    } catch (error) {
      this.logger.error({ err: error }, 'Refreshing connections');
    } finally {
      this.#ticking = false;
    }
  }
}
