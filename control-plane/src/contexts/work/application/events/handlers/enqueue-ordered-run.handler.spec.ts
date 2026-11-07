import type { RunsPort } from '@runs/application/ports/runs.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { EnqueueOrderedRun } from '@work/application/events/handlers/enqueue-ordered-run.handler';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { DispatchOrdered } from '@work/domain/events/dispatch-ordered.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { DispatchEnding } from '@work/domain/value-objects/dispatch-ending.vo';
import { DispatchOrder } from '@work/domain/value-objects/dispatch-order.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-07T10:00:00.000Z');
const RUN = RunId.of('run_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const ORDER = { runId: RUN.value, workspaceId: WORKSPACE.value };

const ordered = () =>
  Dispatch.ordered({
    id: RUN,
    workspaceId: WORKSPACE,
    teamId: TeamId.of('team_1'),
    subject: {
      kind: 'task',
      taskId: TaskId.of('task_1'),
      revision: TaskRevision.of(0),
      stationId: StationId.of('station_1'),
    },
    configuredAs: null,
    order: DispatchOrder.of(ORDER),
    now: NOW,
  });

let stored: Dispatch | null;
let holds: boolean[];
let calls: string[];
let refuseOrder: boolean;

const dispatches: DispatchRepository = {
  find: async () => stored,
  add: async () => undefined,
  save: async (saved) => {
    calls.push(
      `save:${saved.enqueued ? 'enqueued' : (saved.refusedBecause ?? 'ordered')}${saved.detachedAt ? ':detached' : ''}`,
    );
    saved.pullEvents();
    stored = saved;
  },
};

const tasks = {
  find: async () => {
    const held = holds.shift() ?? false;

    return { hasCurrentRun: () => held } as unknown as Task;
  },
} as unknown as TaskRepository;

const runs = {
  enqueue: vi.fn(async () => {
    calls.push('enqueue');

    return refuseOrder
      ? { outcome: 'refused' as const, reason: 'it names no harness' }
      : { outcome: 'enqueued' as const };
  }),
  cancel: vi.fn(async () => {
    calls.push('cancel');
    return { was: 'unknown' as const, started: false };
  }),
} as unknown as RunsPort;

const handler = () =>
  new EnqueueOrderedRun(dispatches, tasks, {} as ChatRepository, runs, {
    now: () => NOW,
    sleep: async () => {},
  });

const event = new DispatchOrdered(RUN, WORKSPACE);

describe('EnqueueOrderedRun', () => {
  beforeEach(() => {
    stored = ordered();
    holds = [true, true];
    calls = [];
    refuseOrder = false;
  });

  it('enqueues the order its task still holds and marks it enqueued', async () => {
    await handler().on(event);

    expect(runs.enqueue).toHaveBeenCalledWith(ORDER);
    expect(calls).toEqual(['enqueue', 'save:enqueued']);
  });

  it('does nothing again once enqueued or refused', async () => {
    await handler().on(event);
    calls = [];
    holds = [true, true];

    await handler().on(event);

    expect(calls).toEqual([]);
  });

  it('withdraws an order its task let go of before the run exists, cancelling any run an earlier try made', async () => {
    holds = [false];

    await handler().on(event);

    expect(calls).toEqual(['cancel', 'save:withdrawn']);
  });

  it('cancels the run when the task let go of it while it was enqueued, and remembers the task let go', async () => {
    holds = [true, false];

    await handler().on(event);

    expect(calls).toEqual(['enqueue', 'cancel', 'save:enqueued:detached']);
  });

  it('refuses an order the runs refuse, so the task drops the run', async () => {
    refuseOrder = true;

    await handler().on(event);

    expect(calls).toEqual(['enqueue', 'save:order-refused']);
  });

  it('only marks enqueued a run that already ended, as a refused order does at once', async () => {
    stored = ordered().ended(
      DispatchEnding.of({
        endedAt: NOW,
        outcome: 'failed',
        failure: 'refused',
        stopped: false,
      }),
    );

    await handler().on(event);

    expect(calls).toEqual(['save:enqueued']);
  });

  it('retries with the same order after a failure to enqueue', async () => {
    vi.mocked(runs.enqueue).mockRejectedValueOnce(new Error('database away'));

    await expect(handler().on(event)).rejects.toThrow('database away');
    await handler().on(event);

    expect(vi.mocked(runs.enqueue).mock.lastCall).toEqual([ORDER]);
    expect(stored?.enqueued).toBe(true);
  });
});
