import type { RunTokensPort } from '@identity/application/ports/run-tokens.port';
import { RunCredentials } from '@runs/application/services/run-credentials.service';
import { orderedFor } from '@runs/domain/aggregates/run.fake-spec';
import { RunCancelled } from '@runs/domain/events/run-cancelled.event';
import { RunLeaseExpired } from '@runs/domain/events/run-lease-expired.event';
import { RunReservationDropped } from '@runs/domain/events/run-reservation-dropped.event';
import { RunSuspended } from '@runs/domain/events/run-suspended.event';
import { runsSubscribers } from '@runs/presentation/events/runs.subscribers';
import type { RunGrantsPort } from '@secrets/application/ports/run-grants.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

describe('runsSubscribers', () => {
  it('tells Secrets to end what a run was granted once the run ends', async () => {
    const endedFor = vi.fn(async () => undefined);
    const ending = runsSubscribers({
      credentials: new RunCredentials(
        { endedFor } as unknown as RunGrantsPort,
        {} as RunTokensPort,
      ),
    } as unknown as Parameters<typeof runsSubscribers>[0]).find(
      (each) => each.name === 'runs.end-secret-grants-of-ended-run',
    );

    await ending?.handle(
      new RunCancelled(
        RunId.of('run_1'),
        WorkspaceId.of('ws_1'),
        orderedFor.spec().requester,
        2,
        false,
        false,
        new Date('2026-09-27T09:00:00.000Z'),
      ),
    );

    expect(ending?.kinds).toEqual([
      'run.ended',
      'run.exhausted',
      'run.cancelled',
    ]);
    expect(endedFor).toHaveBeenCalledWith({
      workspaceId: 'ws_1',
      runId: 'run_1',
      attempt: 2,
    });
  });

  it('tells Secrets that the lease of an attempt is lost when it expires', async () => {
    const leaseLost = vi.fn(async () => undefined);
    const losing = runsSubscribers({
      credentials: new RunCredentials(
        { leaseLost } as unknown as RunGrantsPort,
        {} as RunTokensPort,
      ),
    } as unknown as Parameters<typeof runsSubscribers>[0]).find(
      (each) => each.name === 'runs.lose-secret-lease-of-ended-attempt',
    );
    const run = RunId.of('run_1');
    const workspace = WorkspaceId.of('ws_1');

    await losing?.handle(
      new RunLeaseExpired(
        run,
        workspace,
        RunnerId.of('runner_1'),
        new Date('2026-09-27T09:00:00.000Z'),
        1,
      ),
    );

    await losing?.handle(
      new RunSuspended(
        run,
        workspace,
        orderedFor.task('task_1', 0).requester,
        RunnerId.of('runner_1'),
        new Date('2026-09-27T09:05:00.000Z'),
        2,
      ),
    );

    expect(losing?.kinds).toEqual(['run.lease-expired', 'run.suspended']);
    expect(leaseLost.mock.calls).toEqual([
      [{ workspaceId: 'ws_1', runId: 'run_1', attempt: 1 }],
      [{ workspaceId: 'ws_1', runId: 'run_1', attempt: 2 }],
    ]);
  });

  it('revokes every token issued for a run once it ends, and an attempt’s once its lease expires or the run is suspended', async () => {
    const revokeFor = vi.fn(async () => undefined);
    const subscribers = runsSubscribers({
      credentials: new RunCredentials(
        {} as RunGrantsPort,
        { revokeFor } as unknown as RunTokensPort,
      ),
    } as unknown as Parameters<typeof runsSubscribers>[0]);
    const named = (name: string) =>
      subscribers.find((each) => each.name === name);
    const run = RunId.of('run_1');
    const workspace = WorkspaceId.of('ws_1');

    await named('runs.revoke-tokens-of-ended-run')?.handle(
      new RunCancelled(
        run,
        workspace,
        orderedFor.spec().requester,
        2,
        false,
        false,
        new Date('2026-09-27T09:00:00.000Z'),
      ),
    );
    await named('runs.revoke-tokens-of-ended-attempt')?.handle(
      new RunSuspended(
        run,
        workspace,
        orderedFor.task('task_1', 0).requester,
        RunnerId.of('runner_1'),
        new Date('2026-09-27T09:05:00.000Z'),
        3,
      ),
    );

    expect(named('runs.revoke-tokens-of-ended-run')?.kinds).toEqual([
      'run.ended',
      'run.exhausted',
      'run.cancelled',
    ]);
    expect(named('runs.revoke-tokens-of-ended-attempt')?.kinds).toEqual([
      'run.lease-expired',
      'run.suspended',
    ]);
    expect(revokeFor.mock.calls).toEqual([
      [WorkspaceId.of('ws_1'), RunId.of('run_1'), null],
      [WorkspaceId.of('ws_1'), RunId.of('run_1'), 3],
    ]);
    expect(named('runs.revoke-tokens-of-ended-run')?.callsOut).toBe(true);
    expect(named('runs.revoke-tokens-of-ended-attempt')?.callsOut).toBe(true);
  });

  it('tells Runners of the runner whose lease expired, the runner that suspended a run, and the runner a run no longer waits for', async () => {
    const runners = {
      runLeft: vi.fn(async () => {}),
      reservationDropped: vi.fn(async () => {}),
    };
    const subscribers = runsSubscribers({
      runners,
    } as unknown as Parameters<typeof runsSubscribers>[0]);
    const named = (name: string) =>
      subscribers.find((each) => each.name === name);
    const run = RunId.of('run_1');
    const workspace = WorkspaceId.of('ws_1');
    const runner = RunnerId.of('runner_1');
    const at = new Date('2026-09-27T09:00:00.000Z');

    await named('runs.release-runner-that-left-its-run')?.handle(
      new RunLeaseExpired(run, workspace, runner, at, 1),
    );
    await named('runs.release-runner-that-left-its-run')?.handle(
      new RunSuspended(
        run,
        workspace,
        orderedFor.task('task_1', 0).requester,
        RunnerId.of('runner_2'),
        at,
        2,
      ),
    );
    await named('runs.release-reserved-runner')?.handle(
      new RunReservationDropped(run, workspace, runner),
    );

    expect(runners.runLeft).toHaveBeenCalledWith(runner, at);
    expect(runners.runLeft).toHaveBeenCalledWith(RunnerId.of('runner_2'), at);
    expect(runners.reservationDropped).toHaveBeenCalledWith('runner_1');
  });

  it('ends the sandbox lease of a run that ended, and only lets go of it for a run that comes back', async () => {
    const sandboxes = {
      runLeft: vi.fn(async () => {}),
      runEnded: vi.fn(async () => {}),
    };
    const subscribers = runsSubscribers({
      sandboxes,
    } as unknown as Parameters<typeof runsSubscribers>[0]);
    const named = (name: string) =>
      subscribers.find((each) => each.name === name);
    const ended = named('runs.release-sandbox-of-ended-run');
    const left = named('runs.release-sandbox-of-left-run');
    const run = RunId.of('run_1');
    const workspace = WorkspaceId.of('ws_1');
    const at = new Date('2026-10-30T09:00:00.000Z');

    await left?.handle(
      new RunLeaseExpired(run, workspace, RunnerId.of('runner_1'), at, 1),
    );
    await ended?.handle(
      new RunCancelled(
        run,
        workspace,
        orderedFor.spec().requester,
        2,
        false,
        false,
        new Date('2026-09-27T09:00:00.000Z'),
      ),
    );

    expect(ended?.kinds).toEqual([
      'run.ended',
      'run.exhausted',
      'run.cancelled',
    ]);
    expect(left?.kinds).toEqual(['run.lease-expired', 'run.suspended']);
    expect(sandboxes.runLeft.mock.calls).toEqual([[run]]);
    expect(sandboxes.runEnded.mock.calls).toEqual([[run]]);
  });
});
