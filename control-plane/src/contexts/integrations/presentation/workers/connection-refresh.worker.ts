import type { RefreshConnections } from '@integrations/application/services/refresh-connections.service';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export const EVERY_MS = 60_000;

@Injectable()
export class ConnectionRefreshWorker implements OnModuleDestroy {
  #turning = false;
  #stopped = false;

  constructor(
    private readonly connections: RefreshConnections,
    private readonly logger: LoggerPort,
  ) {}

  onModuleDestroy(): void {
    this.#stopped = true;
  }

  @Interval(EVERY_MS)
  async turn(): Promise<void> {
    if (this.#turning || this.#stopped) {
      return;
    }

    this.#turning = true;

    try {
      await this.connections.refresh();
    } catch (error) {
      this.logger.error({ err: error }, 'Renewing connections');
    } finally {
      this.#turning = false;
    }
  }
}
