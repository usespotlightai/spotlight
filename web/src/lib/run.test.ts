import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aged, byAge, type Run, standing, working } from '@/lib/run';

// Local, because a calendar day is read off the reader's own clock.
const NOW = new Date(2026, 7, 30, 12, 0, 0);

const on = (days: number, hour = 12) =>
  new Date(2026, 7, 30 - days, hour, 0, 0).toISOString();

describe('aged', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('reads as today within the calendar day', () => {
    expect(aged(on(0))).toBe('Today');
  });

  // The point of counting calendar days: this morning is still today.
  it('reads the small hours of this morning as today', () => {
    expect(aged(on(0, 0))).toBe('Today');
  });

  it('reads as yesterday the calendar day before', () => {
    expect(aged(on(1))).toBe('Yesterday');
  });

  // Under 24 hours, yet the date on the calendar has turned.
  it('reads last night as yesterday', () => {
    expect(aged(on(1, 23))).toBe('Yesterday');
  });

  // Over 24 hours, yet the calendar has turned only once.
  it('reads early yesterday as yesterday', () => {
    expect(aged(on(1, 1))).toBe('Yesterday');
  });

  it('counts days up to a fortnight', () => {
    expect(aged(on(8))).toBe('8 days ago');
  });

  it('counts weeks beyond that', () => {
    expect(aged(on(21))).toBe('3 weeks ago');
  });

  it('counts months beyond two', () => {
    expect(aged(on(90))).toBe('3 months ago');
  });
});

describe('byAge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('gathers neighbours sharing an age, newest first', () => {
    const grouped = byAge([
      { startedAt: on(0, 11) },
      { startedAt: on(0, 9) },
      { startedAt: on(8) },
    ]);

    expect(grouped.map(([age, held]) => [age, held.length])).toEqual([
      ['Today', 2],
      ['8 days ago', 1],
    ]);
  });

  it('keeps the order it was given', () => {
    const grouped = byAge([
      { startedAt: on(0, 11) },
      { startedAt: on(8) },
      { startedAt: on(0, 9) },
    ]);

    expect(grouped.map(([age]) => age)).toEqual([
      'Today',
      '8 days ago',
      'Today',
    ]);
  });

  it('finds nothing in nothing', () => {
    expect(byAge([])).toEqual([]);
  });
});

// The states the control plane actually uses: a run being worked is claimed.
describe('working', () => {
  const run = (state: Run['state'], exitCode: number | null = null) =>
    ({ state, exitCode }) as Run;

  it('holds while a runner has it', () => {
    expect(working(run('claimed'))).toBe(true);
  });

  it('holds while it waits for one', () => {
    expect(working(run('queued'))).toBe(true);
  });

  it('does not once it is over', () => {
    expect(working(run('completed', 0))).toBe(false);
    expect(working(run('failed'))).toBe(false);
  });
});

describe('standing', () => {
  const run = (state: Run['state'], exitCode: number | null = null) =>
    ({ state, exitCode }) as Run;

  it('says nothing of a claimed run', () => {
    expect(standing(run('claimed'))).toBeNull();
  });

  it('reads a queued run as queued', () => {
    expect(standing(run('queued'))).toBe('Queued');
  });

  it('says nothing of a run that has ended, however it ended', () => {
    expect(standing(run('completed', 0))).toBeNull();
    expect(standing(run('completed', 1))).toBeNull();
    expect(standing(run('failed', -1))).toBeNull();
  });
});
