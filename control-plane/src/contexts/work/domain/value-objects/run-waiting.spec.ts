import {
  claimableAt,
  waitsForAnyRunnerAt,
} from '@work/domain/value-objects/run-waiting';
import { describe, expect, it } from 'vitest';

const NOW = new Date('2026-11-07T12:00:00Z');
const LATER = new Date('2026-11-07T12:05:00Z');
const EARLIER = new Date('2026-11-07T11:55:00Z');

const queued = {
  state: 'queued' as const,
  claimableFrom: null,
  reservedUntil: null,
};

describe('a waiting run', () => {
  it('can be claimed once queued and past its back-off', () => {
    expect(claimableAt(queued, NOW)).toBe(true);
    expect(claimableAt({ ...queued, claimableFrom: EARLIER }, NOW)).toBe(true);
    expect(claimableAt({ ...queued, claimableFrom: LATER }, NOW)).toBe(false);
    expect(claimableAt({ ...queued, state: 'claimed' }, NOW)).toBe(false);
  });

  it('waits for any runner only while nobody holds a reservation on it', () => {
    expect(waitsForAnyRunnerAt(queued, NOW)).toBe(true);
    expect(waitsForAnyRunnerAt({ ...queued, reservedUntil: LATER }, NOW)).toBe(
      false,
    );
    expect(
      waitsForAnyRunnerAt({ ...queued, reservedUntil: EARLIER }, NOW),
    ).toBe(true);
    expect(waitsForAnyRunnerAt({ ...queued, claimableFrom: LATER }, NOW)).toBe(
      false,
    );
  });
});
