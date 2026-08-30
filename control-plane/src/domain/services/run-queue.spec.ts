import { RunQueue } from '@domain/services/run-queue';
import { describe, expect, it } from 'vitest';

const at = (iso: string) => new Date(iso);

const queued = (priority: number, createdAt: string) => ({
  priority,
  createdAt: at(createdAt),
});

const order = (...runs: { priority: number; createdAt: Date }[]) =>
  [...runs].sort(RunQueue.before);

describe('RunQueue', () => {
  // A station nearer the front of the line is worked first.
  it('hands out the higher priority first', () => {
    const later = queued(2, '2026-08-29T12:00:00.000Z');
    const sooner = queued(9, '2026-08-29T13:00:00.000Z');

    expect(order(later, sooner)).toEqual([sooner, later]);
  });

  it('hands out the longest wait first among equals', () => {
    const waiting = queued(1, '2026-08-29T12:00:00.000Z');
    const fresh = queued(1, '2026-08-29T13:00:00.000Z');

    expect(order(fresh, waiting)).toEqual([waiting, fresh]);
  });

  // Priority decides before waiting does, or a backlog of low work would
  // starve whatever is meant to come first.
  it('lets priority decide before waiting does', () => {
    const oldLow = queued(1, '2026-08-01T00:00:00.000Z');
    const newHigh = queued(5, '2026-08-29T13:00:00.000Z');

    expect(order(oldLow, newHigh)).toEqual([newHigh, oldLow]);
  });
});
