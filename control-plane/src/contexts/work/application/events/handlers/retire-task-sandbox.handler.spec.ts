import type { SandboxRetirementPort } from '@runners/application/ports/sandbox-retirement.port';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RetireTaskSandbox } from '@work/application/events/handlers/retire-task-sandbox.handler';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { describe, expect, it, vi } from 'vitest';

const TASK = TaskId.of('task_1');

const WORKSPACE = WorkspaceId.of('ws_1');

const STATION = StationId.of('station_done');

const KEY = WorkRequesters.taskWorkingCopyKey(TASK);

const finished = new TaskFinished(
  TASK,
  WORKSPACE,
  STATION,
  new Date('2026-11-18T10:00:00.000Z'),
);

const retiring = (input: { task?: { finished: boolean } | null } = {}) => {
  const task =
    input.task === null
      ? null
      : ({ finished: input.task?.finished ?? false } as unknown as Task);
  const tasks = { find: vi.fn(async () => task) } as unknown as TaskRepository;
  const sandboxes: SandboxRetirementPort = { retire: vi.fn(async () => {}) };

  return { handler: new RetireTaskSandbox(tasks, sandboxes), sandboxes };
};

describe('RetireTaskSandbox', () => {
  it('retires the sandbox of a finished task, also one that waits at the end of its line for a merge', async () => {
    const { handler, sandboxes } = retiring({ task: { finished: true } });

    await handler.onFinished(finished);

    expect(sandboxes.retire).toHaveBeenCalledWith(WORKSPACE.value, KEY);
  });

  it('keeps the sandbox of a task that reopened before the event came', async () => {
    const { handler, sandboxes } = retiring({ task: { finished: false } });

    await handler.onFinished(finished);

    expect(sandboxes.retire).not.toHaveBeenCalled();
  });

  it('retires the sandbox of a finished task that is gone, and of a deleted task', async () => {
    const gone = retiring({ task: null });

    await gone.handler.onFinished(finished);
    await gone.handler.onDeleted(new TaskDeleted(TASK, WORKSPACE));

    expect(gone.sandboxes.retire).toHaveBeenNthCalledWith(
      1,
      WORKSPACE.value,
      KEY,
    );
    expect(gone.sandboxes.retire).toHaveBeenNthCalledWith(
      2,
      WORKSPACE.value,
      KEY,
    );
  });
});
