import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { aged, byAge, type Run, standing, working } from '@/lib/run';

const NOW = new Date('2026-08-30T12:00:00.000Z');

const ago = (days: number) =>
  new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000).toISOString();

describe('aged', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => vi.useRealTimers());

  it('reads as today within the day', () => {
    expect(aged(ago(0.5))).toBe('Today');
  });

  it('reads as yesterday the day after', () => {
    expect(aged(ago(1.5))).toBe('Yesterday');
  });

  it('counts days up to a fortnight', () => {
    expect(aged(ago(8))).toBe('8 days ago');
  });

  it('counts weeks beyond that', () => {
    expect(aged(ago(21))).toBe('3 weeks ago');
  });

  it('counts months beyond two', () => {
    expect(aged(ago(90))).toBe('3 months ago');
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
      { startedAt: ago(0.2) },
      { startedAt: ago(0.4) },
      { startedAt: ago(8) },
    ]);

    expect(grouped.map(([age, held]) => [age, held.length])).toEqual([
      ['Today', 2],
      ['8 days ago', 1],
    ]);
  });

  // The reader hands them back in order; grouping must not reorder them.
  it('keeps the order it was given', () => {
    const grouped = byAge([
      { startedAt: ago(0.2) },
      { startedAt: ago(8) },
      { startedAt: ago(0.4) },
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

  it('reads a claimed run as running', () => {
    expect(standing(run('claimed'))).toBe('Running');
  });

  it('says how a completed run ended, where it did not simply finish', () => {
    expect(standing(run('completed', 0))).toBeNull();
    expect(standing(run('completed', 1))).toBe('Failed (1)');
  });
});
