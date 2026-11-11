import { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';
import { LineKey } from '@shared-kernel/domain/value-objects/line-key.vo';
import { LineName } from '@shared-kernel/domain/value-objects/line-name.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { StationKey } from '@shared-kernel/domain/value-objects/station-key.vo';
import { StationName } from '@shared-kernel/domain/value-objects/station-name.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { OrderTaskRun } from '@work/application/events/handlers/order-task-run.handler';
import type { LineMapsPort } from '@work/application/ports/line-maps.port';
import type { DispatchTask } from '@work/application/services/dispatch-task.service';
import type { OrderedRun } from '@work/application/services/ordered-run';
import type { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import { Task } from '@work/domain/aggregates/task.aggregate';
import { TaskRunAssigned } from '@work/domain/events/task-run-assigned.event';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { BriefedMemories } from '@work/domain/value-objects/briefed-memories.vo';
import {
  lineMapOf,
  stationOf,
} from '@work/domain/value-objects/line-map.fake-spec';
import { TaskRank } from '@work/domain/value-objects/task-rank.vo';
import { TaskTitle } from '@work/domain/value-objects/task-title.vo';
import { describe, expect, it, vi } from 'vitest';

const RUN = RunId.of('run_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const NOW = new Date('2026-09-17T09:00:00.000Z');

const delivery = (workspaceId = 'ws_1', backlogId = 'station_1') =>
  lineMapOf({
    id: LineId.of('line_1'),
    workspaceId: WorkspaceId.of(workspaceId),
    teamId: TeamId.of('team_1'),
    key: LineKey.of('delivery'),
    name: LineName.of('Delivery'),
    stations: [
      stationOf({
        id: StationId.of(backlogId),
        key: StationKey.of('backlog'),
        name: StationName.of('Backlog'),
        position: 0,
        color: '#a3a8b0',
        kind: 'backlog',
      }),
      stationOf({
        id: StationId.of('station_completed'),
        key: StationKey.of('completed'),
        name: StationName.of('Completed'),
        position: 1,
        color: '#a3a8b0',
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

const ORDERED: OrderedRun = {
  order: {
    runId: RUN.value,
    workspaceId: WORKSPACE.value,
    harness: 'dev',
    priority: 0,
    placement: { labelGroups: [], image: null },
    spec: {
      command: { executable: 'sh', args: [] },
      briefing: 'Drain the queue.',
      handover: { options: [], noteLimit: 0 },
      resume: {},
    },
    requester: {
      owner: 'work',
      kind: 'task',
      id: 'task_1',
      token: '0',
      team: 'team_1',
    },
    policy: {
      holdsTurn: true,
      gated: true,
      actsBeyondItself: true,
      asks: 'requester',
      listed: true,
      exclusive: true,
    },
    workingCopy: {
      key: 'work/task-task_1',
      rejoinable: true,
      restores: 'always',
    },
    restore: null,
    extensions: {},
    apiGrant: null,
    tags: { taskId: 'task_1' },
    line: null,
    refusal: null,
  },
  briefedTask: null,
  briefedMemories: BriefedMemories.none(),
  configuredAs: null,
};

const ordering = (
  over: {
    task?: Task;
    existing?: Dispatch | null;
    ordered?: OrderedRun | null;
  } = {},
) => {
  const task = over.task ?? Task.rehydrate({ ...added(), currentRunId: RUN });
  const added_ = vi.fn<(dispatch: Dispatch) => Promise<void>>(async () => {});
  const order = vi.fn(async () =>
    over.ordered === undefined ? ORDERED : over.ordered,
  );
  const handler = new OrderTaskRun(
    { find: async () => task } as unknown as TaskRepository,
    { findByStation: async () => delivery() } as unknown as LineMapsPort,
    {
      find: async () => over.existing ?? null,
      add: added_,
      save: async () => undefined,
    } satisfies DispatchRepository,
    { ordered: order } as unknown as DispatchTask,
    { now: () => NOW, sleep: async () => {} },
  );

  return { handler, task, added: added_, order };
};

const handed = (task: Task) => new TaskRunAssigned(task.id, WORKSPACE, RUN);

describe('OrderTaskRun', () => {
  it('records the order of the run a task was dispatched to, briefing and all', async () => {
    const { handler, task, added } = ordering();

    await handler.on(handed(task));

    const dispatch = added.mock.calls[0]?.[0];
    expect(dispatch?.subject).toEqual({
      kind: 'task',
      taskId: task.id,
      revision: task.revision,
      stationId: task.stationId,
    });
    expect(dispatch?.briefing).toBe('Drain the queue.');
    expect(dispatch?.teamId?.value).toBe('team_1');
    expect(dispatch?.pullEvents().map((each) => each.kind)).toEqual([
      'dispatch.ordered',
    ]);
  });

  it('orders nothing twice', async () => {
    const { handler, task, order } = ordering({ existing: {} as Dispatch });

    await handler.on(handed(task));

    expect(order).not.toHaveBeenCalled();
  });

  it('leaves a task alone that has since been handed elsewhere', async () => {
    const { handler, order } = ordering({ task: added() });

    await handler.on(handed(added()));

    expect(order).not.toHaveBeenCalled();
  });

  it('refuses the run, for the task to drop it, when its station has no order', async () => {
    const { handler, task, added } = ordering({ ordered: null });

    await handler.on(handed(task));

    const dispatch = added.mock.calls[0]?.[0];
    expect(dispatch?.refusedBecause).toBe('no-order');
    expect(dispatch?.pullEvents().map((each) => each.kind)).toEqual([
      'dispatch.refused',
    ]);
  });
});
