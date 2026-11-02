import type { CheckRunsPort } from '@github/application/ports/check-runs.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import { ChecksToolUse } from '@work/application/services/checks.tool-use';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { NoPullRequestError } from '@work/domain/exceptions/no-pull-request.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { describe, expect, it, vi } from 'vitest';

const CONTEXT: TaskToolContext = {
  kind: 'task',
  runId: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  taskId: TaskId.of('task_1'),
  stationId: StationId.of('station_1'),
  requester: null,
};

const PULL_REQUEST = PullRequestUrl.of('https://github.com/acme/api/pull/7');

const FAILED = {
  commit: 'abc123',
  failed: [
    {
      name: 'web / build',
      conclusion: 'failure',
      url: 'https://github.com/acme/api/actions/runs/1/job/2',
      step: 'Build',
      summary: null,
      log: 'error TS2322',
    },
  ],
};

const using = (task: Pick<Task, 'pullRequest'> | null) => {
  const checkRuns = {
    failedOn: vi.fn(async () => FAILED),
    failedInSuite: vi.fn(),
  } satisfies CheckRunsPort;
  const tasks = {
    find: vi.fn(async () => task),
  } as unknown as TaskRepository;

  return { checkRuns, tool: new ChecksToolUse(tasks, checkRuns) };
};

describe('ChecksToolUse', () => {
  it('is the checks tool', () => {
    expect(using(null).tool.tool.value).toBe('checks');
  });

  it('answers with the failed checks on the pull request of the task', async () => {
    const { tool, checkRuns } = using({ pullRequest: PULL_REQUEST });

    expect(await tool.call(CONTEXT)).toEqual({
      pullRequest: 'https://github.com/acme/api/pull/7',
      ...FAILED,
    });
    expect(checkRuns.failedOn).toHaveBeenCalledWith(
      CONTEXT.workspaceId,
      PULL_REQUEST,
    );
  });

  it('refuses a task without a pull request', async () => {
    const { tool, checkRuns } = using({ pullRequest: null });

    await expect(tool.call(CONTEXT)).rejects.toThrow(NoPullRequestError);
    expect(checkRuns.failedOn).not.toHaveBeenCalled();
  });

  it('refuses a task it cannot find', async () => {
    await expect(using(null).tool.call(CONTEXT)).rejects.toThrow(
      UnknownTaskError,
    );
  });
});
