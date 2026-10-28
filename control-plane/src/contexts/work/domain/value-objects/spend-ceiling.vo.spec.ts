import { InvalidSpendCeilingError } from '@work/domain/exceptions/invalid-spend-ceiling.error';
import { SpendCeiling } from '@work/domain/value-objects/spend-ceiling.vo';
import { describe, expect, it } from 'vitest';

const fieldOf = (made: () => unknown): string | null => {
  try {
    made();
  } catch (error) {
    if (error instanceof InvalidSpendCeilingError) {
      return error.field;
    }
    throw error;
  }

  return null;
};

describe('SpendCeiling', () => {
  it('counts an amount above 0 in an upper-case currency', () => {
    expect(SpendCeiling.of(12.5, ' eur ')).toMatchObject({
      amount: 12.5,
      currency: 'EUR',
    });
  });

  it('refuses an amount of 0 or less, or above its most', () => {
    expect(fieldOf(() => SpendCeiling.of(0, 'USD'))).toBe('amount');
    expect(fieldOf(() => SpendCeiling.of(1_001, 'USD'))).toBe('amount');
    expect(fieldOf(() => SpendCeiling.of(5_000, 'USD', null))).toBeNull();
  });

  it('refuses a currency that is not three letters', () => {
    expect(fieldOf(() => SpendCeiling.of(10, 'dollars'))).toBe('currency');
  });
});
