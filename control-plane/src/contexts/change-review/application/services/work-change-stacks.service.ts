import type { DraftChangeStack } from '@change-review/application/services/draft-change-stack.service';
import type { ReorderChangeStack } from '@change-review/application/services/reorder-change-stack.service';
import type { ChangeStack } from '@change-review/domain/aggregates/change-stack.aggregate';
import { ChangeStackMovedOnError } from '@change-review/domain/exceptions/change-stack-moved-on.error';
import type { ChangeStackRepository } from '@change-review/domain/repositories/change-stack.repository';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import type { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { LoggerPort } from '@shared-kernel/application/ports/logger.port';
import type { OwedWorkPort } from '@shared-kernel/application/ports/owed-work.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { OwedWorkPool } from '@shared-kernel/application/services/owed-work-pool';

const MOST_STACKS_AT_ONCE = 4;

export class WorkChangeStacks implements OwedWorkPort {
  readonly name = 'Drafting and reordering change stacks';

  readonly #pool: OwedWorkPool<ChangeStack, ChangeStackId>;

  constructor(
    private readonly stacks: ChangeStackRepository,
    private readonly checks: StackCheckRepository,
    transaction: TransactionPort,
    private readonly drafting: DraftChangeStack,
    private readonly reordering: ReorderChangeStack,
    clock: ClockPort,
    logger: LoggerPort,
  ) {
    this.#pool = new OwedWorkPool<ChangeStack, ChangeStackId>(
      {
        name: this.name,
        mostAtOnce: MOST_STACKS_AT_ONCE,
        due: (now) => this.stacks.dueForWork(now),
        find: (id) => this.stacks.find(id),
        save: (stack) => this.stacks.save(stack),
        keyOf: (stack) => stack.id,
        about: (stack) => ({
          changeStackId: stack.id.value,
          runId: stack.runId.value,
          state: stack.state,
          attempts: stack.work.attempts,
        }),
        worked: (stack) => this.worked(stack),
        stale: (error) => error instanceof ChangeStackMovedOnError,
      },
      transaction,
      clock,
      logger,
    );
  }

  workDue(): Promise<void> {
    return this.#pool.workDue();
  }

  idle(): Promise<void> {
    return this.#pool.idle();
  }

  private async worked(stack: ChangeStack): Promise<ChangeStack> {
    if (stack.state === 'drafting') {
      return this.drafting.drafted(stack);
    }

    const check = await this.checks.find(stack.id);

    return check
      ? this.reordering.reordered(stack, check)
      : stack.gaveUpReordering();
  }
}
