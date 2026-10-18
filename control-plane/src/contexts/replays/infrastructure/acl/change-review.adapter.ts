import type { ReplayRechecksPort } from '@change-review/application/ports/replay-rechecks.port';
import type {
  CheckedChange,
  RunChangeChecksPort,
} from '@change-review/application/ports/run-change-checks.port';
import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import type { StackStatus } from '@replays/domain/value-objects/change-checks.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const statusOf = (each: CheckedChange): StackStatus => ({
  repository: each.repository,
  state: each.status,
  skip: each.skip,
  failedAt: [...each.failedAt],
  spent: ModelSpent.of(
    each.usage.costs.map((cost) => Money.of(cost.amount, cost.currency)),
    each.usage.unpriced,
  ),
});

export class ChangeReview implements ChangeReviewPort {
  constructor(
    private readonly checks: RunChangeChecksPort,
    private readonly rechecks: ReplayRechecksPort,
  ) {}

  async stacksOf(run: RunId): Promise<readonly StackStatus[]> {
    return (await this.checks.ofRun(run.value)).map(statusOf);
  }

  async rechecksOf(run: RunId): Promise<readonly StackStatus[]> {
    return (await this.checks.rechecksOfRun(run.value)).map(statusOf);
  }

  recheckable(run: RunId): Promise<readonly string[]> {
    return this.rechecks.recheckable(run.value);
  }

  recheck(run: RunId, stackId: string): Promise<void> {
    return this.rechecks.recheck(run.value, stackId);
  }
}
