import type { TrialRechecksPort } from '@change-review/application/ports/trial-rechecks.port';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import { StackCheckId } from '@change-review/domain/value-objects/stack-check-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { CheckWorkId } from '@shared-kernel/domain/value-objects/check-work-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class RecheckTrialChanges implements TrialRechecksPort {
  constructor(
    private readonly checks: StackCheckRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async recheckable(runId: RunId): Promise<readonly CheckWorkId[]> {
    return (await this.checks.ofRun(runId))
      .filter((each) => each.recheckable)
      .map((each) => CheckWorkId.of(each.stackId.value));
  }

  recheck(runId: RunId, check: CheckWorkId): Promise<void> {
    const stack = ChangeStackId.of(check.value);

    return this.transaction.inTransaction(async () => {
      const first = await this.checks.find(StackCheckId.first(stack));

      if (
        !first?.runId.equals(runId) ||
        !first.recheckable ||
        (await this.checks.find(StackCheckId.recheckOf(stack)))
      ) {
        return;
      }

      await this.checks.add(first.rechecking(this.clock.now()));
    });
  }
}
