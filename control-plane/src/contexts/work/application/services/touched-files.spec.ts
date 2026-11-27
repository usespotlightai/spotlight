import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import type { RunChanges } from '@runs/application/contracts/run-journal.contract';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { cannedJournalReadings as runJournalReadings } from '@work/application/ports/runs.fake-spec';
import { TouchedFiles } from '@work/application/services/touched-files';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import type { LineRepositories } from '@work/domain/value-objects/line-repositories.vo';
import { describe, expect, it, vi } from 'vitest';

const API = Repository.of('acme/api');
const WEB = Repository.of('acme/web');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');

const changes = (runId: string, workingCopyPaths: string[]): RunChanges => ({
  runId,
  checkouts: [],
  paths: workingCopyPaths,
});

const touching = (input: {
  changes: RunChanges[];
  pullRequests?: readonly PullRequestUrl[];
  changedIn?: (
    workspaceId: WorkspaceId,
    repository: Repository,
    url: PullRequestUrl,
  ) => Promise<readonly string[]>;
  sleep?: (ms: number, cancelled?: AbortSignal) => Promise<void>;
}) => {
  const warn = vi.fn();
  const files = new TouchedFiles(
    partial<RunJournalReaderPort>({
      changesOfTask: async () => input.changes,
    }),
    partial<PullRequestPort>({
      changedIn: input.changedIn ?? (async () => []),
    }),
    { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() },
    {
      now: () => new Date(),
      sleep: input.sleep ?? (() => new Promise(() => {})),
    },
    runJournalReadings({ workingCopyPathsIn: (changed) => changed.paths }),
  );
  const task = partial<Task>({
    id: TaskId.of('task_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    reviewedHead: null,
    pullRequests: input.pullRequests ?? [],
  });
  const line = partial<LineMap>({
    repositories: partial<LineRepositories>({ all: [API, WEB] }),
  });

  return { warn, onTask: () => files.onTask(task, line) };
};

const listed = (files: readonly { repository: Repository; path: string }[]) =>
  files.map((each) => `${each.repository.value}:${each.path}`);

describe('TouchedFiles', () => {
  it('names each file earlier runs of the task changed, once, in its repository', async () => {
    const { onTask } = touching({
      changes: [
        changes('run_1', ['api/src/uploads.ts']),
        changes('run_2', ['api/src/uploads.ts', 'api/src/retry.ts']),
      ],
    });

    expect(listed(await onTask())).toEqual([
      'acme/api:src/uploads.ts',
      'acme/api:src/retry.ts',
    ]);
  });

  it('places each file in the repository of its working copy, and leaves out folders of no repository', async () => {
    const { onTask } = touching({
      changes: [
        changes('run_1', ['api/src/uploads.ts']),
        changes('run_2', ['web/src/Upload.tsx', 'docs/uploads.md']),
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
      pullRequests: [PULL],
      changedIn: async () => ['docs/retries.md'],
    });

    expect(listed(await onTask())).toEqual(['acme/api:docs/retries.md']);
  });

  it('adds the files of each of the task’s pull requests, in its repository', async () => {
    const { onTask } = touching({
      changes: [],
      pullRequests: [
        PULL,
        PullRequestUrl.of('https://github.com/acme/web/pull/2'),
      ],
      changedIn: async (_workspaceId, repository) =>
        repository.equals(API) ? ['src/retry.ts'] : ['src/Retry.tsx'],
    });

    expect(listed(await onTask())).toEqual([
      'acme/api:src/retry.ts',
      'acme/web:src/Retry.tsx',
    ]);
  });

  it('stops waiting for GitHub once it has answered', async () => {
    let waiting: AbortSignal | undefined;
    const { onTask } = touching({
      changes: [],
      pullRequests: [PULL],
      changedIn: async () => ['docs/retries.md'],
      sleep: (_ms, cancelled) => {
        waiting = cancelled;
        return new Promise(() => {});
      },
    });

    await onTask();

    expect(waiting?.aborted).toBe(true);
  });

  it('goes on without the pull request’s files when GitHub does not send them', async () => {
    const { onTask, warn } = touching({
      changes: [changes('run_1', ['api/src/uploads.ts'])],
      pullRequests: [PULL],
      changedIn: async () => {
        throw new Error('GitHub is down');
      },
    });

    expect(listed(await onTask())).toEqual(['acme/api:src/uploads.ts']);
    expect(warn).toHaveBeenCalled();
  });

  it('goes on without the pull request’s files once GitHub keeps it waiting too long', async () => {
    const { onTask, warn } = touching({
      changes: [changes('run_1', ['api/src/uploads.ts'])],
      pullRequests: [PULL],
      changedIn: () => new Promise(() => {}),
      sleep: async () => {},
    });

    expect(listed(await onTask())).toEqual(['acme/api:src/uploads.ts']);
    expect(warn).toHaveBeenCalled();
  });
});
