import { baselineTermsOf } from '@replays/domain/services/baseline-terms';
import { Spend } from '@replays/domain/value-objects/spend.vo';
import { describe, expect, it } from 'vitest';

describe('baselineTermsOf', () => {
  it('keeps a baseline as asked when it does not check the set', () => {
    expect(baselineTermsOf(false, 1, Spend.ceiling(5, 'USD'))).toEqual({
      probe: false,
      repeats: 1,
      ceiling: Spend.ceiling(5, 'USD'),
    });
  });

  it('checks the set with at least three copies, raising the ceiling in step up to the most a ceiling may be', () => {
    const checking = baselineTermsOf(true, 1, Spend.ceiling(5, 'USD'));

    expect(checking.probe).toBe(true);
    expect(checking.repeats).toBe(3);
    expect(checking.ceiling.amount).toBe(15);
    expect(baselineTermsOf(true, 4, Spend.ceiling(8, 'USD')).repeats).toBe(4);
    expect(
      baselineTermsOf(true, 1, Spend.ceiling(400, 'USD')).ceiling.amount,
    ).toBe(1_000);
  });
});
