import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  aged,
  asRunFilter,
  byAge,
  formatImage,
  inRunFilter,
  type Run,
  runStatus,
  shownProgress,
  underway,
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
  const run = (state: Run['state']) => ({ state }) as Run;

  it('is under way while it waits for a runner or a runner has it', () => {
    expect(underway(run('queued'))).toBe(true);
    expect(underway(run('claimed'))).toBe(true);
  });

  it('is not under way while it waits on a person, or once it is over', () => {
    expect(underway(run('suspended'))).toBe(false);
    expect(underway(run('completed'))).toBe(false);
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
  const run = (state: Run['state'], exitCode: number | null = null) =>
    ({ state, exitCode, progress: null }) as Run;

  it('says nothing of a claimed run', () => {
    expect(runStatus(run('claimed'))).toBeNull();
  });

  it('leaves a queued run to the pill that every page shows', () => {
    expect(runStatus(run('queued'))).toBeNull();
  });

  it('reads a run that asked a person as waiting for you', () => {
    expect(runStatus(run('suspended'))).toBe('Waiting for you');
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
  const pending = {
    state: 'completed',
    progress: null,
    review: { state: 'pending', conversationId: 'c_1' },
  } as const;
  const answered = {
    state: 'completed',
    progress: null,
    review: { state: 'answered', conversationId: 'c_2' },
  } as const;
  const unreviewed = {
    state: 'completed',
    progress: null,
    review: null,
  } as const;
  const asking = { state: 'suspended', progress: null, review: null } as const;

  it('lets every run through All', () => {
    expect(inRunFilter('all', pending)).toBe(true);
    expect(inRunFilter('all', answered)).toBe(true);
    expect(inRunFilter('all', unreviewed)).toBe(true);
  });

  it('lets only runs with a pending review or answer through Waiting for you', () => {
    expect(inRunFilter('waiting-for-you', pending)).toBe(true);
    expect(inRunFilter('waiting-for-you', asking)).toBe(true);
    expect(inRunFilter('waiting-for-you', answered)).toBe(false);
    expect(inRunFilter('waiting-for-you', unreviewed)).toBe(false);
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
