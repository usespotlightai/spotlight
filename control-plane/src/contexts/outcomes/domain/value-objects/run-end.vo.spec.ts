import { InvalidOutcomeError } from '@outcomes/domain/exceptions/invalid-outcome.error';
import { endOf } from '@outcomes/domain/outcomes.fake-spec';
import { describe, expect, it } from 'vitest';

describe('RunEnd', () => {
  it('names its config by a 64-character hex fingerprint, or none', () => {
    expect(endOf({ fingerprint: null }).fingerprint).toBeNull();
    expect(() => endOf({ fingerprint: 'not-a-fingerprint' })).toThrow(
      InvalidOutcomeError,
    );
  });

  it('is its station’s first round or a later one', () => {
    expect(() => endOf({ round: 0 })).toThrow(InvalidOutcomeError);
    expect(endOf({ round: 3 }).round).toBe(3);
  });

  it('is queued, started and ended in that order', () => {
    const queued = new Date('2026-09-30T09:00:00.000Z');
    const started = new Date('2026-09-30T09:02:00.000Z');
    const end = endOf({
      queuedAt: queued,
      startedAt: started,
      endedAt: new Date('2026-09-30T09:10:00.000Z'),
    });

    expect(end.queuedMs).toBe(120_000);
    expect(end.runningMs).toBe(480_000);
    expect(() =>
      endOf({ queuedAt: started, startedAt: queued, endedAt: started }),
    ).toThrow(InvalidOutcomeError);
  });

  it('measures no wait it never saw start', () => {
    expect(endOf({ queuedAt: null, startedAt: null }).queuedMs).toBeNull();
    expect(endOf({ startedAt: null }).runningMs).toBeNull();
  });

  it('ran its config only once it started and unless it was cancelled', () => {
    const started = new Date('2026-09-30T09:02:00.000Z');

    expect(endOf({ startedAt: started }).ranItsConfig).toBe(true);
    expect(endOf({ startedAt: started, ending: 'failed' }).ranItsConfig).toBe(
      true,
    );
    expect(endOf({ startedAt: null, ending: 'failed' }).ranItsConfig).toBe(
      false,
    );
    expect(
      endOf({ startedAt: started, ending: 'cancelled' }).ranItsConfig,
    ).toBe(false);
  });
});
