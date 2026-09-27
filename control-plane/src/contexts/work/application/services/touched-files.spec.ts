import type { PullRequestPort } from '@github/application/ports/pull-request.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { RunJournal } from '@work/application/contracts/run-journal.contract';
import type { RunJournalReaderPort } from '@work/application/ports/run-journal-reader.port';
import { TouchedFiles } from '@work/application/services/touched-files';
import type { Line } from '@work/domain/aggregates/line.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import { RunSpec } from '@work/domain/value-objects/run-spec.vo';
import { describe, expect, it, vi } from 'vitest';

const API = Repository.of('acme/api');
const PULL = PullRequestUrl.of('https://github.com/acme/api/pull/7');

const spec = RunSpec.of({
  checkouts: [{ remote: 'spotlight:repository', path: 'api' }],
  command: { executable: 'claude', args: [] },
  briefing: 'Fix it.',
  handover: { options: [], noteLimit: 0 },
  continuity: { key: 'task_1' },
});

const journal = (runId: string, paths: string[]) =>
  ({
    runId,
    steps: paths.map((path) => ({
      kind: 'tool',
      change: { path, before: 'a', after: 'b' },
    })),
  }) as unknown as RunJournal;

const touching = (input: {
  journals: RunJournal[];
  pullRequest?: PullRequestUrl | null;
  changedIn?: () => Promise<readonly string[]>;
}) => {
  const warn = vi.fn();
  const files = new TouchedFiles(
    {
      findById: async (id: RunId) => ({ id, spec }),
    } as unknown as RunRepository,
    { ofTask: async () => input.journals } as unknown as RunJournalReaderPort,
    {
      changedIn: input.changedIn ?? (async () => []),
    } as unknown as PullRequestPort,
    { debug: vi.fn(), info: vi.fn(), warn, error: vi.fn() },
  );
  const task = {
    id: TaskId.of('task_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    reviewed: null,
    pullRequest: input.pullRequest ?? null,
  } as unknown as Task;
  const line = { repositories: { all: [API] } } as unknown as Line;

  return { warn, onTask: () => files.onTask(task, line) };
};

const listed = (files: readonly { repository: Repository; path: string }[]) =>
  files.map((each) => `${each.repository.value}:${each.path}`);

describe('TouchedFiles', () => {
  it('names each file earlier runs of the task changed, once, in its repository', async () => {
    const { onTask } = touching({
      journals: [
        journal('run_1', ['/runs/run_1/api/src/uploads.ts', '/tmp/scratch']),
        journal('run_2', [
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

  it('adds the files of the task’s pull request', async () => {
    const { onTask } = touching({
      journals: [],
      pullRequest: PULL,
      changedIn: async () => ['docs/retries.md'],
    });

    expect(listed(await onTask())).toEqual(['acme/api:docs/retries.md']);
  });

  it('goes on without the pull request’s files when GitHub does not give them', async () => {
    const { onTask, warn } = touching({
      journals: [journal('run_1', ['/runs/run_1/api/src/uploads.ts'])],
      pullRequest: PULL,
      changedIn: async () => {
        throw new Error('GitHub is down');
      },
    });

    expect(listed(await onTask())).toEqual(['acme/api:src/uploads.ts']);
    expect(warn).toHaveBeenCalled();
  });
});
