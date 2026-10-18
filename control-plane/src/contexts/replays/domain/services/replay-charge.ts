import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Money } from '@replays/domain/value-objects/money.vo';

export interface ReplayCharge {
  readonly spent: Money;
  readonly unpriced: number;
}

export const chargeOf = (replay: Replay): ReplayCharge => ({
  spent: replay.spent,
  unpriced: replay.unpricedRuns,
});
