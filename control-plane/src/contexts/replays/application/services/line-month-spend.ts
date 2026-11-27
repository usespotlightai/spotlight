import type { SearchRepository } from '@replays/domain/repositories/search.repository';
import {
  monthSpentOf,
  monthStartOf,
} from '@replays/domain/services/search-schedule';
import type { Money } from '@replays/domain/value-objects/money.vo';
import type { SearchPolicy } from '@replays/domain/value-objects/search-policy.vo';
import type { LineId } from '@shared-kernel/domain/value-objects/line-id.vo';

export const lineMonthSpent = async (
  searches: SearchRepository,
  lineId: LineId,
  policy: SearchPolicy,
  now: Date,
): Promise<Money> =>
  monthSpentOf(
    await searches.ofLineStartedSince(lineId, monthStartOf(now)),
    policy.monthlyCeiling.currency,
  );
