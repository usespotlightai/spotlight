import type { InboxNote } from '@work/application/ports/inbox-reader.port';
import {
  failureIn,
  threadAt,
} from '@work/infrastructure/persistence/drizzle/readers/task-trail';
import { describe, expect, it } from 'vitest';

const note = (position: number, failure: InboxNote['failure']): InboxNote => ({
  position,
  kind: 'asked',
  form: failure ? 'failure' : 'words',
  voice: 'station',
  station: 'Implementation',
  stationId: 'station_implementation',
  stationColor: '#edc12b',
  stationPosition: 1,
  runId: 'run_1',
  body: '',
  attachments: [],
  at: new Date('2026-09-26T09:15:00.000Z'),
  author: null,
  readAt: null,
  approval: null,
  failure,
  connection: null,
});

describe('failureIn', () => {
  it('is the failure the conversation is about, with how often it happened', () => {
    const exited = { source: 'run', code: 'exited', occurrences: 3 };

    expect(failureIn([note(0, null), note(1, exited)])).toEqual(exited);
  });

  it('is the latest failure where the conversation reported more than one', () => {
    const looped = {
      source: 'hook:notify-slack',
      code: 'loop',
      occurrences: 1,
    };

    expect(
      failureIn([
        note(0, { source: 'run', code: 'exited', occurrences: 2 }),
        note(1, looped),
        note(2, null),
      ]),
    ).toEqual(looped);
  });

  it('is nothing where the conversation is not about a failure', () => {
    expect(failureIn([note(0, null), note(1, null)])).toBeNull();
  });
});

describe('threadAt', () => {
  const trail = [
    {
      runId: 'run_1',
      stationId: 'station_triage',
      station: 'Triage',
      body: 'triage note',
    },
    {
      runId: null,
      stationId: 'station_implementation',
      station: 'Implementation',
      body: 'typed at implementation',
    },
    {
      runId: 'run_2',
      stationId: 'station_implementation',
      station: 'Implementation',
      body: 'it failed',
    },
    {
      runId: null,
      stationId: 'station_implementation',
      station: 'Implementation',
      body: 'try again',
    },
    {
      runId: 'run_3',
      stationId: 'station_implementation',
      station: 'Implementation',
      body: 'it failed again',
    },
    {
      runId: null,
      stationId: 'station_implementation',
      station: 'Implementation',
      body: 'try again once more',
    },
    {
      runId: 'run_4',
      stationId: 'station_code_review',
      station: 'Code review',
      body: 'code review note',
    },
  ];

  const bodies = (
    notes: readonly (typeof trail)[number][],
    stationId: string | null,
    runId: string,
  ) => threadAt(notes, stationId, runId).map((each) => each.body);

  it('takes every note at the station of the run', () => {
    expect(bodies(trail, 'station_implementation', 'run_2')).toEqual([
      'typed at implementation',
      'it failed',
      'try again',
      'it failed again',
      'try again once more',
    ]);
  });

  it('shows the same thread from each run at the station', () => {
    expect(bodies(trail, 'station_implementation', 'run_3')).toEqual(
      bodies(trail, 'station_implementation', 'run_2'),
    );
  });

  it('leaves out the notes of the other stations', () => {
    expect(bodies(trail, 'station_implementation', 'run_2')).not.toContain(
      'triage note',
    );
    expect(bodies(trail, 'station_implementation', 'run_2')).not.toContain(
      'code review note',
    );
  });

  it('keeps the notes written before the station was renamed', () => {
    const renamed = [
      {
        runId: null,
        stationId: 'station_implementation',
        station: 'Implementation',
        body: 'typed before the rename',
      },
      {
        runId: 'run_5',
        stationId: 'station_implementation',
        station: 'Build',
        body: 'ran after the rename',
      },
    ];

    expect(bodies(renamed, 'station_implementation', 'run_5')).toEqual([
      'typed before the rename',
      'ran after the rename',
    ]);
  });

  it('keeps apart two stations with the same name', () => {
    const twins = [
      {
        runId: null,
        stationId: 'station_review_1',
        station: 'Review',
        body: 'typed at the first review',
      },
      {
        runId: 'run_6',
        stationId: 'station_review_2',
        station: 'Review',
        body: 'ran at the second review',
      },
    ];

    expect(bodies(twins, 'station_review_2', 'run_6')).toEqual([
      'ran at the second review',
    ]);
  });

  it('takes only the notes of the run when it has no station', () => {
    expect(bodies(trail, null, 'run_3')).toEqual(['it failed again']);
  });

  it('finds nothing in an empty trail', () => {
    expect(threadAt([], 'station_triage', 'run_1')).toEqual([]);
  });
});
