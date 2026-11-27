import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskPullRequestSummariesPort } from '@work/application/ports/task-pull-request-summaries.port';
import type {
  TaskReaderPort,
  TaskSummary,
} from '@work/application/ports/task-reader.port';
import { ListTaskPullRequestsHandler } from '@work/application/queries/handlers/list-task-pull-requests.handler';
import { ListTaskPullRequestsQuery } from '@work/application/queries/list-task-pull-requests.query';
import type {
  SeenTeam,
  WorkAccess,
} from '@work/application/services/work-access.service';
import { describe, expect, it, vi } from 'vitest';

const MERGED = 'https://github.com/acme/api/pull/7';
const UNSEEN = 'https://github.com/acme/web/pull/3';
const WORKSPACE = WorkspaceId.of('ws_1');

const task: TaskSummary = {
  id: 'task_1',
  revision: 0,
  stationId: 'station_1',
  title: 'Fix the queue',
  description: null,
  attachments: [],
  createdAt: new Date('2026-11-20T09:15:00.000Z'),
  progress: null,
  awaitingReview: null,
  finished: false,
  running: false,
  pullRequests: [MERGED, UNSEEN],
  createdBy: null,
  assignee: null,
  note: null,
  source: null,
  hold: null,
  runNotStarted: null,
};

const reader = (found: TaskSummary | null): TaskReaderPort => ({
  listForTeam: vi.fn(),
  findInTeam: vi.fn().mockResolvedValue(found),
});

const seeing = (sees = true): WorkAccess =>
  partial<WorkAccess>({
    seenTeam: vi.fn(() =>
      Promise.resolve(
        sees ? partial<SeenTeam>({ workspaceId: WORKSPACE }) : null,
      ),
    ),
  });

const MERGED_SUMMARY = {
  state: 'merged' as const,
  title: 'Fix the queue',
  author: 'octocat',
  authorImage: 'https://github.com/octocat.png?size=64',
  additions: 12,
  deletions: 3,
  changedFiles: 2,
  updatedAt: new Date('2026-11-21T10:00:00.000Z'),
};

const summaries: TaskPullRequestSummariesPort = {
  of: vi.fn(() => Promise.resolve(new Map([[MERGED, MERGED_SUMMARY]]))),
};

const handle = (tasks: TaskReaderPort, access = seeing()) =>
  new ListTaskPullRequestsHandler(tasks, summaries, access).execute(
    new ListTaskPullRequestsQuery('team_1', 'task_1', 'user_1'),
  );

describe('ListTaskPullRequestsHandler', () => {
  it('hands back each pull request of the task with its summary, null where GitHub has not told it yet', async () => {
    await expect(handle(reader(task))).resolves.toEqual([
      { url: MERGED, summary: MERGED_SUMMARY },
      { url: UNSEEN, summary: null },
    ]);
    expect(summaries.of).toHaveBeenCalledWith(WORKSPACE, [
      expect.objectContaining({ value: MERGED }),
      expect.objectContaining({ value: UNSEEN }),
    ]);
  });

  it('answers with nothing for a team the caller cannot see', async () => {
    await expect(handle(reader(task), seeing(false))).resolves.toBeNull();
  });

  it('answers with nothing for a task that is not in the team', async () => {
    await expect(handle(reader(null))).resolves.toBeNull();
  });
});
