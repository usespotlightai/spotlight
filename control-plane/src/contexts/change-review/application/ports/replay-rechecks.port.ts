import type { RunId } from '@shared-kernel/domain/value-objects/run-id.vo';

export const REPLAY_RECHECKS = Symbol('REPLAY_RECHECKS');

export interface ReplayRechecksPort {
  recheckable(runId: RunId): Promise<readonly string[]>;

  recheck(runId: RunId, stackId: string): Promise<void>;
}
