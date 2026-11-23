import {
  claimableAt,
  currentWait,
  waitsForAnyRunnerAt,
} from '@runs/domain/value-objects/run-waiting';
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

  it('waits for the reason Spotlight noted in this queueing, while no runner is reserved for it', () => {
    const wait = {
      reason: 'no-pool-has-room' as const,
      since: NOW,
      queuedAt: EARLIER,
    };
    const facts = {
      state: 'queued' as const,
      queuedAt: EARLIER,
      reserved: false,
    };

    expect(currentWait(facts, wait)).toEqual({
      reason: 'no-pool-has-room',
      since: NOW,
    });
    expect(currentWait(facts, null)).toBeNull();
    expect(currentWait({ ...facts, queuedAt: LATER }, wait)).toBeNull();
    expect(currentWait({ ...facts, reserved: true }, wait)).toBeNull();
    expect(currentWait({ ...facts, state: 'claimed' }, wait)).toBeNull();
  });
});
