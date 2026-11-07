import { taskViewOf } from '@integrations/application/ports/tasks-for-hooks.fake-spec';
import type {
  TasksForHooksPort,
  TaskView,
} from '@integrations/application/ports/tasks-for-hooks.port';
import { LifecycleHookTriggers } from '@integrations/application/services/lifecycle-hook-triggers.service';
import type {
  HookEventOccurred,
  QueueHookFirings,
} from '@integrations/application/services/queue-hook-firings.service';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TASK = taskViewOf();

const setUp = (task: TaskView | null = TASK) => {
  const queue = vi.fn(async (_happened: HookEventOccurred) => 1);
  const tasks = {
    of: vi.fn(async () => task),
    ofPullRequest: vi.fn(async () => task),
  } satisfies TasksForHooksPort;

  return {
    queue,
    tasks,
    triggers: new LifecycleHookTriggers(
      { queue } as unknown as QueueHookFirings,
      tasks,
    ),
  };
};

const PULL_REQUEST = 'https://github.com/acme/api/pull/7';

describe('LifecycleHookTriggers', () => {
  it('tells each use of a tool apart, so using one often is never read as a loop', async () => {
    const { triggers, queue } = setUp();
    const used = { tool: 'github.comment', event: { tool: 'github.comment' } };

    await triggers.toolUsed(TASK, used, 'call_1');
    await triggers.toolUsed(TASK, used, 'call_2');

    const [first, second] = queue.mock.calls.map(([each]) => each.change);
    expect(first).not.toBe(second);
    expect(first).toContain('github.comment');
    expect(queue.mock.calls[0]?.[0]).toMatchObject({
      on: 'tool.used',
      occurrence: 'call_1',
    });
  });

  it('fires the hooks of the task a run ended on', async () => {
    const { triggers, queue, tasks } = setUp();

    await triggers.runEnded({
      runId: 'run_1',
      taskId: 'task_1',
      outcome: 'handed-over',
    } as never);

    expect(tasks.of).toHaveBeenCalledWith(
      TaskId.of('task_1'),
      RunId.of('run_1'),
    );
    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({
        on: 'run.ended',
        occurrence: 'run-ended:run_1',
        event: { outcome: 'handed-over' },
      }),
    );
  });

  it('fires nothing for a run of no task, or a task gone', async () => {
    const taskless = setUp();
    const gone = setUp(null);

    await taskless.triggers.runEnded({
      runId: 'run_1',
      taskId: null,
      outcome: 'done',
    } as never);
    await gone.triggers.taskOpened({ taskId: 'task_1' } as never);

    expect(taskless.queue).not.toHaveBeenCalled();
    expect(gone.queue).not.toHaveBeenCalled();
  });

  it('fires on a task that moved, naming where from and to', async () => {
    const { triggers, queue } = setUp();

    await triggers.taskMoved({
      taskId: 'task_1',
      from: 'triage',
      to: 'build',
      at: '2026-09-26T10:00:00.000Z',
    } as never);

    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({
        on: 'task.moved',
        change: 'triage → build',
        event: { from: 'triage', to: 'build' },
      }),
    );
  });

  it('fires on a merged pull request, matching it once its changes are known', async () => {
    const { triggers, queue, tasks } = setUp();

    await triggers.pullRequestClosed({
      workspaceId: 'workspace_1',
      pullRequest: PULL_REQUEST,
      repository: 'acme/api',
      mergeCommit: 'abc',
      merged: true,
    } as never);
    await triggers.pullRequestClosed({
      workspaceId: 'workspace_1',
      pullRequest: PULL_REQUEST,
      merged: false,
    } as never);

    expect(tasks.ofPullRequest).toHaveBeenCalledOnce();
    expect(tasks.ofPullRequest).toHaveBeenCalledWith(
      WorkspaceId.of('workspace_1'),
      PullRequestUrl.of(PULL_REQUEST),
    );
    expect(queue).toHaveBeenCalledOnce();
    expect(queue).toHaveBeenCalledWith(
      expect.objectContaining({
        on: 'pull-request.merged',
        matchedLater: true,
        event: {
          url: PULL_REQUEST,
          repository: 'acme/api',
          mergeCommit: 'abc',
        },
      }),
    );
  });
});
