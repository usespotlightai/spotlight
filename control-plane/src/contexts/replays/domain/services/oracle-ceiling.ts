import type { Replay } from '@replays/domain/aggregates/replay.aggregate';
import type { Search } from '@replays/domain/aggregates/search.aggregate';
import type { Money } from '@replays/domain/value-objects/money.vo';

export const oracleCeilingOf = (
  baseline: Replay,
  search: Search | null,
): Money => {
  const share = search?.ceilingSplit.oracle ?? null;

  return share?.isWithin(baseline.ceiling) ? share : baseline.ceiling;
};
