import {
  orderedFor,
  RunCancelled,
  RunEnded,
  RunExhausted,
  RunOutcome,
  runEndedOf,
} from '@runs/application/ports/run-fixtures.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { DispatchRunEndings } from '@work/application/events/handlers/dispatch-run-endings.handler';
import { DropUnorderedRun } from '@work/application/events/handlers/drop-unordered-run.handler';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { DispatchRefused } from '@work/domain/events/dispatch-refused.event';
import { TaskRunDetached } from '@work/domain/events/task-run-detached.event';
import type { ChatRepository } from '@work/domain/repositories/chat.repository';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { runOrderOf } from '@work/domain/value-objects/dispatch-order.fake-spec';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-11-07T10:00:00.000Z');
const RUN = RunId.of('run_1');
const WORKSPACE = WorkspaceId.of('ws_1');
const TASK = TaskId.of('task_1');
const SUBJECT = orderedFor.task(TASK.value, 0).requester;

let stored: Dispatch | null;
let saves: Dispatch[];

const dispatches: DispatchRepository = {
  find: async () => stored,
  add: async () => undefined,
  save: async (saved) => {
    saves.push(saved);
    stored = saved;
  },
};

const endings = () =>
  new DispatchRunEndings(dispatches, { now: () => NOW, sleep: async () => {} });

const failed = new RunEnded(
  RUN,
  WORKSPACE,
  SUBJECT,
  RunOutcome.of({ exitCode: 1, failed: true }),
  null,
  null,
  null,
  1,
  false,
  true,
  true,
  NOW,
);

describe('DispatchRunEndings', () => {
  beforeEach(() => {
    stored = Dispatch.ordered({
      id: RUN,
      workspaceId: WORKSPACE,
      teamId: null,
      subject: {
        kind: 'task',
        taskId: TASK,
        revision: TaskRevision.of(0),
        stationId: StationId.of('station_1'),
      },
      configuredAs: null,
      order: runOrderOf(RUN),
      now: NOW,
    }).enqueuedAsRun();
    stored.pullEvents();
    saves = [];
  });

  it('ends the dispatch of a run that ended, with how it ended', async () => {
    await endings().onRunEnded(runEndedOf(failed));

    expect(stored?.ending?.outcome).toBe('failed');
    expect(stored?.ending?.failure).toBe('exited');
    expect(stored?.ending?.endedAt).toEqual(NOW);
  });

  it('ends an exhausted or cancelled run as such', async () => {
    await endings().onRunEnded(
      runEndedOf(
        new RunExhausted(
          RUN,
          WORKSPACE,
          SUBJECT,
          3,
          3,
          false,
          'runner-lost',
          true,
          NOW,
        ),
      ),
    );

    expect(stored?.ending?.outcome).toBe('exhausted');
    expect(stored?.ending?.failure).toBe('runner-lost');

    stored = null;
    await endings().onRunEnded(
      runEndedOf(
        new RunCancelled(RUN, WORKSPACE, SUBJECT, 1, false, false, NOW),
      ),
    );

    expect(saves).toHaveLength(1);
  });

  it('supersedes a failed run whose task let go of it, in either order', async () => {
    await endings().onTaskRunDetached(
      new TaskRunDetached(TASK, WORKSPACE, RUN),
    );
    await endings().onRunEnded(runEndedOf(failed));

    expect(stored?.superseded).toBe(true);
    expect(stored?.pullEvents().map((each) => each.kind)).toEqual([
      'dispatch.ended',
      'dispatch.superseded',
    ]);
  });

  it('changes nothing on a redelivery', async () => {
    await endings().onRunEnded(runEndedOf(failed));
    await endings().onRunEnded(runEndedOf(failed));
    await endings().onTaskRunDetached(
      new TaskRunDetached(TASK, WORKSPACE, RUN),
    );
    await endings().onTaskRunDetached(
      new TaskRunDetached(TASK, WORKSPACE, RUN),
    );

    expect(saves).toHaveLength(2);
  });
});

describe('DropUnorderedRun', () => {
  it('lets the task drop a run its dispatch refused, and leaves one it no longer holds', async () => {
    const save = vi.fn(async (_: Task) => {});
    const dropped = { currentRunId: null } as unknown as Task;
    const holding = {
      hasCurrentRun: () => true,
      dropUnstartedRun: () => dropped,
    } as unknown as Task;
    let found: Task = holding;
    const drop = new DropUnorderedRun(
      { find: async () => found, save } as unknown as TaskRepository,
      {} as ChatRepository,
    );
    const refused = new DispatchRefused(RUN, WORKSPACE, TASK, null, 'no-order');

    await drop.ofTask(refused);
    found = { hasCurrentRun: () => false } as unknown as Task;
    await drop.ofTask(refused);
    await drop.ofChat(refused);

    expect(save.mock.calls).toEqual([[dropped]]);
  });
});
