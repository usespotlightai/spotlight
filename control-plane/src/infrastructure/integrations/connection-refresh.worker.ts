import type { LoggerPort } from '@application/ports/logger.port';
import type { RefreshConnections } from '@infrastructure/integrations/refresh-connections';
import { Injectable, type OnModuleDestroy } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';

/** How often connections are looked over for renewal, well inside the margin. */
export const EVERY_MS = 60_000;

/**
 * Turns the handle on renewing connections. Each tick renews whatever tokens
 * are near their end, so no outbound call ever has to.
 */
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
