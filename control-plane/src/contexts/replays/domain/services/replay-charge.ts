import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Spend } from '@replays/domain/value-objects/spend.vo';

export interface ReplayCharge {
  readonly spent: Spend;
  readonly unpriced: number;
}

export const chargeOf = (replay: Replay): ReplayCharge => ({
  spent: replay.spent,
  unpriced: replay.unpricedRuns,
});
