import { medianOf, spendingOf } from '@insights/domain/services/measures';
import { describe, expect, it } from 'vitest';

describe('medianOf', () => {
  it('rounds the middle of an even count up, and gives zero, not minus zero, for a middle of minus one half', () => {
    expect(medianOf([-3, -2])).toBe(-2);
    expect(Object.is(medianOf([-1, 0]), 0)).toBe(true);
  });
});

describe('spendingOf', () => {
  it('sums the priced runs in their one currency and counts the runs with no price', () => {
    expect(
      spendingOf([
        { amount: 1, currency: 'USD' },
        null,
        { amount: 2.5, currency: 'USD' },
      ]),
    ).toEqual({
      spend: { amount: 3.5, currency: 'USD' },
      priced: 2,
      unpriced: 1,
      mixedCurrencies: false,
    });
  });

  it('sums nothing when priced runs span several currencies, saying so without counting them as unpriced', () => {
    expect(
      spendingOf([
        { amount: 1, currency: 'USD' },
        { amount: 2, currency: 'EUR' },
        null,
      ]),
    ).toEqual({
      spend: null,
      priced: 2,
      unpriced: 1,
      mixedCurrencies: true,
    });
  });

  it('says nothing of mixed currencies when no run was priced', () => {
    expect(spendingOf([null, null])).toEqual({
      spend: null,
      priced: 0,
      unpriced: 2,
      mixedCurrencies: false,
    });
  });
});
