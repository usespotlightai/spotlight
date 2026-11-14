import { FIRST_PAGE } from '@work/application/dto/page.dto';
import type {
  TaskReaderPort,
  TaskSummary,
} from '@work/application/ports/task-reader.port';
import { ListTasksHandler } from '@work/application/queries/handlers/list-tasks.handler';
import { ListTasksQuery } from '@work/application/queries/list-tasks.query';
import type { WorkAccess } from '@work/application/services/work-access.service';
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
    pullRequests: [],
    createdBy: null,
    assignee: null,
    note: null,
    source: null,
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
    pullRequests: [],
    createdBy: null,
    assignee: null,
    note: null,
    source: null,
  },
];

const asDto = (summary: TaskSummary) => ({
  ...summary,
  createdAt: summary.createdAt.toISOString(),
});

const reader = (result: TaskSummary[]): TaskReaderPort => ({
  listForTeam: vi.fn().mockResolvedValue({ items: result, next: null }),
  findInTeam: vi.fn(),
});

const seeing = (sees = true): WorkAccess =>
  ({ seesTeam: vi.fn(async () => sees) }) as unknown as WorkAccess;

const handle = (tasks: TaskReaderPort, access = seeing()) =>
  new ListTasksHandler(tasks, access).execute(
    new ListTasksQuery('team_1', 'user_1', 'board', null, FIRST_PAGE),
  );

describe('ListTasksHandler', () => {
  it('hands back each task with the station it is at', async () => {
    await expect(handle(reader(summaries))).resolves.toEqual({
      items: summaries.map(asDto),
      next: null,
    });
  });

  it('answers with nothing for a team the caller cannot see', async () => {
    await expect(handle(reader([]), seeing(false))).resolves.toBeNull();
  });

  it('asks the reader for the open tasks', async () => {
    const tasks = reader([]);

    await handle(tasks);

    expect(tasks.listForTeam).toHaveBeenCalledWith(expect.anything(), {
      state: 'board',
    });
  });

  it('asks the reader for a page of completed tasks on a line', async () => {
    const tasks = reader([]);

    await new ListTasksHandler(tasks, seeing()).execute(
      new ListTasksQuery(
        'team_1',
        'user_1',
        'completed-station',
        'line_1',
        FIRST_PAGE,
      ),
    );

    expect(tasks.listForTeam).toHaveBeenCalledWith(expect.anything(), {
      state: 'completed-station',
      lineId: 'line_1',
      page: FIRST_PAGE,
    });
  });

  it('answers with an empty board rather than nothing', async () => {
    await expect(handle(reader([]))).resolves.toEqual({
      items: [],
      next: null,
    });
  });
});
