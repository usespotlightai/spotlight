import type { SandboxRetirementPort } from '@runners/application/ports/sandbox-retirement.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RetireTaskSandbox } from '@work/application/events/handlers/retire-task-sandbox.handler';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import { WorkRequesters } from '@work/application/services/work-requesters';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskDeleted } from '@work/domain/events/task-deleted.event';
import { TaskFinished } from '@work/domain/events/task-finished.event';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import type { LineMap } from '@work/domain/value-objects/line-map.vo';
import { describe, expect, it, vi } from 'vitest';

const TASK = TaskId.of('task_1');

const WORKSPACE = WorkspaceId.of('ws_1');

const STATION = StationId.of('station_done');

const LINE = partial<LineMap>({});

const KEY = WorkRequesters.taskWorkingCopyKey(TASK);

const finished = new TaskFinished(
  TASK,
  WORKSPACE,
  STATION,
  new Date('2026-11-18T10:00:00.000Z'),
);

const retiring = (
  input: {
    task?: { keepsNoLiveWorkingCopy: boolean } | null;
    line?: LineMap | null;
  } = {},
) => {
  const keepsNoLiveWorkingCopyOn = vi.fn(
    () => input.task?.keepsNoLiveWorkingCopy ?? false,
  );
  const task =
    input.task === null
      ? null
      : partial<Task>({ stationId: STATION, keepsNoLiveWorkingCopyOn });
  const tasks = partial<TaskRepository>({
    find: vi.fn(() => Promise.resolve(task)),
  });
  const lines = partial<LineMapsPort>({
    findByStation: vi.fn(() =>
      Promise.resolve(input.line === undefined ? LINE : input.line),
    ),
  });
  const sandboxes: SandboxRetirementPort = { retire: vi.fn(async () => {}) };

  return {
    handler: new RetireTaskSandbox(tasks, lines, sandboxes),
    sandboxes,
    keepsNoLiveWorkingCopyOn,
  };
};

describe('RetireTaskSandbox', () => {
  it('retires the sandbox of a task that keeps no live working copy on its line', async () => {
    const { handler, sandboxes, keepsNoLiveWorkingCopyOn } = retiring({
      task: { keepsNoLiveWorkingCopy: true },
    });

    await handler.onFinished(finished);

    expect(keepsNoLiveWorkingCopyOn).toHaveBeenCalledWith(LINE);
    expect(sandboxes.retire).toHaveBeenCalledWith(WORKSPACE.value, KEY);
  });

  it('keeps the sandbox of a finished task that can still reopen, or that reopened before the event came', async () => {
    const { handler, sandboxes } = retiring({
      task: { keepsNoLiveWorkingCopy: false },
    });

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
