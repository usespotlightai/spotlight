import type { RunsPort } from '@runs/application/ports/runs.port';
import { partial } from '@shared-kernel/domain/partial.fake-spec';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { StationId } from '@shared-kernel/domain/value-objects/station-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { UserId } from '@shared-kernel/domain/value-objects/user-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { StopRunHandler } from '@work/application/commands/handlers/stop-run.handler';
import { StopRunCommand } from '@work/application/commands/stop-run.command';
import { recordingRuns } from '@work/application/ports/runs.fake-spec';
import type { TakeTurn } from '@work/application/services/take-turn.service';
import { workAccessSeeing } from '@work/application/services/work-access.fake-spec';
import { Dispatch } from '@work/domain/aggregates/dispatch.aggregate';
import type { Task } from '@work/domain/aggregates/task.aggregate';
import { TeamMembershipRequiredError } from '@work/domain/exceptions/team-membership-required.error';
import type { DispatchRepository } from '@work/domain/repositories/dispatch.repository';
import type { TaskRepository } from '@work/domain/repositories/task.repository';
import { runOrderOf } from '@work/domain/value-objects/dispatch-order.fake-spec';
import { TaskRevision } from '@work/domain/value-objects/task-revision.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-08-31T09:00:00.000Z');

const TASK = partial<Task>({ id: TaskId.of('task_1') });
const ALICE = UserId.of('user_alice');

const dispatched = Dispatch.ordered({
  id: RunId.of('run_1'),
  workspaceId: WorkspaceId.of('ws_1'),
  teamId: TeamId.of('team_1'),
  subject: {
    kind: 'task',
    taskId: TaskId.of('task_1'),
    revision: TaskRevision.of(0),
    stationId: StationId.of('station_1'),
    driver: 'line' as const,
  },
  configuredAs: null,
  order: runOrderOf(RunId.of('run_1')),
  now: NOW,
}).enqueuedAsRun();

const stopping = (
  task: Task | null,
  access = workAccessSeeing(() => true),
  answers: Partial<RunsPort> = {},
) => {
  const runs = recordingRuns(answers);
  const take = vi.fn(() => Promise.resolve(undefined));
  const handler = new StopRunHandler(
    runs,
    {
      find: () => Promise.resolve(dispatched),
      add: () => Promise.resolve(undefined),
      save: () => Promise.resolve(undefined),
    } satisfies DispatchRepository,
    partial<TaskRepository>({ find: vi.fn(() => Promise.resolve(task)) }),
    partial<TakeTurn>({ take }),
    access,
  );

  return { handler, runs, take };
};

describe('StopRunHandler', () => {
  it('requests the stop when a person who acts on the team asks for it', async () => {
    const { handler, runs, take } = stopping(TASK);

    await handler.execute(new StopRunCommand('run_1', 'user_1'));

    expect(runs.requestStop).toHaveBeenCalledWith(RunId.of('run_1'));
    expect(take).not.toHaveBeenCalled();
  });

  it('has a turn its task still decides decided at once (R4)', async () => {
    const { handler, take } = stopping(
      TASK,
      workAccessSeeing(() => true),
      { requestStop: () => Promise.resolve({ pendingTurn: 1 }) },
    );

    await handler.execute(new StopRunCommand('run_1', 'user_1'));

    expect(take).toHaveBeenCalledWith(RunId.of('run_1'), 1);
  });

  it('requests the stop for Bob, another member, and for an admin who is not on the team, as for Alice, the assignee', async () => {
    for (const [by, members] of [
      ['user_alice', [ALICE]],
      ['user_bob', [ALICE, UserId.of('user_bob')]],
      ['user_admin', [ALICE]],
    ] as const) {
      const { handler, runs } = stopping(
        TASK,
        workAccessSeeing(() => true, { members }),
      );

      await handler.execute(new StopRunCommand('run_1', by));

      expect(runs.requestStop).toHaveBeenCalledWith(RunId.of('run_1'));
    }
  });

  it('refuses anybody who only sees the team', async () => {
    const { handler, runs } = stopping(
      TASK,
      workAccessSeeing(() => true, { onTeam: () => false }),
    );

    await expect(
      handler.execute(new StopRunCommand('run_1', 'user_reader')),
    ).rejects.toMatchObject({
      refusal: expect.any(TeamMembershipRequiredError) as unknown,
    });
    expect(runs.requestStop).not.toHaveBeenCalled();
  });

  it('refuses a person who is no longer on the team', async () => {
    const { handler, runs } = stopping(
      TASK,
      workAccessSeeing(() => true, { onTeam: () => false }),
    );

    await expect(
      handler.execute(new StopRunCommand('run_1', 'user_1')),
    ).rejects.toMatchObject({
      refusal: expect.any(TeamMembershipRequiredError) as unknown,
    });
    expect(runs.requestStop).not.toHaveBeenCalled();
  });

  it('passes on the refusal of a run that is no longer worked', async () => {
    const { handler, take } = stopping(
      TASK,
      workAccessSeeing(() => true),
      {
        requestStop: () => {
          return Promise.reject(
            new Error('Run run_1 has ended. It cannot be stopped.'),
          );
        },
      },
    );

    await expect(
      handler.execute(new StopRunCommand('run_1', 'user_1')),
    ).rejects.toThrow('Run run_1 has ended. It cannot be stopped.');
    expect(take).not.toHaveBeenCalled();
  });
});
