import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { EnqueueTaskRun } from '@work/application/events/handlers/enqueue-task-run.handler';
import type { DispatchTask } from '@work/application/services/dispatch-task.service';
import { Line } from '@work/domain/aggregates/line.aggregate';
import type { Run } from '@work/domain/aggregates/run.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { Station } from '@work/domain/entities/station.entity';
import { TaskHandedToRun } from '@work/domain/events/task-handed-to-run.event';
import type { LineRepository } from '@work/domain/repositories/line.repository';
import type { RunRepository } from '@work/domain/repositories/run.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { LineId } from '@work/domain/value-objects/line-id.vo';
import { LineKey } from '@work/domain/value-objects/line-key.vo';
import { LineName } from '@work/domain/value-objects/line-name.vo';
import { StationColor } from '@work/domain/value-objects/station-color.vo';
import { StationId } from '@work/domain/value-objects/station-id.vo';
import { StationKey } from '@work/domain/value-objects/station-key.vo';
import { StationName } from '@work/domain/value-objects/station-name.vo';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const RUN = RunId.of('run_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const LINE = {} as Line;

const delivery = (workspaceId = 'ws_1', standsAt = 'station_1') =>
  Line.rehydrate({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      Station.of({
        id: StationId.of(standsAt),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: StationColor.of('#a3a8b0'),
        kind: 'backlog',
      }),
      Station.of({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: StationColor.of('#a3a8b0'),
        kind: 'completed',
      }),
    ],
  });

const added = () =>
  Task.add({
    line: delivery(WORKSPACE.value),
    at: StationId.of('station_1'),
    title: TaskTitle.of('Drain the queue'),
    rank: TaskRank.of('i'),
    now: new Date('2026-09-17T09:00:00.000Z'),
    newId: () => 'task_1',
  });

const enqueuing = (
  over: { task?: Task; existing?: Run | null; enqueued?: boolean } = {},
) => {
  const task = over.task ?? Task.rehydrate({ ...added(), currentRunId: RUN });
  const save = vi.fn(async (_: Task) => {});
  const enqueue = vi.fn(async () => over.enqueued ?? true);
  const handler = new EnqueueTaskRun(
    { find: async () => task, save } as unknown as TaskRepository,
    { holding: async () => LINE } as unknown as LineRepository,
    { findById: async () => over.existing ?? null } as unknown as RunRepository,
    { enqueue } as unknown as DispatchTask,
  );

  return { handler, task, save, enqueue };
};

const handed = (task: Task) => new TaskHandedToRun(task.id, WORKSPACE, RUN);

describe('EnqueueTaskRun', () => {
  it('enqueues the run a task was handed to', async () => {
    const { handler, task, enqueue, save } = enqueuing();

    await handler.on(handed(task));

    expect(enqueue).toHaveBeenCalledWith({ task, line: LINE, runId: RUN });
    expect(save).not.toHaveBeenCalled();
  });

  it('enqueues nothing twice', async () => {
    const { handler, task, enqueue } = enqueuing({ existing: {} as Run });

    await handler.on(handed(task));

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('leaves a task alone that has since been handed elsewhere', async () => {
    const { handler, enqueue } = enqueuing({ task: added() });

    await handler.on(handed(added()));

    expect(enqueue).not.toHaveBeenCalled();
  });

  it('lets the task go when its run can no longer start', async () => {
    const { handler, task, save } = enqueuing({ enqueued: false });

    await handler.on(handed(task));

    expect(save.mock.calls[0]?.[0].currentRunId).toBeNull();
  });
});
