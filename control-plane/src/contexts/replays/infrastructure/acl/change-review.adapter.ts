import type { ReplayRechecksPort } from '@change-review/application/ports/replay-rechecks.port';
import type {
  CheckedChange,
  RunChangeChecksPort,
} from '@change-review/application/ports/run-change-checks.port';
import type { ChangeReviewPort } from '@replays/application/ports/change-review.port';
import type { StackStatus } from '@replays/domain/value-objects/change-checks.vo';
import { ChangeStackId } from '@replays/domain/value-objects/change-stack-id.vo';
import { ModelSpent } from '@replays/domain/value-objects/model-spent.vo';
import { Money } from '@replays/domain/value-objects/money.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

const WHOLE_CHANGE = 'the whole change';

const statusOf = (each: CheckedChange): StackStatus => ({
  repository: each.repository,
  state: each.status,
  skip: each.skip,
  failedAt: [...(each.failedWhole ? [WHOLE_CHANGE] : []), ...each.failedLayers],
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
    return (await this.checks.ofRun(run)).map(statusOf);
  }

  async rechecksOf(run: RunId): Promise<readonly StackStatus[]> {
    return (await this.checks.rechecksOfRun(run)).map(statusOf);
  }

  async recheckable(run: RunId): Promise<readonly ChangeStackId[]> {
    return (await this.rechecks.recheckable(run)).map((each) =>
      ChangeStackId.of(each),
    );
  }

  recheck(run: RunId, stackId: ChangeStackId): Promise<void> {
    return this.rechecks.recheck(run, stackId.value);
  }
}
