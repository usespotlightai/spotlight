import type { RunChangeChecksPort } from '@change-review/application/ports/run-change-checks.port';
import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import type { StackStanding } from '@replays/domain/value-objects/change-checks.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export class ChangeReview implements ChangeReviewPort {
  constructor(private readonly checks: RunChangeChecksPort) {}

  async stacksOf(run: RunId): Promise<readonly StackStanding[]> {
    return (await this.checks.ofRun(run.value)).map((each) => ({
      repository: each.repository,
      state: each.state,
      skip: each.skip,
      failedAt: [...each.failedAt],
      spent: ModelSpent.of(
        each.spent.costs.map((cost) => Spend.of(cost.amount, cost.currency)),
        each.spent.unpriced,
      ),
    }));
  }
}
