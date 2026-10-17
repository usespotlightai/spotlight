import type { ReplayRechecksPort } from '@change-review/application/ports/replay-rechecks.port';
import type { StackCheck } from '@change-review/domain/aggregates/stack-check.aggregate';
import type { StackCheckRepository } from '@change-review/domain/repositories/stack-check.repository';
import { ChangeStackId } from '@change-review/domain/value-objects/change-stack-id.vo';
import type { ClockPort } from '@shared-kernel/application/ports/clock.port';
import type { TransactionPort } from '@shared-kernel/application/ports/transaction.port';
import { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const recheckable = (check: StackCheck): boolean =>
  check.replay && !check.recheck && check.foundWhole;

export class RecheckReplayChanges implements ReplayRechecksPort {
  constructor(
    private readonly checks: StackCheckRepository,
    private readonly transaction: TransactionPort,
    private readonly clock: ClockPort,
  ) {}

  async recheckable(runId: string): Promise<readonly string[]> {
    return (await this.checks.ofRun(RunId.of(runId)))
      .filter(recheckable)
      .map((each) => each.stackId.value);
  }

  recheck(runId: string, stackId: string): Promise<void> {
    const stack = ChangeStackId.of(stackId);

    return this.transaction.inTransaction(async () => {
      const first = await this.checks.find(stack, false);

      if (
        !first?.runId.equals(RunId.of(runId)) ||
        !recheckable(first) ||
        (await this.checks.find(stack, true))
      ) {
        return;
      }

      await this.checks.add(first.rechecking(this.clock.now()));
    });
  }
}
