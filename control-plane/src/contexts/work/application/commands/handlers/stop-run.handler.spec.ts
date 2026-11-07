import type { RunRepository } from '@runs/application/ports/run-fixtures.fake-spec';
import {
  HandoverReport,
  orderedFor,
  Run,
  RunOutcome,
  RunSpec,
  Runs,
} from '@runs/application/ports/run-fixtures.fake-spec';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import { HarnessId } from '@shared-kernel/domain/value-objects/harness-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import type { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { StopRunHandler } from '@work/application/commands/handlers/stop-run.handler';
import { StopRunCommand } from '@work/application/commands/stop-run.command';
import type { TakeTurn } from '@work/application/services/take-turn.service';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { TeamMembershipRequiredError } from '@work/domain/exceptions/team-membership-required.error';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { DispatchOrder } from '@work/domain/value-objects/dispatch-order.vo';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-31T09:00:00.000Z');

const spec = RunSpec.of({
  command: { executable: 'claude-agent-acp', args: ['--acp'] },
  briefing: 'work out what the request wants',
  handover: { options: ['Spec'], noteLimit: 4_000 },
  resume: {},
});

const claimedRun = () =>
  Run.enqueue({
    id: RunId.of('run_1'),
    workspaceId: WorkspaceId.of('ws_1'),
    harness: HarnessId.of('claude-code'),
    spec,
    ...orderedFor.task('task_1', 0),
  }).claim(RunnerId.of('runner_1'), NOW);

const taskAssignedTo = (userId: string) =>
  ({
    id: TaskId.of('task_1'),
    assignedToThem: (them: UserId) => them.value === userId,
  }) as unknown as Task;

const dispatched = Dispatch.ordered({
  id: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  subject: {
    kind: 'task',
    taskId: TaskId.of('task_1'),
    revision: TaskRevision.of(0),
    stationId: StationId.of('station_1'),
  },
  configuredAs: null,
  order: DispatchOrder.of({}),
  now: NOW,
}).enqueuedAsRun();

const stopping = (
  run: Run,
  task: Task | null,
  access = workAccessSeeing(() => true),
) => {
  let current = run;
  const save = vi.fn(async (saved: Run) => {
    current = saved;
  });
  const runs = {
    findById: vi.fn(async () => current),
    save,
  } as unknown as RunRepository;
  const take = vi.fn(async () => undefined);
  const handler = new StopRunHandler(
    new Runs(runs, { sha256: (text) => text }, { now: () => NOW } as ClockPort),
    {
      find: async () => dispatched,
      add: async () => undefined,
      save: async () => undefined,
    } satisfies DispatchRepository,
    { find: vi.fn(async () => task) } as unknown as TaskRepository,
    { take } as unknown as TakeTurn,
    access,
  );

  return { handler, save, take, current: () => current };
};

describe('StopRunHandler', () => {
  it('records the stop when the person it is assigned to requests it', async () => {
    const { handler, save } = stopping(claimedRun(), taskAssignedTo('user_1'));

    await handler.execute(new StopRunCommand('run_1', 'user_1'));

    expect(save).toHaveBeenCalledTimes(1);
    const saved = save.mock.calls[0][0];
    expect(saved.stopRequested).toBe(true);
    expect(saved.stopRequestedAt).toEqual(NOW);
  });

  it('records the stop on a turn its task still decides, and has the turn decided at once (R4)', async () => {
    const { handler, take, current } = stopping(
      claimedRun().reportTurn(
        RunnerId.of('runner_1'),
        RunOutcome.of({ exitCode: 0, failed: false }),
        HandoverReport.none(),
        NOW,
      ),
      taskAssignedTo('user_1'),
    );

    await handler.execute(new StopRunCommand('run_1', 'user_1'));

    expect(current().state).toBe('suspended');
    expect(current().stopRequested).toBe(true);
    expect(take).toHaveBeenCalledWith(RunId.of('run_1'), 1);
  });

  it('ends a kept turn stopped, with no turn left to decide', async () => {
    const { handler, take, current } = stopping(
      claimedRun()
        .reportTurn(
          RunnerId.of('runner_1'),
          RunOutcome.of({ exitCode: 0, failed: false }),
          HandoverReport.none(),
          NOW,
        )
        .keep(1),
      taskAssignedTo('user_1'),
    );

    await handler.execute(new StopRunCommand('run_1', 'user_1'));

    expect(current().outcome?.stopped).toBe(true);
    expect(take).not.toHaveBeenCalled();
  });

  it('rejects anyone the task is not assigned to', async () => {
    const { handler, save } = stopping(claimedRun(), taskAssignedTo('user_1'));

    await expect(
      handler.execute(new StopRunCommand('run_1', 'someone_else')),
    ).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
  });

  it('refuses the person it is assigned to once they are no longer on the team', async () => {
    const { handler, save } = stopping(
      claimedRun(),
      taskAssignedTo('user_1'),
      workAccessSeeing(() => true, { onTeam: () => false }),
    );

    await expect(
      handler.execute(new StopRunCommand('run_1', 'user_1')),
    ).rejects.toMatchObject({
      refusal: expect.any(TeamMembershipRequiredError),
    });
    expect(save).not.toHaveBeenCalled();
  });

  it('does not stop a run that is no longer being worked', async () => {
    const ended = claimedRun().complete(
      RunnerId.of('runner_1'),
      RunOutcome.of({ exitCode: 0, failed: false }),
    );
    const { handler, save } = stopping(ended, taskAssignedTo('user_1'));

    await expect(
      handler.execute(new StopRunCommand('run_1', 'user_1')),
    ).rejects.toThrow();
    expect(save).not.toHaveBeenCalled();
  });
});
