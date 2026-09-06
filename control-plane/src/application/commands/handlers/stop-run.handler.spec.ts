import { StopRunHandler } from '@application/commands/handlers/stop-run.handler';
import { StopRunCommand } from '@application/commands/stop-run.command';
import type { ClockPort } from '@application/ports/clock.port';
import type { DomainEventDispatcher } from '@application/ports/domain-event-dispatcher.port';
import { Run } from '@domain/aggregates/run.aggregate';
import type { Task } from '@domain/aggregates/task.aggregate';
import { RunStopRequested } from '@domain/events/run-stop-requested.event';
import type { RunRepository } from '@domain/repositories/run.repository';
import type { TaskRepository } from '@domain/repositories/task.repository';
import { HarnessId } from '@domain/value-objects/harness-id.vo';
import { RunId } from '@domain/value-objects/run-id.vo';
import { RunSpec } from '@domain/value-objects/run-spec.vo';
import { RunnerId } from '@domain/value-objects/runner-id.vo';
import { StationId } from '@domain/value-objects/station-id.vo';
import { TaskId } from '@domain/value-objects/task-id.vo';
import type { UserId } from '@domain/value-objects/user-id.vo';
import { WorkspaceId } from '@domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-31T09:00:00.000Z');

const spec = RunSpec.of({
  command: { executable: 'claude-agent-acp', args: ['--acp'] },
  briefing: 'work out what is being asked for',
  handover: { options: ['Spec'], noteLimit: 4_000 },
  continuity: { key: 'task_1-station_1', keep: true },
});

const claimedRun = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    spec,
    taskId: TaskId.of('task_1'),
    stationId: StationId.of('station_1'),
  }).claim(RunnerId.of('runner_1'), NOW);

const taskAssignedTo = (userId: string) =>
  ({
    assignedToThem: (them: UserId) => them.value === userId,
  }) as unknown as Task;

const stopping = (run: Run, task: Task | null) => {
  const save = vi.fn(async (_saved: Run) => undefined);
  const dispatch = vi.fn(async (_events: readonly unknown[]) => undefined);
  const handler = new StopRunHandler(
    {
      findById: vi.fn(async () => run),
      save,
    } as unknown as RunRepository,
    { find: vi.fn(async () => task) } as unknown as TaskRepository,
    { now: () => NOW } as ClockPort,
    { dispatch } as DomainEventDispatcher,
  );

  return { handler, save, dispatch };
};

describe('StopRunHandler', () => {
  it('records the stop when the person it is assigned to asks', async () => {
    const { handler, save } = stopping(claimedRun(), taskAssignedTo('user_1'));

    await handler.execute(new StopRunCommand('run_1', 'user_1'));

    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0][0];
    expect(saved.stopRequested).toBe(true);
    expect(saved.stopRequestedAt).toEqual(NOW);
  });

  it('announces that the run was asked to stop', async () => {
    const { handler, dispatch } = stopping(
      claimedRun(),
      taskAssignedTo('user_1'),
    );

    await handler.execute(new StopRunCommand('run_1', 'user_1'));

    const raised = dispatch.mock.calls[0][0];
    expect(raised.some((each) => each instanceof RunStopRequested)).toBe(true);
  });

  it('refuses anyone the task is not assigned to', async () => {
    const { handler, save } = stopping(claimedRun(), taskAssignedTo('user_1'));

    await expect(
      handler.execute(new StopRunCommand('run_1', 'someone_else')),
    ).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses to stop a run that is no longer being worked', async () => {
    const ended = claimedRun().release(); // back on the queue, not claimed
    const { handler, save } = stopping(ended, taskAssignedTo('user_1'));

    await expect(
      handler.execute(new StopRunCommand('run_1', 'user_1')),
    ).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
  });
});
