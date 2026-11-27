import { type BeforeApplicationShutdown, Injectable } from '@nestjs/common';
import type { HttpAdapterHost } from '@nestjs/core';
import { httpServerOf } from '@platform/http/http-server-of';
import { fieldOf } from '@platform/json/field-of';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export const GRACE_MS = 5_000;

@Injectable()
export class GracefulShutdown implements BeforeApplicationShutdown {
  constructor(
    private readonly adapters: HttpAdapterHost,
    private readonly logger: LoggerPort,
  ) {}

  beforeApplicationShutdown(signal?: string): void {
    const server = httpServerOf(this.adapters);
    const closeAllConnections = fieldOf(server, 'closeAllConnections');

    if (typeof closeAllConnections !== 'function') {
      return;
    }

    this.logger.info({ signal, graceMs: GRACE_MS }, 'Shutting down');

    setTimeout(() => {
      this.logger.info({ signal }, 'Cutting what is still connected');
      Reflect.apply(closeAllConnections, server, []);
    }, GRACE_MS).unref();
  }
}
