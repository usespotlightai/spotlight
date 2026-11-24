import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  aged,
  asRunFilter,
  byAge,
  formatImage,
  inRunFilter,
  type Run,
  runStatus,
  stoppable,
  shownProgress,
  underway,
  waitReason,
  waitsOnPerson,
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

    expect(grouped.map(([age, ofAge]) => [age, ofAge.length])).toEqual([
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

describe('underway', () => {
  const run = (progress: Run['progress']) => ({ progress }) as Run;

  it('is under way while the server reports progress', () => {
    expect(underway(run('queued'))).toBe(true);
    expect(underway(run('in-progress'))).toBe(true);
    expect(underway(run('stopping'))).toBe(true);
  });

  it('is not under way while it waits on a person, or once it is over', () => {
    expect(underway(run(null))).toBe(false);
  });
});

describe('stoppable', () => {
  const run = (progress: Run['progress'], stoppableByYou = true) =>
    ({ progress, stoppableByYou }) as Run;

  it('is true while the run is in progress and the server lets you stop it', () => {
    expect(stoppable(run('in-progress'))).toBe(true);
  });

  it('is false while it waits for a runner, is stopping, or does nothing', () => {
    expect(stoppable(run('queued'))).toBe(false);
    expect(stoppable(run('stopping'))).toBe(false);
    expect(stoppable(run(null))).toBe(false);
  });

  it('is false where the server does not let you stop it', () => {
    expect(stoppable(run('in-progress', false))).toBe(false);
  });
});

describe('waitsOnPerson', () => {
  const run = (state: Run['state'], progress: Run['progress'] = null) =>
    ({ state, progress }) as Run;

  it('is true while the run is suspended for an answer', () => {
    expect(waitsOnPerson(run('suspended'))).toBe(true);
  });

  it('is false once the person answered', () => {
    expect(waitsOnPerson(run('suspended', 'queued'))).toBe(false);
  });

  it('does not for a run at work, waiting for a runner, or over', () => {
    expect(waitsOnPerson(run('claimed'))).toBe(false);
    expect(waitsOnPerson(run('queued'))).toBe(false);
    expect(waitsOnPerson(run('completed'))).toBe(false);
    expect(waitsOnPerson(run('failed'))).toBe(false);
    expect(waitsOnPerson(run('superseded'))).toBe(false);
    expect(waitsOnPerson(run('cancelled'))).toBe(false);
  });
});

describe('runStatus', () => {
  const run = (
    state: Run['state'],
    exitCode: number | null = null,
    waitingForYou = false,
  ) => ({ state, exitCode, progress: null, waitingForYou }) as Run;

  it('says nothing of a claimed run', () => {
    expect(runStatus(run('claimed'))).toBeNull();
  });

  it('leaves a queued run to the pill that every page shows', () => {
    expect(runStatus(run('queued'))).toBeNull();
  });

  it('reads a run that waits for your answer as waiting for you', () => {
    expect(runStatus(run('suspended', null, true))).toBe('Waiting for you');
  });

  it('says nothing of a run that waits for someone else’s answer', () => {
    expect(runStatus(run('suspended'))).toBeNull();
  });

  it('reads a superseded run as superseded', () => {
    expect(runStatus(run('superseded'))).toBe('Superseded');
  });

  it('reads a cancelled run as cancelled', () => {
    expect(runStatus(run('cancelled'))).toBe('Cancelled');
  });

  it('says nothing of a run that has ended, however it ended', () => {
    expect(runStatus(run('completed', 0))).toBeNull();
    expect(runStatus(run('completed', 1))).toBeNull();
    expect(runStatus(run('failed', -1))).toBeNull();
  });
});

describe('run filters', () => {
  const yours = { waitingForYou: true };
  const theirs = { waitingForYou: false };

  it('lets every run through All', () => {
    expect(inRunFilter('all', yours)).toBe(true);
    expect(inRunFilter('all', theirs)).toBe(true);
  });

  it('lets only the runs the server says wait for you through Waiting for you', () => {
    expect(inRunFilter('waiting-for-you', yours)).toBe(true);
    expect(inRunFilter('waiting-for-you', theirs)).toBe(false);
  });

  it('reads a stored filter it knows', () => {
    expect(asRunFilter('waiting-for-you')).toBe('waiting-for-you');
  });

  it('falls back to All for a filter it does not know', () => {
    expect(asRunFilter('archived')).toBe('all');
  });
});

describe('formatImage', () => {
  it('shortens a digest to what a person compares', () => {
    expect(
      formatImage(
        'ghcr.io/acme/api-runner@sha256:9b2f5c1e0d7a4b3c8e6f1a2d5c7b9e0f3a4d6c8b1e2f5a7c9d0b3e6f8a1c4d7e',
      ),
    ).toBe('ghcr.io/acme/api-runner@sha256:9b2f5c1e0d7a');
  });

  it('leaves a reference with no digest alone', () => {
    expect(formatImage('ghcr.io/acme/api-runner:main')).toBe(
      'ghcr.io/acme/api-runner:main',
    );
  });
});

describe('shownProgress', () => {
  const journal = (runId: string, agentStoppedAt: string | null) => ({
    runId,
    marks: { agentStoppedAt },
  });

  it('shows the progress the server sends', () => {
    expect(shownProgress('in-progress', 'run_1', [])).toBe('in-progress');
    expect(shownProgress(null, 'run_1', [])).toBeNull();
  });

  it('stays stopping until the agent has stopped', () => {
    expect(shownProgress('stopping', 'run_1', [journal('run_1', null)])).toBe(
      'stopping',
    );
  });

  it('is finishing once a journal of the run marks the agent as stopped', () => {
    expect(
      shownProgress('stopping', 'run_1', [
        journal('run_1', null),
        journal('run_1', '2026-08-30T12:00:00.000Z'),
      ]),
    ).toBe('finishing');
  });

  it('leaves out the marks of other runs', () => {
    expect(
      shownProgress('stopping', 'run_2', [
        journal('run_1', '2026-08-30T12:00:00.000Z'),
      ]),
    ).toBe('stopping');
  });
});

describe('waitReason', () => {
  const waiting = {
    reason: 'no-pool-has-room',
    since: '2026-08-30T12:00:00.000Z',
  } as const;

  it('says why a queued run waits', () => {
    expect(waitReason({ state: 'queued', waiting })).toBe(
      'The pools that can take this run are full. It starts when one of them has space.',
    );
  });

  it('says that the operator keeps the run off the platform pool', () => {
    expect(
      waitReason({
        state: 'queued',
        waiting: { ...waiting, reason: 'platform-pool-not-allowed' },
      }),
    ).toMatch(/operator of this deployment/);
  });

  it('says nothing once the run is no longer queued, or without a reason', () => {
    expect(waitReason({ state: 'claimed', waiting })).toBeNull();
    expect(waitReason({ state: 'queued', waiting: null })).toBeNull();
  });
});
