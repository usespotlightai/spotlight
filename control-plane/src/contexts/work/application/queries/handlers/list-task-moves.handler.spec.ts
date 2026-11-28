import type {
  RunReaderPort,
  TaskMoveSummary,
} from '@work/application/ports/run-reader.port';
import { ListTaskMovesHandler } from '@work/application/queries/handlers/list-task-moves.handler';
import { ListTaskMovesQuery } from '@work/application/queries/list-task-moves.query';
import {
  inWorkspace,
  runAccessWhere,
} from '@work/application/services/run-access.fake-spec';
import { describe, expect, it, vi } from 'vitest';

const AT = new Date('2026-11-27T09:15:00.000Z');
const ADA = { id: 'user_1', name: 'Ada Lovelace', image: null };

const moved = (
  position: number,
  station: string,
  move: TaskMoveSummary['move'],
): TaskMoveSummary => ({
  position,
  at: AT,
  move,
  station,
  person: move.who === null ? null : ADA,
});

const listed = (found: readonly TaskMoveSummary[] | null, sees = true) =>
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
    const moves = await listed([
      moved(1, 'Code Review', {
        to: 'station_2',
        by: 'run',
        who: null,
        why: null,
      }),
      moved(2, 'Backlog', {
        to: 'station_0',
        by: 'line',
        who: null,
        why: 'The pull request was closed without being merged.',
      }),
      moved(4, 'Implementation', {
        to: 'station_1',
        by: 'person',
        who: 'user_1',
        why: 'Rebase it.',
      }),
    ]);

    expect(moves).toEqual([
      {
        position: 2,
        at: AT.toISOString(),
        station: 'Backlog',
        by: 'line',
        person: null,
        why: 'The pull request was closed without being merged.',
      },
      {
        position: 4,
        at: AT.toISOString(),
        station: 'Implementation',
        by: 'person',
        person: ADA,
        why: 'Rebase it.',
      },
    ]);
  });

  it('finds nothing of a task the viewer cannot see', async () => {
    await expect(listed([], false)).resolves.toBeNull();
  });

  it('finds nothing of a task that does not exist', async () => {
    await expect(listed(null)).resolves.toBeNull();
  });
});
