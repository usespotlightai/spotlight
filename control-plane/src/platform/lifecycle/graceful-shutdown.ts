import { type BeforeApplicationShutdown, Injectable } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export const GRACE_MS = 5_000;

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

    setTimeout(() => {
      this.logger.info({ signal }, 'Cutting what is still connected');
      server.closeAllConnections?.();
    }, GRACE_MS).unref();
  }
}
