import type { CheckWorkId } from '@shared-kernel/domain/value-objects/check-work-id.vo';
import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const TRIAL_RECHECKS = Symbol('TRIAL_RECHECKS');

export interface TrialRechecksPort {
  recheckable(runId: RunId): Promise<readonly CheckWorkId[]>;

  recheck(runId: RunId, check: CheckWorkId): Promise<void>;
}
