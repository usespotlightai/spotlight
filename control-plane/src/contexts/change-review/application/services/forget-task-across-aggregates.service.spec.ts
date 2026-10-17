import type { ReviewOutboxPort } from '@change-review/application/ports/review-outbox.port';
import { ForgetTaskAcrossAggregates } from '@change-review/application/services/forget-task-across-aggregates.service';
import { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import { CheckReservationDropped } from '@change-review/domain/events/check-reservation-dropped.event';
import { HeldCheckForgotten } from '@change-review/domain/events/held-check-forgotten.event';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { DecisionSetRepository } from '@change-review/domain/repositories/decision-set.repository';
import type { ReviewRepository } from '@change-review/domain/repositories/review.repository';
import type { ReviewCommentRepository } from '@change-review/domain/repositories/review-comment.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { CheckRequest } from '@change-review/domain/value-objects/check-request.vo';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { PoolId } from '@shared-kernel/domain/value-objects/pool-id.vo';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';
import { RunnerId } from '@shared-kernel/domain/value-objects/runner-id.vo';
import { RunnerTerms } from '@shared-kernel/domain/value-objects/runner-terms.vo';
import { TaskId } from '@shared-kernel/domain/value-objects/task-id.vo';
import { WorkspaceId } from '@shared-kernel/domain/value-objects/workspace-id.vo';
import { describe, expect, it, vi } from 'vitest';

const NOW = new Date('2026-09-27T10:00:00.000Z');
const TASK = TaskId.of('task_1');

const checkOf = (stack: string) =>
  StackCheck.begin({
    stackId: ChangeStackId.of(stack),
    runId: RunId.of('run_1'),
    taskId: TASK,
    replay: false,
    workspaceId: WorkspaceId.of('ws_1'),
    request: CheckRequest.of('npm test', null),
    entries: [],
    now: NOW,
  });

const forgetting = (checks: readonly StackCheck[]) => {
  const steps: string[] = [];
  const removed: StackCheck[] = [];
  const ofTask = vi.fn(async () => checks);
  const step = (name: string) => async () => {
    steps.push(name);
  };

  return {
    steps,
    removed,
    ofTask,
    service: new ForgetTaskAcrossAggregates(
      { forgetTask: step('outbox') } as unknown as ReviewOutboxPort,
      { removeForTask: step('comments') } as unknown as ReviewCommentRepository,
      { removeForTask: step('reviews') } as unknown as ReviewRepository,
      {
        ofTask,
        remove: async (check: StackCheck) => {
          steps.push('check');
          removed.push(check);
        },
      } as unknown as StackCheckRepository,
      { removeForTask: step('stacks') } as unknown as ChangeStackRepository,
      { removeForTask: step('decisions') } as unknown as DecisionSetRepository,
      { inTransaction: (work) => work() } as TransactionPort,
      { now: () => NOW, sleep: async () => {} },
    ),
  };
};

describe('ForgetTaskAcrossAggregates', () => {
  it('forgets every check of the task along with its stacks', async () => {
    const { service, steps, removed, ofTask } = forgetting([
      checkOf('stack_1'),
      checkOf('stack_2'),
    ]);

    await service.forget(TASK);

    expect(ofTask).toHaveBeenCalledWith(TASK);
    expect(removed.map((each) => each.stackId.value)).toEqual([
      'stack_1',
      'stack_2',
    ]);
    expect(steps).toEqual([
      'outbox',
      'comments',
      'reviews',
      'check',
      'check',
      'stacks',
      'decisions',
    ]);
  });

  it('lets go of the runner reserved for a check it forgets', async () => {
    const reserved = checkOf('stack_1').reservedFor(
      RunnerId.of('pooled_1'),
      PoolId.of('pool_1'),
      NOW,
    );
    const { service, removed } = forgetting([reserved]);

    await service.forget(TASK);

    expect(removed[0]?.reservation).toBeNull();
    expect(removed[0]?.pullEvents()).toEqual([
      new CheckReservationDropped(
        ChangeStackId.of('stack_1'),
        RunnerId.of('pooled_1'),
      ),
    ]);
  });

  it('releases the runner that was checking a check it forgets', async () => {
    const held = checkOf('stack_1').claimedFor(
      RunnerId.of('runner_1'),
      RunnerTerms.none(),
      NOW,
    );
    held.pullEvents();
    const { service, removed } = forgetting([held]);

    await service.forget(TASK);

    expect(removed[0]?.pullEvents()).toEqual([
      new HeldCheckForgotten(ChangeStackId.of('stack_1')),
    ]);
  });
});
