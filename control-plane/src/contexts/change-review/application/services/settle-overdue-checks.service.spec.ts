import { SettleOverdueChecks } from '@change-review/application/services/settle-overdue-checks.service';
import {
  StackCheck,
  WAITING_LIMIT_MS,
} from '@change-review/domain/aggregates/stack-check.aggregate';
import { ChangedSinceReadError } from '@change-review/domain/exceptions/changed-since-read.error';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const BEGAN = new Date('2026-09-24T12:00:00.000Z');

const NOW = new Date(BEGAN.getTime() + WAITING_LIMIT_MS + 1);

const waiting = (stack: string) =>
  StackCheck.begin({
    stackId: ChangeStackId.of(stack),
    runId: RunId.of(`run_of_${stack}`),
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
      throw new ChangedSinceReadError(
        'change stack check',
        check.stackId.value,
      );
    }
    saved.push(check);
  });
  const listed = vi.fn(async () => overdue);
  const reservationDropped = vi.fn(async () => {});
  const logged = vi.fn();

  return {
    saved,
    save,
    listed,
    reservationDropped,
    logged,
    settle: new SettleOverdueChecks(
      { overdue: listed, save } as unknown as StackCheckRepository,
      { released: vi.fn(), reservationDropped },
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
      new Date(NOW.getTime() - 1_000),
    );
    const { settle, save } = settling([taken]);

    await settle.workDue();

    expect(save).not.toHaveBeenCalled();
  });

  it('carries on past a check that changed while it was being settled, letting go of nobody for it', async () => {
    const reserved = waiting('stack_1').reservedFor(
      RunnerId.of('pooled_1'),
      'pool_1',
      new Date(BEGAN.getTime() + WAITING_LIMIT_MS - 60_000),
    );
    const { settle, saved, reservationDropped } = settling(
      [reserved, waiting('stack_2')],
      ['stack_1'],
    );

    await settle.workDue();

    expect(saved.map((each) => each.stackId.value)).toEqual(['stack_2']);
    expect(reservationDropped).not.toHaveBeenCalled();
  });

  it('lets go of a runner provisioned for a check it settles', async () => {
    const reserved = waiting('stack_1').reservedFor(
      RunnerId.of('pooled_1'),
      'pool_1',
      new Date(BEGAN.getTime() + WAITING_LIMIT_MS - 60_000),
    );
    const { settle, reservationDropped } = settling([reserved]);

    await settle.workDue();

    expect(reservationDropped).toHaveBeenCalledWith(RunnerId.of('pooled_1'));
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
      { released: vi.fn(), reservationDropped: vi.fn() },
      { now: () => NOW, sleep: async () => {} },
      { error: logged } as unknown as LoggerPort,
    );

    await settle.workDue();

    expect(logged).toHaveBeenCalledOnce();
    expect(saved).toEqual(['stack_2']);
  });
});
