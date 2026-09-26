import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aged,
  asRunFilter,
  byAge,
  imageShown,
  inRunFilter,
  type Run,
  standing,
  working,
} from '@/lib/run';

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

  it('reads the small hours of this morning as today', () => {
    expect(aged(on(0, 0))).toBe('Today');
  });

  it('reads as yesterday the calendar day before', () => {
    expect(aged(on(1))).toBe('Yesterday');
  });

  it('reads last night as yesterday', () => {
    expect(aged(on(1, 23))).toBe('Yesterday');
  });

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

  it('reads a superseded run as superseded', () => {
    expect(standing(run('superseded'))).toBe('Superseded');
  });

  it('says nothing of a run that has ended, however it ended', () => {
    expect(standing(run('completed', 0))).toBeNull();
    expect(standing(run('completed', 1))).toBeNull();
    expect(standing(run('failed', -1))).toBeNull();
  });
});

describe('run filters', () => {
  const owed = { review: { state: 'owed', conversationId: 'c_1' } } as const;
  const settled = {
    review: { state: 'settled', conversationId: 'c_2' },
  } as const;
  const unreviewed = { review: null };

  it('lets every run through All', () => {
    expect(inRunFilter('all', owed)).toBe(true);
    expect(inRunFilter('all', settled)).toBe(true);
    expect(inRunFilter('all', unreviewed)).toBe(true);
  });

  it('lets only runs still owed a review through Awaiting Review', () => {
    expect(inRunFilter('awaiting-review', owed)).toBe(true);
    expect(inRunFilter('awaiting-review', settled)).toBe(false);
    expect(inRunFilter('awaiting-review', unreviewed)).toBe(false);
  });

  it('reads a remembered filter it knows', () => {
    expect(asRunFilter('awaiting-review')).toBe('awaiting-review');
  });

  it('falls back to All for a filter it does not know', () => {
    expect(asRunFilter('archived')).toBe('all');
  });
});

describe('imageShown', () => {
  it('shortens a digest to what a person compares', () => {
    expect(
      imageShown(
        'ghcr.io/acme/api-runner@sha256:9b2f5c1e0d7a4b3c8e6f1a2d5c7b9e0f3a4d6c8b1e2f5a7c9d0b3e6f8a1c4d7e',
      ),
    ).toBe('ghcr.io/acme/api-runner@sha256:9b2f5c1e0d7a');
  });

  it('leaves a reference with no digest alone', () => {
    expect(imageShown('ghcr.io/acme/api-runner:main')).toBe(
      'ghcr.io/acme/api-runner:main',
    );
  });
});
