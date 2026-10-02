import type { StackStanding } from '@replays/domain/value-objects/change-checks.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const CHANGE_REVIEW = Symbol('REPLAYS_CHANGE_REVIEW');

export interface ChangeReviewPort {
  stacksOf(run: RunId): Promise<readonly StackStanding[]>;
}
