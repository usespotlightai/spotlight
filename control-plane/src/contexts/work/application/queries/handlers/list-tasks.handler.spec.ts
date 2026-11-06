import { FIRST_PAGE } from '@shared-kernel/application/dto/page.dto';
import type {
  TaskReaderPort,
  TaskSummary,
} from '@work/application/ports/task-reader.port';
import { ListTasksHandler } from '@work/application/queries/handlers/list-tasks.handler';
import { ListTasksQuery } from '@work/application/queries/list-tasks.query';
import { describe, expect, it, vi } from 'vitest';

const created = new Date('2026-08-27T09:15:00.000Z');

const summaries: TaskSummary[] = [
  {
    id: 'task_1',
    revision: 0,
    stationId: 'station_1',
    title: 'Fix the queue',
    description: null,
    attachments: [],
    createdAt: created,
    progress: null,
    awaitingReview: null,
    pullRequest: null,
    createdBy: null,
    assignee: null,
    note: null,
  },
  {
    id: 'task_2',
    revision: 0,
    stationId: 'station_2',
    title: 'Write the spec',
    description: '## Steps',
    attachments: [],
    createdAt: created,
    progress: null,
    awaitingReview: null,
    pullRequest: null,
    createdBy: null,
    assignee: null,
    note: null,
  },
];

const asDto = (summary: TaskSummary) => ({
  ...summary,
  createdAt: summary.createdAt.toISOString(),
});

const reader = (result: TaskSummary[] | null): TaskReaderPort => ({
  listForTeamMember: vi
    .fn()
    .mockResolvedValue(result && { items: result, next: null }),
  findForTeamMember: vi.fn(),
});

const handle = (tasks: TaskReaderPort) =>
  new ListTasksHandler(tasks).execute(
    new ListTasksQuery('team_1', 'user_1', 'open', null, FIRST_PAGE),
  );

describe('ListTasksHandler', () => {
  it('hands back each task with the station it is at', async () => {
    await expect(handle(reader(summaries))).resolves.toEqual({
      items: summaries.map(asDto),
      next: null,
    });
  });

  it('answers with nothing for a team the caller cannot see', async () => {
    await expect(handle(reader(null))).resolves.toBeNull();
  });

  it('asks the reader for the open tasks', async () => {
    const tasks = reader([]);

    await handle(tasks);

    expect(tasks.listForTeamMember).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { state: 'open' },
    );
  });

  it('asks the reader for a page of completed tasks on a line', async () => {
    const tasks = reader([]);

    await new ListTasksHandler(tasks).execute(
      new ListTasksQuery('team_1', 'user_1', 'completed', 'line_1', FIRST_PAGE),
    );

    expect(tasks.listForTeamMember).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      { state: 'completed', lineId: 'line_1', page: FIRST_PAGE },
    );
  });

  it('answers with an empty board rather than nothing', async () => {
    await expect(handle(reader([]))).resolves.toEqual({
      items: [],
      next: null,
    });
  });
});
