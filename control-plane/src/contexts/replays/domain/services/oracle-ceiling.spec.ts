import {
  aReplay,
  aSearch,
  candidateOf,
  SEARCH_ID,
} from '@replays/domain/replays.fake-spec';
import { oracleCeilingOf } from '@replays/domain/services/oracle-ceiling';
import { Money } from '@replays/domain/value-objects/money.vo';
import { describe, expect, it } from 'vitest';

describe('oracleCeilingOf', () => {
  it('gives the replay handed the answer the ceiling of its baseline outside a search', () => {
    const baseline = aReplay({
      baseline: true,
      candidate: candidateOf('live'),
      ceiling: 4,
    });

    expect(oracleCeilingOf(baseline, null).equals(baseline.ceiling)).toBe(true);
  });

  it('gives it the share its search keeps for it, when that is within the ceiling of the seed', () => {
    const search = aSearch({ calibrates: true });
    const share = search.ceilingSplit.oracle;
    const baseline = aReplay({
      baseline: true,
      candidate: candidateOf('live'),
      calibration: true,
      searchId: SEARCH_ID,
      repeats: 3,
      ceiling: share.amount * 3,
    });

    expect(oracleCeilingOf(baseline, search).equals(share)).toBe(true);
  });

  it('never gives it more than the ceiling of the seed it is read beside', () => {
    const search = aSearch({ calibrates: true });
    const below = search.ceilingSplit.oracle.amount / 2;
    const baseline = aReplay({
      baseline: true,
      candidate: candidateOf('live'),
      calibration: true,
      searchId: SEARCH_ID,
      repeats: 3,
      ceiling: below,
    });

    expect(
      oracleCeilingOf(baseline, search).equals(Money.ceiling(below, 'USD')),
    ).toBe(true);
  });
});
