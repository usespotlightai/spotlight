import type { InboxNote } from '@work/application/ports/inbox-reader.port';
import { failureIn } from '@work/infrastructure/persistence/drizzle/readers/task-trail';
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
