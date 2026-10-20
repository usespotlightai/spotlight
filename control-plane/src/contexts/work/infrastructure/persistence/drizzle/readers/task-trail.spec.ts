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
    { runId: 'run_1', station: 'Triage', body: 'triage note' },
    { runId: null, station: 'Implementation', body: 'typed at implementation' },
    { runId: 'run_2', station: 'Implementation', body: 'it failed' },
    { runId: null, station: 'Implementation', body: 'try again' },
    { runId: 'run_3', station: 'Implementation', body: 'it failed again' },
    { runId: null, station: 'Implementation', body: 'try again once more' },
    { runId: 'run_4', station: 'Code review', body: 'code review note' },
  ];

  const bodies = (station: string | null, runId: string) =>
    threadAt(trail, station, runId).map((each) => each.body);

  it('takes every note at the station of the run', () => {
    expect(bodies('Implementation', 'run_2')).toEqual([
      'typed at implementation',
      'it failed',
      'try again',
      'it failed again',
      'try again once more',
    ]);
  });

  it('shows the same thread from each run at the station', () => {
    expect(bodies('Implementation', 'run_3')).toEqual(
      bodies('Implementation', 'run_2'),
    );
  });

  it('leaves out the notes of the other stations', () => {
    expect(bodies('Implementation', 'run_2')).not.toContain('triage note');
    expect(bodies('Implementation', 'run_2')).not.toContain('code review note');
  });

  it('takes only the notes of the run when it has no station', () => {
    expect(bodies(null, 'run_3')).toEqual(['it failed again']);
  });

  it('finds nothing in an empty trail', () => {
    expect(threadAt([], 'Triage', 'run_1')).toEqual([]);
  });
});
