import type { CheckRunsPort } from '@github/application/ports/check-runs.port';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import type { TaskToolContext } from '@work/application/ports/integration-tools.port';
import type { TaskLookupReaderPort } from '@work/application/ports/task-lookup-reader.port';
import { ChecksToolUse } from '@work/application/services/checks.tool-use';
import { NoPullRequestError } from '@work/domain/exceptions/no-pull-request.error';
import { UnknownTaskError } from '@work/domain/exceptions/unknown-task.error';
import { PullRequestLink } from '@work/domain/value-objects/pull-request-link.vo';
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

const DOCS = PullRequestUrl.of('https://github.com/acme/docs/pull/3');

const using = (
  task: {
    pullRequest: PullRequestUrl | null;
    later?: readonly PullRequestUrl[];
  } | null,
) => {
  const checkRuns = {
    failedOn: vi.fn(
      async (_workspaceId: WorkspaceId, _pullRequest: PullRequestUrl) => FAILED,
    ),
    failedInSuite: vi.fn(),
  } satisfies CheckRunsPort;
  const tasks = {
    find: vi.fn(async () =>
      task
        ? {
            pullRequestLink: task.pullRequest
              ? PullRequestLink.opened(task.pullRequest)
              : null,
            laterPullRequests: task.later ?? [],
          }
        : null,
    ),
  } as unknown as TaskLookupReaderPort;

  return { checkRuns, tool: new ChecksToolUse(tasks, checkRuns) };
};

describe('ChecksToolUse', () => {
  it('is the checks tool', () => {
    expect(using(null).tool.tool.value).toBe('checks');
  });

  it('answers with the failed checks on the pull request of the task', async () => {
    const { tool, checkRuns } = using({ pullRequest: PULL_REQUEST });

    expect(await tool.call(CONTEXT)).toEqual({
      pullRequests: [
        { pullRequest: 'https://github.com/acme/api/pull/7', ...FAILED },
      ],
    });
    expect(checkRuns.failedOn).toHaveBeenCalledWith(
      CONTEXT.workspaceId,
      PULL_REQUEST,
    );
  });

  it('answers for each pull request of the task, the first first', async () => {
    const { tool, checkRuns } = using({
      pullRequest: PULL_REQUEST,
      later: [DOCS],
    });

    const answered = (await tool.call(CONTEXT)) as {
      pullRequests: { pullRequest: string }[];
    };

    expect(answered.pullRequests.map((each) => each.pullRequest)).toEqual([
      PULL_REQUEST.value,
      DOCS.value,
    ]);
    expect(checkRuns.failedOn).toHaveBeenCalledWith(CONTEXT.workspaceId, DOCS);
  });

  it('answers for the other pull requests where GitHub fails for one', async () => {
    const { tool, checkRuns } = using({
      pullRequest: PULL_REQUEST,
      later: [DOCS],
    });
    checkRuns.failedOn.mockImplementation(async (_workspaceId, pullRequest) => {
      if (pullRequest === DOCS) {
        throw new Error('GitHub did not answer');
      }
      return FAILED;
    });

    expect(await tool.call(CONTEXT)).toEqual({
      pullRequests: [
        { pullRequest: PULL_REQUEST.value, ...FAILED },
        { pullRequest: DOCS.value, error: 'GitHub did not answer' },
      ],
    });
  });

  it('fails where GitHub fails for every pull request', async () => {
    const { tool, checkRuns } = using({ pullRequest: PULL_REQUEST });
    checkRuns.failedOn.mockRejectedValue(new Error('GitHub did not answer'));

    await expect(tool.call(CONTEXT)).rejects.toThrow('GitHub did not answer');
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
