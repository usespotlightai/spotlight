import { InconsistentStateError } from '@shared-kernel/domain/exceptions/inconsistent-state.error';
import { Provisioning } from '@shared-kernel/domain/value-objects/provisioning.vo';
import { describe, expect, it } from 'vitest';

const noon = new Date('2026-09-24T12:00:00.000Z');
const later = (ms: number) => new Date(noon.getTime() + ms);

const failed = (times: number) => {
  let provisioning = Provisioning.none();
  for (let failure = 0; failure < times; failure += 1) {
    provisioning = provisioning.failedAt(noon);
  }
  return provisioning;
};

describe('Provisioning', () => {
  it('is due straight away before anything has failed', () => {
    expect(Provisioning.none().dueAt(noon)).toBe(true);
    expect(Provisioning.none().failures).toBe(0);
  });

  it('waits five seconds after the first failure', () => {
    const once = failed(1);

    expect(once.failures).toBe(1);
    expect(once.dueAt(later(4_999))).toBe(false);
    expect(once.dueAt(later(5_000))).toBe(true);
  });

  it('doubles the wait after each failure', () => {
    expect(failed(2).nextAt).toEqual(later(10_000));
    expect(failed(3).nextAt).toEqual(later(20_000));
    expect(failed(4).nextAt).toEqual(later(40_000));
  });

  it('never waits longer than two minutes', () => {
    expect(failed(9).nextAt).toEqual(later(120_000));
  });

  it('is exhausted after five failures', () => {
    expect(failed(4).exhausted).toBe(false);
    expect(failed(5).exhausted).toBe(true);
  });

  it('refuses an impossible number of failures', () => {
    expect(() => Provisioning.rehydrate(-1, null)).toThrow(
      InconsistentStateError,
    );
    expect(() => Provisioning.rehydrate(1.5, null)).toThrow(
      InconsistentStateError,
    );
  });
});
