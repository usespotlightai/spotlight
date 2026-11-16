import type { ReviewWorkId } from '@shared-kernel/domain/value-objects/review-work-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const TRIAL_RECHECKS = Symbol('TRIAL_RECHECKS');

export interface TrialRechecksPort {
  recheckable(runId: RunId): Promise<readonly ReviewWorkId[]>;

  recheck(runId: RunId, check: ReviewWorkId): Promise<void>;
}
