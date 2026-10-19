import type { Expression } from '@platform/expressions/expression-engine.port';
import { ExpressionFailures } from '@platform/expressions/expression-failures';
import { isTrue } from '@platform/expressions/readings';
import { afterEach, describe, expect, it, vi } from 'vitest';

const failing = {
  location: 'hooks.notify.when',
  source: 'task.missing.field',
  evaluate: () => {
    throw Object.assign(new Error('No such key: secret-value'), {
      code: 'no_such_key',
    });
  },
} as unknown as Expression;

describe('ExpressionFailures', () => {
  const logger = {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
  let now = 0;
  const failures = new ExpressionFailures(logger, {
    now: () => new Date(now),
    sleep: async () => undefined,
  });

  afterEach(() => failures.onModuleDestroy());

  it('warns once in 10 minutes for each expression that fails', () => {
    failures.onModuleInit();

    expect(isTrue(failing, {})).toBe(false);
    expect(isTrue(failing, {})).toBe(false);
    now += 10 * 60_000;
    isTrue(failing, {});

    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.warn).toHaveBeenCalledWith(
      { location: 'hooks.notify.when', error: 'no_such_key' },
      'An expression failed, so it read as false or empty',
    );
  });
});
