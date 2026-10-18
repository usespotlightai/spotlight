import type { StackStatus } from '@replays/domain/value-objects/change-checks.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const CHANGE_REVIEW = Symbol('REPLAYS_CHANGE_REVIEW');

export interface ChangeReviewPort {
  stacksOf(run: RunId): Promise<readonly StackStatus[]>;

  rechecksOf(run: RunId): Promise<readonly StackStatus[]>;

  recheckable(run: RunId): Promise<readonly string[]>;

  recheck(run: RunId, stackId: string): Promise<void>;
}
