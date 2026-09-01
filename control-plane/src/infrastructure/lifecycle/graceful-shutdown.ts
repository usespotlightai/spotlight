import type { LoggerPort } from '@application/ports/logger.port';
import { type BeforeApplicationShutdown, Injectable } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';

/**
 * How long a request in flight has to finish once we have stopped taking new
 * ones. Under the ten seconds a container is usually given before it is
 * killed outright, so what is left is cut on our terms rather than its.
 */
export const GRACE_MS = 5_000;

/**
 * Closing the server waits for every open connection, and a terminal being
 * watched is a connection that never closes on its own. Left alone, a deploy
 * would hang until something killed it, and nothing that runs afterwards —
 * closing the database pool among it — would run at all.
 */
@Injectable()
export class GracefulShutdown implements BeforeApplicationShutdown {
  constructor(
    private readonly adapters: HttpAdapterHost,
    private readonly logger: LoggerPort,
  ) {}

  beforeApplicationShutdown(signal?: string): void {
    const server = this.adapters.httpAdapter?.getHttpServer() as
      | { closeAllConnections?: () => void }
      | undefined;

    if (!server?.closeAllConnections) {
      return;
    }

    this.logger.info({ signal, graceMs: GRACE_MS }, 'Shutting down');

    // Unreferenced, so waiting to cut connections is never itself the reason
    // the process is still up.
    setTimeout(() => {
      this.logger.info({ signal }, 'Cutting what is still connected');
      server.closeAllConnections?.();
    }, GRACE_MS).unref();
  }
}
