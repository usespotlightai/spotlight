export const REPLAY_RECHECKS = Symbol('REPLAY_RECHECKS');

export interface ReplayRechecksPort {
  recheckable(runId: string): Promise<readonly string[]>;

  recheck(runId: string, stackId: string): Promise<void>;
}
