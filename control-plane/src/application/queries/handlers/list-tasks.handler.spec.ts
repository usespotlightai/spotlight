import type {
  TaskReaderPort,
  TaskSummary,
} from '@application/ports/task-reader.port';
import { ListTasksHandler } from '@application/queries/handlers/list-tasks.handler';
import { ListTasksQuery } from '@application/queries/list-tasks.query';
import { describe, expect, it, vi } from 'vitest';

const raised = new Date('2026-08-27T09:15:00.000Z');

const standing: TaskSummary[] = [
  {
    id: 'task_1',
    stationId: 'station_1',
    title: 'Fix the queue',
    description: null,
    createdAt: raised,
    running: false,
    awaitingReview: false,
    raisedBy: null,
    note: null,
  },
  {
    id: 'task_2',
    stationId: 'station_2',
    title: 'Write the spec',
    description: '## Steps',
    createdAt: raised,
    running: false,
    awaitingReview: false,
    raisedBy: null,
    note: null,
  },
];

const asDto = (summary: TaskSummary) => ({
  ...summary,
  createdAt: summary.createdAt.toISOString(),
});

const reader = (result: TaskSummary[] | null): TaskReaderPort => ({
  listForTeamMember: vi.fn().mockResolvedValue(result),
});

const handle = (tasks: TaskReaderPort) =>
  new ListTasksHandler(tasks).execute(new ListTasksQuery('team_1', 'user_1'));

describe('ListTasksHandler', () => {
  it('hands back each task with the station it stands at', async () => {
    await expect(handle(reader(standing))).resolves.toEqual(
      standing.map(asDto),
    );
  });

  it('answers with nothing for a team the caller cannot see', async () => {
    await expect(handle(reader(null))).resolves.toBeNull();
  });

  it('answers with an empty board rather than nothing', async () => {
    await expect(handle(reader([]))).resolves.toEqual([]);
  });
});
