import { taskViewOf } from '@integrations/application/ports/tasks-for-hooks.fake-spec';
import type {
  LinkedTaskView,
  TasksForHooksPort,
  TaskView,
} from '@integrations/application/ports/tasks-for-hooks.port';
import { LifecycleHookTriggers } from '@integrations/application/services/lifecycle-hook-triggers.service';
import type { QueueHookFirings } from '@integrations/application/services/queue-hook-firings.service';
import {
  runEnded,
  taskMoved,
} from '@integrations/domain/value-objects/hook-event-facts.fake-spec';
import { HookEventFacts } from '@integrations/domain/value-objects/hook-event-facts.vo';
import { HookOccurrenceKey } from '@integrations/domain/value-objects/hook-occurrence-key.vo';
import type { HookOccurrence } from '@integrations/domain/value-objects/hook-occurrence.vo';
import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { Repository } from '@shared-kernel/domain/value-objects/repository.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { Tool } from '@shared-kernel/domain/value-objects/tool.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const TASK = taskViewOf();

const setUp = (task: LinkedTaskView | null = TASK) => {
  const queue = vi.fn(async (_task: TaskView, _occurred: HookOccurrence) => 1);
  const tasks = {
    of: vi.fn(async () => task),
    ofPullRequest: vi.fn(async () => task),
  } satisfies TasksForHooksPort;

  const occurred = (index = 0) => {
    const each = queue.mock.calls[index]?.[1];

    return each
      ? {
          on: each.on,
          occurrence: each.key,
          change: each.change,
          event: each.facts,
          matchedAfterChanges: each.matchedAfterChanges,
        }
      : null;
  };

  return {
    queue,
    occurred,
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
    const { triggers, occurred } = setUp();
    const used = {
      on: 'tool.used' as const,
      tool: Tool.of('github.comment'),
      inputs: {},
      output: null,
      failed: false,
    };

    await triggers.toolUsed(TASK, used, HookOccurrenceKey.of('call_1'));
    await triggers.toolUsed(TASK, used, HookOccurrenceKey.of('call_2'));

    expect(occurred(0)?.change).not.toBe(occurred(1)?.change);
    expect(occurred(0)?.change).toContain('github.comment');
    expect(occurred(0)).toMatchObject({
      on: 'tool.used',
      occurrence: HookOccurrenceKey.of('call_1'),
    });
  });

  it('fires the hooks of the task a run ended on', async () => {
    const { triggers, occurred, tasks } = setUp();

    await triggers.runEnded({
      runId: 'run_1',
      taskId: 'task_1',
      outcome: 'handed-over',
    } as never);

    expect(tasks.of).toHaveBeenCalledWith(
      TaskId.of('task_1'),
      RunId.of('run_1'),
    );
    expect(occurred()).toMatchObject({
      on: 'run.ended',
      occurrence: HookOccurrenceKey.of('run-ended:run_1'),
      event: runEnded('handed-over'),
    });
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
    const { triggers, occurred } = setUp();

    await triggers.taskMoved({
      taskId: 'task_1',
      from: 'triage',
      to: 'build',
      at: '2026-09-26T10:00:00.000Z',
    } as never);

    expect(occurred()).toMatchObject({
      on: 'task.moved',
      change: 'triage → build',
      event: taskMoved('triage', 'build'),
    });
  });

  it('fires on a merged pull request, matching it once its changes are known', async () => {
    const { triggers, queue, occurred, tasks } = setUp();

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
    expect(occurred()).toMatchObject({
      on: 'pull-request.merged',
      matchedAfterChanges: true,
      event: HookEventFacts.of({
        on: 'pull-request.merged',
        pullRequest: PullRequestUrl.of(PULL_REQUEST),
        repository: Repository.of('acme/api'),
        mergeCommit: 'abc',
        changed: null,
      }),
    });
  });
});
