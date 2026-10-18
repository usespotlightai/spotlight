import { baselineTermsOf } from '@replays/domain/services/baseline-terms';
import { Money } from '@replays/domain/value-objects/money.vo';
import { describe, expect, it } from 'vitest';

describe('baselineTermsOf', () => {
  it('keeps a baseline as requested when it does not check the set', () => {
    expect(baselineTermsOf(false, 1, Money.ceiling(5, 'USD'))).toEqual({
      calibration: false,
      repeats: 1,
      ceiling: Money.ceiling(5, 'USD'),
    });
  });

  it('checks the set with at least three repeats, raising the ceiling in step up to the most a ceiling may be', () => {
    const checking = baselineTermsOf(true, 1, Money.ceiling(5, 'USD'));

    expect(checking.calibration).toBe(true);
    expect(checking.repeats).toBe(3);
    expect(checking.ceiling.amount).toBe(15);
    expect(baselineTermsOf(true, 4, Money.ceiling(8, 'USD')).repeats).toBe(4);
    expect(
      baselineTermsOf(true, 1, Money.ceiling(400, 'USD')).ceiling.amount,
    ).toBe(1_000);
  });
});
