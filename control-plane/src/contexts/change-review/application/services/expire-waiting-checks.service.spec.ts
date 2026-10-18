import { ExpireWaitingChecks } from '@change-review/application/services/expire-waiting-checks.service';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { CheckReservationDropped } from '@change-review/domain/events/check-reservation-dropped.event';
import { StackCheckVersionConflictError } from '@change-review/domain/exceptions/stack-check-version-conflict.error';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import { WAITING_LIMIT_MS } from '@change-review/domain/value-objects/stack-check.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerOffer } from '@shared-kernel/domain/value-objects/runner-offer.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const BEGAN = new Date('2026-09-24T12:00:00.000Z');

const NOW = new Date(BEGAN.getTime() + WAITING_LIMIT_MS + 1);

const waiting = (stack: string) =>
  StackCheck.begin({
    stackId: ChangeStackId.of(stack),
    runId: RunId.of(`run_of_${stack}`),
    taskId: null,
    replay: false,
    workspaceId: WorkspaceId.of('ws_1'),
    request: CheckRequest.of('npm test', null),
    entries: [],
    now: BEGAN,
  });

const expiring = (
  expired: readonly StackCheck[],
  conflicting: readonly string[] = [],
) => {
  const saved: StackCheck[] = [];
  const save = vi.fn(async (check: StackCheck) => {
    if (conflicting.includes(check.stackId.value)) {
      throw new StackCheckVersionConflictError(check.stackId.value);
    }
    saved.push(check);
  });
  const listed = vi.fn(async () => expired);
  const logged = vi.fn();

  return {
    saved,
    save,
    listed,
    logged,
    expire: new ExpireWaitingChecks(
      { withExpiredWait: listed, save } as unknown as StackCheckRepository,
      { now: () => NOW, sleep: async () => {} },
      { error: logged } as unknown as LoggerPort,
    ),
  };
};

describe('ExpireWaitingChecks', () => {
  it('skips every check nobody claimed in time as a queue timeout', async () => {
    const { expire, saved, listed } = expiring([
      waiting('stack_1'),
      waiting('stack_2'),
    ]);

    await expire.processDue();

    expect(listed).toHaveBeenCalledWith(NOW, 50);
    expect(saved.map((each) => each.stackId.value)).toEqual([
      'stack_1',
      'stack_2',
    ]);
    expect(saved.map((each) => each.skippedAt(NOW))).toEqual([
      { code: 'queue-timeout', detail: null },
      { code: 'queue-timeout', detail: null },
    ]);
  });

  it('leaves alone a check a runner claimed since it was listed', async () => {
    const taken = waiting('stack_1').claimedFor(
      RunnerId.of('runner_1'),
      RunnerOffer.none(),
      new Date(NOW.getTime() - 1_000),
    );
    const { expire, save } = expiring([taken]);

    await expire.processDue();

    expect(save).not.toHaveBeenCalled();
  });

  it('carries on past a check that changed while it was being expired', async () => {
    const reserved = waiting('stack_1').reservedFor(
      RunnerId.of('pooled_1'),
      PoolId.of('pool_1'),
      new Date(BEGAN.getTime() + WAITING_LIMIT_MS - 60_000),
    );
    const { expire, saved } = expiring(
      [reserved, waiting('stack_2')],
      ['stack_1'],
    );

    await expire.processDue();

    expect(saved.map((each) => each.stackId.value)).toEqual(['stack_2']);
  });

  it('saves the runner provisioned for a check it expires as released, together with the expired check', async () => {
    const reserved = waiting('stack_1').reservedFor(
      RunnerId.of('pooled_1'),
      PoolId.of('pool_1'),
      new Date(BEGAN.getTime() + WAITING_LIMIT_MS - 60_000),
    );
    const { expire, saved } = expiring([reserved]);

    await expire.processDue();

    expect(saved[0]?.pullEvents()).toContainEqual(
      new CheckReservationDropped(
        ChangeStackId.of('stack_1'),
        RunnerId.of('pooled_1'),
      ),
    );
  });

  it('logs any other failure and carries on with the rest', async () => {
    const saved: string[] = [];
    const logged = vi.fn();
    const expire = new ExpireWaitingChecks(
      {
        withExpiredWait: async () => [waiting('stack_1'), waiting('stack_2')],
        save: async (check: StackCheck) => {
          if (check.stackId.value === 'stack_1') {
            throw new Error('the database went away');
          }
          saved.push(check.stackId.value);
        },
      } as unknown as StackCheckRepository,
      { now: () => NOW, sleep: async () => {} },
      { error: logged } as unknown as LoggerPort,
    );

    await expire.processDue();

    expect(logged).toHaveBeenCalledOnce();
    expect(saved).toEqual(['stack_2']);
  });
});
