import type { InboxNote } from '@work/application/ports/inbox-reader.port';
import type {
  MovedNote,
  RunReaderPort,
} from '@work/application/ports/run-reader.port';
import { ListTaskMovesHandler } from '@work/application/queries/handlers/list-task-moves.handler';
import { ListTaskMovesQuery } from '@work/application/queries/list-task-moves.query';
import {
  inWorkspace,
  runAccessWhere,
} from '@work/application/services/run-access.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const AT = new Date('2026-11-27T09:15:00.000Z');

const moved = (position: number, body: string, by: string): MovedNote => {
  const note: InboxNote = {
    position,
    kind: 'passed',
    form: 'words',
    voice: by === 'run' ? 'station' : 'world',
    station: 'Code Review',
    stationId: 'station_2',
    stationColor: '#edc12b',
    stationPosition: 2,
    runId: null,
    body,
    attachments: [],
    at: AT,
    author: null,
    coAuthors: [],
    source: null,
    deferredTo: null,
    readAt: null,
    approval: null,
    failure: null,
    connection: null,
    resumption: null,
    suggestsClosing: false,
  };

  return { note, move: { to: 'station_0', by } };
};

const listed = (found: readonly MovedNote[] | null, sees = true) =>
  new ListTaskMovesHandler(
    {
      listForTask: vi.fn(),
      listForTeam: vi.fn(),
      findForTeam: vi.fn(),
      notesFor: vi.fn(),
      taskNotesBetween: vi.fn(),
      taskMoves: vi.fn().mockResolvedValue(found && inWorkspace(found)),
      configFor: vi.fn(),
    } satisfies RunReaderPort,
    runAccessWhere(sees),
  ).execute(new ListTaskMovesQuery('task_1', 'user_1'));

describe('ListTaskMovesHandler', () => {
  it('lists the moves the line or a person made, and leaves out what a run passed on', async () => {
    const notes = await listed([
      moved(1, 'The work is done.', 'run'),
      moved(
        2,
        'Moved to Backlog: the pull request was closed without being merged.',
        'line',
      ),
      moved(4, 'Moved to Implementation.', 'person'),
    ]);

    expect(notes?.map((each) => each.body)).toEqual([
      'Moved to Backlog: the pull request was closed without being merged.',
      'Moved to Implementation.',
    ]);
    expect(notes?.[0]?.at).toBe(AT.toISOString());
  });

  it('finds nothing of a task the viewer cannot see', async () => {
    await expect(listed([], false)).resolves.toBeNull();
  });

  it('finds nothing of a task that does not exist', async () => {
    await expect(listed(null)).resolves.toBeNull();
  });
});
