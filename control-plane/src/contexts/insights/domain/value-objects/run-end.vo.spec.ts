import { InvalidFingerprintError } from '@insights/domain/exceptions/invalid-fingerprint.error';
import { InvalidOutcomeError } from '@insights/domain/exceptions/invalid-outcome.error';
import { endOf } from '@insights/runs.fake-spec';
import { describe, expect, it } from 'vitest';

describe('RunEnd', () => {
  it('names its config by a 64-character hex fingerprint, or none', () => {
    expect(endOf({ fingerprint: null }).fingerprint).toBeNull();
    expect(() => endOf({ fingerprint: 'not-a-fingerprint' })).toThrow(
      InvalidFingerprintError,
    );
  });

  it('is its station’s first run or a later one', () => {
    expect(() => endOf({ runNumber: 0 })).toThrow(InvalidOutcomeError);
    expect(endOf({ runNumber: 3 }).runNumber).toBe(3);
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

  it('measures the time it spent queued and running, not the time between its start and end', () => {
    const end = endOf({
      queuedAt: new Date('2026-09-30T09:00:00.000Z'),
      startedAt: new Date('2026-09-30T09:02:00.000Z'),
      endedAt: new Date('2026-10-02T09:00:00.000Z'),
      queuedMs: 180_000,
      runningMs: 600_000,
    });

    expect(end.queuedMs).toBe(180_000);
    expect(end.runningMs).toBe(600_000);
  });

  it('spends a whole number of milliseconds, and runs only once started', () => {
    const startedAt = new Date('2026-09-30T09:02:00.000Z');

    expect(() => endOf({ startedAt, queuedMs: -1 })).toThrow(
      InvalidOutcomeError,
    );
    expect(() => endOf({ startedAt, runningMs: 1.5 })).toThrow(
      InvalidOutcomeError,
    );
    expect(() => endOf({ startedAt: null, runningMs: 1_000 })).toThrow(
      'cannot run without starting',
    );
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
