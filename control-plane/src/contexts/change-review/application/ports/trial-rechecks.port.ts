import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const TRIAL_RECHECKS = Symbol('TRIAL_RECHECKS');

export interface TrialRechecksPort {
  recheckable(runId: RunId): Promise<readonly string[]>;

  recheck(runId: RunId, stackId: string): Promise<void>;
}
