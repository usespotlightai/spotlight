import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunChanges } from '@work/application/contracts/run-journal.contract';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { TouchedFiles } from '@work/application/services/touched-files';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { describe, expect, it, vi } from 'vitest';

const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');

const changes = (
  runId: string,
  paths: string[],
  checkouts: string[] = ['api'],
): RunChanges => ({ runId, checkouts, paths });

const touching = (input: {
  changes: RunChanges[];
  pullRequest?: PullRequestUrl | null;
  changedIn?: () => Promise<readonly string[]>;
  sleep?: (ms: number, cancelled?: AbortSignal) => Promise<void>;
}) => {
  const warn = vi.fn();
  const files = new TouchedFiles(
    {
      changesOfTask: async () => input.changes,
    } as unknown as RunJournalReaderPort,
    {
      changedIn: input.changedIn ?? (async () => []),
    } as unknown as PullRequestPort,
    { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() },
    {
      now: () => new Date(),
      sleep: input.sleep ?? (() => new Promise(() => {})),
    },
  );
  const task = {
    id: TaskId.of('task_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    reviewedHead: null,
    pullRequest: input.pullRequest ?? null,
  } as unknown as Task;
  const line = { repositories: { all: [API, WEB] } } as unknown as Line;

  return { warn, onTask: () => files.onTask(task, line) };
};

const listed = (files: readonly { repository: Repository; path: string }[]) =>
  files.map((each) => `${each.repository.value}:${each.path}`);

describe('TouchedFiles', () => {
  it('names each file earlier runs of the task changed, once, in its repository', async () => {
    const { onTask } = touching({
      changes: [
        changes('run_1', ['/runs/run_1/api/src/uploads.ts', '/tmp/scratch']),
        changes('run_2', [
          '/runs/run_2/api/src/uploads.ts',
          '/runs/run_2/api/src/retry.ts',
        ]),
      ],
    });

    expect(listed(await onTask())).toEqual([
      'acme/api:src/uploads.ts',
      'acme/api:src/retry.ts',
    ]);
  });

  it('places each run’s files by that run’s own checkouts', async () => {
    const { onTask } = touching({
      changes: [
        changes('run_1', ['/runs/run_1/api/src/uploads.ts']),
        changes(
          'run_2',
          [
            '/runs/run_2/web/src/Upload.tsx',
            '/runs/run_2/api/src/retry.ts',
            '/runs/run_2/docs/uploads.md',
          ],
          ['web', 'docs'],
        ),
      ],
    });

    expect(listed(await onTask())).toEqual([
      'acme/api:src/uploads.ts',
      'acme/web:src/Upload.tsx',
    ]);
  });

  it('adds the files of the task’s pull request', async () => {
    const { onTask } = touching({
      changes: [],
      pullRequest: PULL,
      changedIn: async () => ['docs/retries.md'],
    });

    expect(listed(await onTask())).toEqual(['acme/api:docs/retries.md']);
  });

  it('stops waiting for GitHub once it has answered', async () => {
    let waiting: AbortSignal | undefined;
    const { onTask } = touching({
      changes: [],
      pullRequest: PULL,
      changedIn: async () => ['docs/retries.md'],
      sleep: (_ms, cancelled) => {
        waiting = cancelled;
        return new Promise(() => {});
      },
    });

    await onTask();

    expect(waiting?.aborted).toBe(true);
  });

  it('goes on without the pull request’s files when GitHub does not give them', async () => {
    const { onTask, warn } = touching({
      changes: [changes('run_1', ['/runs/run_1/api/src/uploads.ts'])],
      pullRequest: PULL,
      changedIn: async () => {
        throw new Error('GitHub is down');
      },
    });

    expect(listed(await onTask())).toEqual(['acme/api:src/uploads.ts']);
    expect(warn).toHaveBeenCalled();
  });

  it('goes on without the pull request’s files once GitHub keeps it waiting too long', async () => {
    const { onTask, warn } = touching({
      changes: [changes('run_1', ['/runs/run_1/api/src/uploads.ts'])],
      pullRequest: PULL,
      changedIn: () => new Promise(() => {}),
      sleep: async () => {},
    });

    expect(listed(await onTask())).toEqual(['acme/api:src/uploads.ts']);
    expect(warn).toHaveBeenCalled();
  });
});
