import { HARNESS_CONNECTED } from '@runs/domain/value-objects/journal-entry-type';
import { ChangedPaths } from '@runs/infrastructure/journal/changed-paths';
import type { Journalled } from '@runs/infrastructure/journal/journalled';
import { describe, expect, it } from 'vitest';

const encoded = (value: unknown): string =>
  Buffer.from(JSON.stringify(value)).toString('base64');

type Row = Omit<Journalled, 'at'> & { readonly attempt: number };

const event = (
  type: string,
  data: Record<string, unknown>,
  attempt = 1,
): Row => ({
  type,
  message: null,
  data: encoded(data),
  attempt,
});

const connected = (events = 1, attempt = 1) =>
  event(
    HARNESS_CONNECTED,
    {
      protocol: 'acp/1',
      events,
      reports: {
        background: false,
        selfStartedTurns: false,
        turnUsage: true,
        commandOutput: false,
      },
    },
    attempt,
  );

const called = (id: string, attempt = 1) =>
  event('tool.changed', { id, title: 'Edit', status: 'pending' }, attempt);

const edited = (id: string, paths: string[], attempt = 1) =>
  event(
    'tool.changed',
    {
      id,
      title: 'Edit',
      status: 'completed',
      output: 'a long tool output',
      files: paths.map((path) => ({
        path,
        operation: 'update',
        before: 'before',
        after: 'after',
      })),
    },
    attempt,
  );

const play = (...rows: Row[]) => {
  const changed = new ChangedPaths();
  for (const each of rows) {
    changed.take(each);
  }
  return changed.paths();
};

const read = (...rows: Row[]) => play(connected(), ...rows);

describe('ChangedPaths', () => {
  it('names the file each tool call changed, in the order the calls were made', () => {
    expect(
      read(
        called('call_1'),
        called('call_2'),
        edited('call_2', ['/runs/run_1/api/src/retry.ts']),
        edited('call_1', ['/runs/run_1/api/src/uploads.ts']),
      ),
    ).toEqual([
      '/runs/run_1/api/src/uploads.ts',
      '/runs/run_1/api/src/retry.ts',
    ]);
  });

  it('keeps the files a call last changed', () => {
    expect(
      read(
        called('call_1'),
        edited('call_1', ['/runs/run_1/api/src/draft.ts']),
        edited('call_1', [
          '/runs/run_1/api/src/uploads.ts',
          '/runs/run_1/api/x.ts',
        ]),
        event('tool.changed', {
          id: 'call_1',
          title: 'Edit',
          status: 'completed',
        }),
      ),
    ).toEqual(['/runs/run_1/api/src/uploads.ts', '/runs/run_1/api/x.ts']);
  });

  it('names nothing for a change that has not completed', () => {
    expect(
      read(
        event('tool.changed', {
          id: 'call_1',
          title: 'Edit',
          status: 'in_progress',
          files: [
            { path: '/runs/run_1/api/src/early.ts', operation: 'create' },
          ],
        }),
      ),
    ).toEqual([]);
  });

  it('reads the events of a harness once it connected', () => {
    expect(
      play(
        connected(),
        called('call_1'),
        edited('call_1', ['/runs/run_1/api/src/uploads.ts']),
      ),
    ).toEqual(['/runs/run_1/api/src/uploads.ts']);
  });

  it('reads no events of a version it does not know', () => {
    expect(
      play(
        connected(9),
        called('call_1'),
        edited('call_1', ['/runs/run_1/api/src/uploads.ts']),
      ),
    ).toEqual([]);
  });

  it('reads each attempt by its own connection', () => {
    expect(
      play(
        connected(9, 1),
        edited('call_1', ['/runs/run_1/api/src/lost.ts'], 1),
        connected(1, 2),
        edited('call_2', ['/runs/run_1/api/src/kept.ts'], 2),
        edited('call_3', ['/runs/run_1/api/src/unread.ts'], 3),
      ),
    ).toEqual(['/runs/run_1/api/src/kept.ts']);
  });

  it('passes over what it cannot read', () => {
    expect(
      read(
        {
          type: 'tool.changed',
          message: null,
          data: Buffer.from('not json').toString('base64'),
          attempt: 1,
        },
        event('message', { id: 'm1', role: 'agent', text: 'Done' }),
        {
          type: 'output',
          message: 'prepare',
          data: Buffer.from('Cloning…').toString('base64'),
          attempt: 1,
        },
      ),
    ).toEqual([]);
  });
});
