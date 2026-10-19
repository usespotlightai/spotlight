import { AsyncLocalStorage } from 'node:async_hooks';
import type { LogFields } from '@shared-kernel/application/ports/logger.port';

const context = new AsyncLocalStorage<LogFields>();

export const logContext = (): LogFields => context.getStore() ?? {};

export function withLogContext<T>(fields: LogFields, work: () => T): T {
  const defined = Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  );

  return context.run({ ...logContext(), ...defined }, work);
}

export function withoutLogContext<T>(work: () => T): T {
  return context.run({}, work);
}
