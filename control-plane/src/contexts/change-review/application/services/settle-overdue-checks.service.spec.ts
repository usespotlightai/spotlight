import { SettleOverdueChecks } from '@change-review/application/services/settle-overdue-checks.service';
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
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
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

const settling = (
  overdue: readonly StackCheck[],
  conflicting: readonly string[] = [],
) => {
  const saved: StackCheck[] = [];
  const save = vi.fn(async (check: StackCheck) => {
    if (conflicting.includes(check.stackId.value)) {
      throw new StackCheckVersionConflictError(check.stackId.value);
    }
    saved.push(check);
  });
  const listed = vi.fn(async () => overdue);
  const logged = vi.fn();

  return {
    saved,
    save,
    listed,
    logged,
    settle: new SettleOverdueChecks(
      { overdue: listed, save } as unknown as StackCheckRepository,
      { now: () => NOW, sleep: async () => {} },
      { error: logged } as unknown as LoggerPort,
    ),
  };
};

describe('SettleOverdueChecks', () => {
  it('skips every check nobody took up in time as nobody checked', async () => {
    const { settle, saved, listed } = settling([
      waiting('stack_1'),
      waiting('stack_2'),
    ]);

    await settle.workDue();

    expect(listed).toHaveBeenCalledWith(NOW, 50);
    expect(saved.map((each) => each.stackId.value)).toEqual([
      'stack_1',
      'stack_2',
    ]);
    expect(saved.map((each) => each.skippedAt(NOW))).toEqual([
      { code: 'nobody-checked', detail: null },
      { code: 'nobody-checked', detail: null },
    ]);
  });

  it('leaves alone a check a runner took up since it was listed', async () => {
    const taken = waiting('stack_1').claimedFor(
      RunnerId.of('runner_1'),
      RunnerTerms.none(),
      new Date(NOW.getTime() - 1_000),
    );
    const { settle, save } = settling([taken]);

    await settle.workDue();

    expect(save).not.toHaveBeenCalled();
  });

  it('carries on past a check that changed while it was being settled', async () => {
    const reserved = waiting('stack_1').reservedFor(
      RunnerId.of('pooled_1'),
      PoolId.of('pool_1'),
      new Date(BEGAN.getTime() + WAITING_LIMIT_MS - 60_000),
    );
    const { settle, saved } = settling(
      [reserved, waiting('stack_2')],
      ['stack_1'],
    );

    await settle.workDue();

    expect(saved.map((each) => each.stackId.value)).toEqual(['stack_2']);
  });

  it('saves the runner provisioned for a check it settles as let go, alongside the settling', async () => {
    const reserved = waiting('stack_1').reservedFor(
      RunnerId.of('pooled_1'),
      PoolId.of('pool_1'),
      new Date(BEGAN.getTime() + WAITING_LIMIT_MS - 60_000),
    );
    const { settle, saved } = settling([reserved]);

    await settle.workDue();

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
    const settle = new SettleOverdueChecks(
      {
        overdue: async () => [waiting('stack_1'), waiting('stack_2')],
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

    await settle.workDue();

    expect(logged).toHaveBeenCalledOnce();
    expect(saved).toEqual(['stack_2']);
  });
});
