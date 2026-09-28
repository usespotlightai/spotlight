import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { RunLapsed } from '@work/domain/events/run-lapsed.event';
import { RunReservationDropped } from '@work/domain/events/run-reservation-dropped.event';
import { RunWithdrawn } from '@work/domain/events/run-withdrawn.event';
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

    expect(losing?.kinds).toEqual(['run.lapsed']);
    expect(holdLost.mock.calls).toEqual([
      [{ workspaceId: 'ws_1', runId: 'run_1', attempt: 1 }],
    ]);
  });

  it('tells Runners of the runner a run lapsed on, or no longer waits for', async () => {
    const runners = {
      runLapsed: vi.fn(async () => {}),
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

    await named('work.let-go-of-runner-of-lapsed-run')?.handle(
      new RunLapsed(run, workspace, runner, at, 1),
    );
    await named('work.let-go-of-reserved-runner')?.handle(
      new RunReservationDropped(run, workspace, runner),
    );

    expect(runners.runLapsed).toHaveBeenCalledWith(runner, at);
    expect(runners.reservationDropped).toHaveBeenCalledWith('runner_1');
  });
});
