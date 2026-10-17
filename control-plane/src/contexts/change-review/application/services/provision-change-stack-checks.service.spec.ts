import { ProvisionChangeStackChecks } from '@change-review/application/services/provision-change-stack-checks.service';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { skipOf } from '@change-review/domain/value-objects/stack-check.vo';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { ProvisionFailure } from '@shared-kernel/domain/value-objects/provision-failure.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerPlacement } from '@shared-kernel/domain/value-objects/runner-placement.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-24T12:00:00.000Z');

const UNTIL = new Date('2026-09-24T12:05:00.000Z');

const RUNNER = RunnerId.of('pooled_1');

const OTHER = RunnerId.of('pooled_2');

const HTTP_ERROR = ProvisionFailure.of('http-error', 'answered 503');

const waiting = (stack: string, placement: string[] = []) =>
  StackCheck.begin({
    stackId: ChangeStackId.of(stack),
    runId: RunId.of(`run_of_${stack}`),
    taskId: null,
    replay: false,
    workspaceId: WorkspaceId.of('ws_1'),
    request: CheckRequest.of('npm test', null, RunnerPlacement.of(placement)),
    entries: [],
    now: NOW,
  });

const provisioning = (
  checks: readonly StackCheck[],
  conflicts = 0,
  listed: readonly StackCheck[] = checks,
) => {
  const stored = new Map(checks.map((each) => [each.stackId.value, each]));
  let conflicting = conflicts;
  const find = vi.fn(async (id: ChangeStackId) => stored.get(id.value) ?? null);
  const save = vi.fn(async (check: StackCheck) => {
    if (conflicting > 0) {
      conflicting -= 1;
      throw new StackCheckVersionConflictError(check.stackId.value);
    }
    stored.set(check.stackId.value, check);
  });
  const awaitingProvision = vi.fn(async () => listed);
  const withLapsedReservations = vi.fn(async () => listed);

  return {
    find,
    save,
    awaitingProvision,
    check: (stack: string) => stored.get(stack) as StackCheck,
    service: new ProvisionChangeStackChecks({
      open: find,
      save,
      awaitingProvision,
      withLapsedReservations,
    } as unknown as StackCheckRepository),
  };
};

