import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';

export const silentLogger: LoggerPort = {
  debug: () => undefined,
  info: () => undefined,
  warn: () => undefined,
  error: () => undefined,
};
