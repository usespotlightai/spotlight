import type { StackStatus } from '@replays/domain/value-objects/change-checks.vo';
import type { ChangeStackId } from '@replays/domain/value-objects/change-stack-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const CHANGE_REVIEW = Symbol('REPLAYS_CHANGE_REVIEW');

export interface ChangeReviewPort {
  stacksOf(run: RunId): Promise<readonly StackStatus[]>;

  rechecksOf(run: RunId): Promise<readonly StackStatus[]>;

  recheckable(run: RunId): Promise<readonly ChangeStackId[]>;

  recheck(run: RunId, stackId: ChangeStackId): Promise<void>;
}
