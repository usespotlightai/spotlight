import type { HttpAdapterHost } from '@nestjs/core';
import {
  GRACE_MS,
  GracefulShutdown,
} from '@platform/lifecycle/graceful-shutdown';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const shuttingDown = (server: unknown) => {
  const logger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  } as unknown as LoggerPort;

  const adapters = {
    httpAdapter: server ? { getHttpServer: () => server } : undefined,
  } as unknown as HttpAdapterHost;

  return { shutdown: new GracefulShutdown(adapters, logger), logger };
};

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('GracefulShutdown', () => {
  it('leaves what is in flight alone for its grace', () => {
    const closeAllConnections = vi.fn();
    const { shutdown } = shuttingDown({ closeAllConnections });

    shutdown.beforeApplicationShutdown('SIGTERM');
    vi.advanceTimersByTime(GRACE_MS - 1);

    expect(closeAllConnections).not.toHaveBeenCalled();
  });

  it('cuts what is still connected once the grace is up', () => {
    const closeAllConnections = vi.fn();
    const { shutdown } = shuttingDown({ closeAllConnections });

    shutdown.beforeApplicationShutdown('SIGTERM');
    vi.advanceTimersByTime(GRACE_MS);

    expect(closeAllConnections).toHaveBeenCalledTimes(1);
  });

  it('says it is going down, and names what asked', () => {
    const { shutdown, logger } = shuttingDown({
      closeAllConnections: vi.fn(),
    });

    shutdown.beforeApplicationShutdown('SIGTERM');

    expect(logger.info).toHaveBeenCalledWith(
      { signal: 'SIGTERM', graceMs: GRACE_MS },
      'Shutting down',
    );
  });

  it('does nothing where there is no server to close', () => {
    const { shutdown, logger } = shuttingDown(undefined);

    expect(() => shutdown.beforeApplicationShutdown('SIGTERM')).not.toThrow();
    expect(logger.info).not.toHaveBeenCalled();
  });

  it('does nothing where the server cannot cut its connections', () => {
    const { shutdown, logger } = shuttingDown({});

    expect(() => shutdown.beforeApplicationShutdown('SIGTERM')).not.toThrow();
    expect(logger.info).not.toHaveBeenCalled();
  });
});