describe('ProvisionChangeStackChecks', () => {
  it('offers only the checks still waiting for a runner to be provisioned', async () => {
    const backedOff = waiting('stack_3')
      .reservedFor(RUNNER, PoolId.of('pool_burst'), NOW)
      .provisionFailed(RUNNER, HTTP_ERROR, NOW);
    const { service, awaitingProvision } = provisioning([
      waiting('stack_1', ['gpu']),
      waiting('stack_2').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW),
      backedOff,
      waiting('stack_4')
        .claimedFor(OTHER, RunnerTerms.none(), NOW)
        .skip(OTHER, skipOf('no-room', null), NOW),
    ]);

    const offered = await service.awaiting(WorkspaceId.of('ws_1'), NOW, {
      skip: 0,
      max: 200,
    });

    expect(offered).toEqual([
      {
        stackId: 'stack_1',
        runId: 'run_of_stack_1',
        placement: RunnerPlacement.of(['gpu']),
      },
    ]);
    expect(awaitingProvision).toHaveBeenCalledWith(
      WorkspaceId.of('ws_1'),
      NOW,
      {
        skip: 0,
        max: 200,
      },
    );
  });

  it('reserves a waiting check for the runner and says until when', async () => {
    const { service, check } = provisioning([waiting('stack_1')]);

    await expect(
      service.reserve('stack_1', RUNNER, PoolId.of('pool_burst'), NOW),
    ).resolves.toEqual(UNTIL);
    expect(check('stack_1').reservation?.runner).toEqual(RUNNER);
    expect(check('stack_1').reservation?.pool.value).toBe('pool_burst');
  });

  it('reserves nothing for a check already reserved, or one it cannot find', async () => {
    const { service, save } = provisioning([
      waiting('stack_1').reservedFor(
        RunnerId.of('pooled_9'),
        PoolId.of('pool_a'),
        NOW,
      ),
    ]);

    await expect(
      service.reserve('stack_1', RUNNER, PoolId.of('pool_burst'), NOW),
    ).resolves.toBeNull();
    await expect(
      service.reserve('stack_2', RUNNER, PoolId.of('pool_burst'), NOW),
    ).resolves.toBeNull();
    expect(save).not.toHaveBeenCalled();
  });

  it('reserves nothing once it keeps finding the check changed', async () => {
    const { service, find } = provisioning([waiting('stack_1')], 3);

    await expect(
      service.reserve('stack_1', RUNNER, PoolId.of('pool_burst'), NOW),
    ).resolves.toBeNull();
    expect(find).toHaveBeenCalledTimes(3);
  });

  it('lets a reservation go, and leaves alone a check that has none', async () => {
    const { service, save, check } = provisioning([
      waiting('stack_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW),
      waiting('stack_2'),
    ]);

    await service.unreserve('stack_1', RUNNER);
    await service.unreserve('stack_2', RUNNER);

    expect(check('stack_1').reservation).toBeNull();
    expect(save).toHaveBeenCalledOnce();
  });

  it('keeps a reservation another runner lets go of', async () => {
    const { service, save, check } = provisioning([
      waiting('stack_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW),
    ]);

    await service.unreserve('stack_1', OTHER);

    expect(save).not.toHaveBeenCalled();
    expect(check('stack_1').reservation?.runner).toEqual(RUNNER);
  });

  it('reads the check again and retries when it changed since it was read', async () => {
    const { service, find, check } = provisioning(
      [waiting('stack_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW)],
      2,
    );

    await service.unreserve('stack_1', RUNNER);

    expect(find).toHaveBeenCalledTimes(3);
    expect(check('stack_1').reservation).toBeNull();
  });

  it('records a failed provision on the check and backs off', async () => {
    const { service, check } = provisioning(
      [waiting('stack_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW)],
      1,
    );

    await service.failed('stack_1', RUNNER, HTTP_ERROR, NOW);

    expect(check('stack_1').reservation).toBeNull();
    expect(check('stack_1').provisioning.failures).toBe(1);
    expect(check('stack_1').provisionableAt(NOW)).toBe(false);
  });

  it('gives up after it keeps finding the check changed', async () => {
    const { service, find } = provisioning(
      [waiting('stack_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW)],
      3,
    );

    await expect(
      service.failed('stack_1', RUNNER, HTTP_ERROR, NOW),
    ).rejects.toThrow(StackCheckVersionConflictError);
    expect(find).toHaveBeenCalledTimes(3);
  });

  it('records no failure on a check that is no longer waiting', async () => {
    const { service, save } = provisioning([
      waiting('stack_1')
        .claimedFor(OTHER, RunnerTerms.none(), NOW)
        .skip(OTHER, skipOf('no-room', null), NOW),
    ]);

    await service.failed('stack_1', RUNNER, HTTP_ERROR, NOW);

    expect(save).not.toHaveBeenCalled();
  });

  it('records no failure another runner reports', async () => {
    const { service, save, check } = provisioning([
      waiting('stack_1').reservedFor(RUNNER, PoolId.of('pool_burst'), NOW),
    ]);

    await service.failed('stack_1', OTHER, HTTP_ERROR, NOW);

    expect(save).not.toHaveBeenCalled();
    expect(check('stack_1').provisioning.failures).toBe(0);
  });

  it('lists only the reservations that lapsed, with the runner each was for', async () => {
    const lapsing = waiting('stack_1').reservedFor(
      RUNNER,
      PoolId.of('pool_burst'),
      NOW,
    );
    const later = new Date(UNTIL.getTime() + 1);
    const { service } = provisioning([
      lapsing,
      waiting('stack_2').reservedFor(
        RunnerId.of('pooled_9'),
        PoolId.of('pool_a'),
        later,
      ),
      waiting('stack_3'),
    ]);

    await expect(service.lapsed(later)).resolves.toEqual([
      { stackId: 'stack_1', runner: RUNNER, until: UNTIL },
    ]);
  });
});
