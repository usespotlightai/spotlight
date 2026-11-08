import { InvalidWarmSandboxCountError } from '@lines/domain/exceptions/invalid-warm-sandbox-count.error';
import { WarmSandboxCount } from '@lines/domain/value-objects/warm-sandbox-count.vo';
import { describe, expect, it } from 'vitest';

describe('WarmSandboxCount', () => {
  it.each([0, 1, 5])('accepts %d', (count) => {
    expect(WarmSandboxCount.of(count).value).toBe(count);
  });

  it.each([-1, 6, 1.5, Number.NaN, Number.POSITIVE_INFINITY])(
    'rejects %d',
    (count) => {
      expect(() => WarmSandboxCount.of(count)).toThrow(
        InvalidWarmSandboxCountError,
      );
    },
  );

  it('keeps no sandboxes warm when it counts 0', () => {
    expect(WarmSandboxCount.of(0).isNone).toBe(true);
    expect(WarmSandboxCount.of(2).isNone).toBe(false);
  });

  it('equals a count of the same value', () => {
    expect(WarmSandboxCount.of(3).equals(WarmSandboxCount.of(3))).toBe(true);
    expect(WarmSandboxCount.of(3).equals(WarmSandboxCount.of(4))).toBe(false);
  });
});
