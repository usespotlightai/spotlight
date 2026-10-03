import type { ReplayRechecksPort } from '@change-review/application/ports/replay-rechecks.port';
import type {
  CheckedChange,
  RunChangeChecksPort,
} from '@change-review/application/ports/run-change-checks.port';
import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import type { StackStanding } from '@replays/domain/value-objects/change-checks.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const standingOf = (each: CheckedChange): StackStanding => ({
  repository: each.repository,
  state: each.state,
  skip: each.skip,
  failedAt: [...each.failedAt],
  spent: ModelSpent.of(
    each.spent.costs.map((cost) => Spend.of(cost.amount, cost.currency)),
    each.spent.unpriced,
  ),
});

export class ChangeReview implements ChangeReviewPort {
  constructor(
    private readonly checks: RunChangeChecksPort,
    private readonly rechecks: ReplayRechecksPort,
  ) {}

  async stacksOf(run: RunId): Promise<readonly StackStanding[]> {
    return (await this.checks.ofRun(run.value)).map(standingOf);
  }

  async rechecksOf(run: RunId): Promise<readonly StackStanding[]> {
    return (await this.checks.rechecksOfRun(run.value)).map(standingOf);
  }

  recheckable(run: RunId): Promise<readonly string[]> {
    return this.rechecks.recheckable(run.value);
  }

  recheck(run: RunId, stackId: string): Promise<void> {
    return this.rechecks.recheck(run.value, stackId);
  }
}
