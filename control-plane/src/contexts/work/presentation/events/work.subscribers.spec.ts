import { PullRequestUrl } from '@shared-kernel/domain/value-objects/pull-request-url.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { TeamId } from '@shared-kernel/domain/value-objects/team-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunLapsed } from '@work/domain/events/run-lapsed.event';
import { RunParked } from '@work/domain/events/run-parked.event';
import { RunReservationDropped } from '@work/domain/events/run-reservation-dropped.event';
import { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
import { SetupPullRequestOpened } from '@work/domain/events/setup-pull-request-opened.event';
import { TaskAnswered } from '@work/domain/events/task-answered.event';
import { ChatId } from '@work/domain/value-objects/chat-id.vo';
import { workSubscribers } from '@work/presentation/events/work.subscribers';
import { describe, expect, it, vi } from 'vitest';

describe('workSubscribers', () => {
  it('tells Secrets to end what a run was granted once the run ends', async () => {
    const endedFor = vi.fn(async () => undefined);
    const ending = workSubscribers({
      runGrants: { endedFor },
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.end-secret-grants-of-ended-run',
    );

    await ending?.handle(
      new RunWithdrawn(RunId.of('run_1'), WorkspaceId.of('ws_1'), null, 2),
    );

    expect(ending?.kinds).toEqual([
      'run.completed',
      'run.abandoned',
      'run.withdrawn',
    ]);
    expect(endedFor).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      runId: 'run_1',
      attempt: 2,
    });
  });

  it('tells Secrets the hold of an attempt that lapsed is lost', async () => {
    const holdLost = vi.fn(async () => undefined);
    const losing = workSubscribers({
      runGrants: { holdLost },
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.lose-secret-hold-of-ended-attempt',
    );
    const run = RunId.of('run_1');
    const workspace = WorkspaceId.of('ws_1');

    await losing?.handle(
      new RunLapsed(
        run,
        workspace,
        RunnerId.of('runner_1'),
        new Date('2026-09-27T09:00:00.000Z'),
        1,
      ),
    );

    await losing?.handle(
      new RunParked(
        run,
        workspace,
        RunnerId.of('runner_1'),
        new Date('2026-09-27T09:05:00.000Z'),
        2,
      ),
    );

    expect(losing?.kinds).toEqual(['run.lapsed', 'run.parked']);
    expect(holdLost.mock.calls).toEqual([
      [{ workspaceId: 'ws_1', runId: 'run_1', attempt: 1 }],
      [{ workspaceId: 'ws_1', runId: 'run_1', attempt: 2 }],
    ]);
  });

  it('revokes every token minted for a run once it ends, and an attempt’s once it lapses or parks', async () => {
    const revokeFor = vi.fn(async () => undefined);
    const subscribers = workSubscribers({
      runTokens: { revokeFor },
    } as unknown as Parameters<typeof workSubscribers>[0]);
    const named = (name: string) =>
      subscribers.find((each) => each.name === name);
    const run = RunId.of('run_1');
    const workspace = WorkspaceId.of('ws_1');

    await named('work.revoke-tokens-of-ended-run')?.handle(
      new RunWithdrawn(run, workspace, null, 2),
    );
    await named('work.revoke-tokens-of-ended-attempt')?.handle(
      new RunParked(
        run,
        workspace,
        RunnerId.of('runner_1'),
        new Date('2026-09-27T09:05:00.000Z'),
        3,
      ),
    );

    expect(named('work.revoke-tokens-of-ended-run')?.kinds).toEqual([
      'run.completed',
      'run.abandoned',
      'run.withdrawn',
    ]);
    expect(named('work.revoke-tokens-of-ended-attempt')?.kinds).toEqual([
      'run.lapsed',
      'run.parked',
    ]);
    expect(revokeFor.mock.calls).toEqual([
      ['ws_1', 'run_1', null],
      ['ws_1', 'run_1', 3],
    ]);
  });

  it('settles the setup list of the team whose setup chat opened its pull request', async () => {
    const forTeam = vi.fn(async () => undefined);
    const settling = workSubscribers({
      setup: { forTeam },
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.settle-on-setup-pull-request',
    );

    await settling?.handle(
      new SetupPullRequestOpened(
        ChatId.of('chat_1'),
        WorkspaceId.of('ws_1'),
        TeamId.of('team_1'),
        PullRequestUrl.of('https://github.com/acme/infra/pull/12'),
        new Date('2026-10-11T09:00:00.000Z'),
      ),
    );

    expect(settling?.kinds).toEqual(['chat.setup-pull-request-opened']);
    expect(forTeam).toHaveBeenCalledWith(TeamId.of('team_1'));
  });

  it('tells Runners of the runner a run lapsed on, parked from, or no longer waits for', async () => {
    const runners = {
      runLeft: vi.fn(async () => {}),
      reservationDropped: vi.fn(async () => {}),
    };
    const subscribers = workSubscribers({
      runners,
    } as unknown as Parameters<typeof workSubscribers>[0]);
    const named = (name: string) =>
      subscribers.find((each) => each.name === name);
    const run = RunId.of('run_1');
    const workspace = WorkspaceId.of('ws_1');
    const runner = RunnerId.of('runner_1');
    const at = new Date('2026-09-27T09:00:00.000Z');

    await named('work.let-go-of-runner-that-left-its-run')?.handle(
      new RunLapsed(run, workspace, runner, at, 1),
    );
    await named('work.let-go-of-runner-that-left-its-run')?.handle(
      new RunParked(run, workspace, RunnerId.of('runner_2'), at, 2),
    );
    await named('work.let-go-of-reserved-runner')?.handle(
      new RunReservationDropped(run, workspace, runner),
    );

    expect(runners.runLeft).toHaveBeenCalledWith(runner, at);
    expect(runners.runLeft).toHaveBeenCalledWith(RunnerId.of('runner_2'), at);
    expect(runners.reservationDropped).toHaveBeenCalledWith('runner_1');
  });

  it('takes up the run a person answered, whichever way the answer came', async () => {
    const pausedRuns = { onTaskAnswered: vi.fn(async () => {}) };
    const taking = workSubscribers({
      pausedRuns,
    } as unknown as Parameters<typeof workSubscribers>[0]).find(
      (each) => each.name === 'work.take-up-the-run-a-person-answered',
    );
    const answered = new TaskAnswered(
      TaskId.of('task_1'),
      WorkspaceId.of('ws_1'),
      RunId.of('run_1'),
    );

    await taking?.handle(answered);

    expect(taking?.kinds).toEqual(['task.answered']);
    expect(pausedRuns.onTaskAnswered).toHaveBeenCalledWith(answered);
  });
});
